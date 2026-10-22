import { NextRequest, NextResponse } from 'next/server';
import { ia, modeloIA } from '@/lib/ia';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { resolverFecha } from '@/lib/fechas/resolverFecha';
import type { ItemExtraido } from '@/lib/ia/extraccion';

/**
 * POST /api/ia/extraer   Body: { texto }
 * Lee el texto y devuelve un BORRADOR con todos los ítems. NO guarda nada.
 * La IA desmenuza; las fechas las calcula el código (resolverFecha).
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const texto = (body as { texto?: unknown }).texto;
  if (typeof texto !== 'string' || texto.trim() === '' || texto.length > 2000) {
    return NextResponse.json({ error: 'El texto debe tener entre 1 y 2000 caracteres' }, { status: 400 });
  }

  try {
    const [usuario, materias] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: user.id }, select: { zonaHoraria: true } }),
      prisma.materia.findMany({ where: { usuarioId: user.id, eliminadoEn: null }, select: { nombre: true } }),
    ]);
    const zona: string = usuario?.zonaHoraria ?? 'America/La_Paz';
    const ahora = new Date();

    const inicio = Date.now();
    const items: ItemExtraido[] = await ia.extraerItems(texto, {
      ahora,
      zonaHoraria: zona,
      materias: materias.map((m: { nombre: string }) => m.nombre),
    });
    const latencia = Date.now() - inicio;

    const borrador = items.map((item) => armarItemBorrador(item, ahora, zona));

    await prisma.interpretacionIA.create({
      data: {
        usuarioId: user.id,
        tipoEntrada: 'texto',
        entradaOriginal: texto,
        respuestaIa: { items } as object,
        confianza: items.length ? items.reduce((s, i) => s + i.confianza, 0) / items.length : null,
        modeloUsado: modeloIA,
        tiempoRespuestaMs: latencia,
        estado: 'pendiente',
      },
    });

    return NextResponse.json({
      items: borrador,
      advertencias: items.length === 0 ? ['No encontré ninguna actividad en el texto.'] : [],
    });
  } catch (error) {
    console.error('Error en /api/ia/extraer:', error);
    return NextResponse.json({ error: 'Error al interpretar el texto' }, { status: 500 });
  }
}

/** Ítem listo para mostrar en el borrador: con fechas exactas y lo que falta. */
function armarItemBorrador(item: ItemExtraido, ahora: Date, zona: string) {
  const base = {
    ...item,
    inicio: null as string | null,
    fin: null as string | null,
    horaDefinida: false,
    supuestos: [] as string[],
    opcionesFecha: null as { etiqueta: string; fecha: string }[] | null,
    faltantes: [] as string[],
  };

  if (item.clase === 'evento_fijo') {
    if (item.diasSemana.length === 0) base.faltantes.push('dias');
    if (!item.hora) base.faltantes.push('hora');
    base.horaDefinida = item.hora !== null;
    return base;
  }

  const tipoHora = item.clase === 'tarea' ? item.tipo ?? 'tarea' : 'evento';
  const r = resolverFecha(item.fechaDicha, item.hora, tipoHora, ahora, zona);

  if (r.estado === 'falta') {
    base.faltantes.push('fecha');
    return base;
  }
  base.horaDefinida = r.horaDefinida;
  base.supuestos = r.supuestos;

  if (r.estado === 'ambigua') {
    base.faltantes.push('fecha');
    base.opcionesFecha = r.opciones.map((o) => ({ etiqueta: o.etiqueta, fecha: o.fecha.toISOString() }));
    return base;
  }

  base.inicio = r.fecha.toISOString();
  if (item.clase === 'evento' && item.horaFin) {
    const f = resolverFecha(item.fechaDicha, item.horaFin, 'evento', ahora, zona);
    if (f.estado === 'ok') base.fin = f.fecha.toISOString();
  }
  return base;
}