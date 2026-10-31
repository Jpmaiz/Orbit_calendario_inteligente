import { NextRequest, NextResponse } from 'next/server';
import { ia, modeloIA } from '@/lib/ia';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import type { ItemExtraido } from '@/lib/ia/extraccion';
import { avisosFechasPasadas, cargarContexto, construirBorrador } from '@/lib/borrador/construirBorrador';

/**
 * POST /api/ia/extraer   Body: { texto }
 * Devuelve un BORRADOR enriquecido. NO guarda nada.
 * - La IA desmenuza el texto en ítems.
 * - El sistema calcula fechas, propone materia, propone hora desde el horario,
 *   asigna vigencia a las clases y detecta duplicados y choques (ver construirBorrador).
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
    const ahora = new Date();
    const ctx = await cargarContexto(user.id, ahora);

    // 1) La IA desmenuza
    const inicio = Date.now();
    const items: ItemExtraido[] = (
      await ia.extraerItems(texto, { ahora, zonaHoraria: ctx.zona, materias: ctx.materias.map((m) => m.nombre) })
    ).map((i) => ({ ...i, fechaReferencia: null })); // en un texto, "mañana" siempre se cuenta desde hoy
    const latencia = Date.now() - inicio;

    // 2) El sistema decide
    const borrador = await construirBorrador(user.id, items, ctx, { ahora });

    const registro = await prisma.interpretacionIA.create({
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

    const { periodo } = ctx;
    return NextResponse.json({
      interpretacionId: registro.id, // se reenvía a /api/ia/confirmar
      items: borrador,
      periodo: periodo ? { nombre: periodo.nombre, inicio: periodo.inicio, fin: periodo.fin } : null,
      advertencias: items.length === 0
        ? ['No encontré ninguna actividad en el texto.']
        : avisosFechasPasadas(borrador, ahora, ctx.zona),
    });
  } catch (error) {
    console.error('Error en /api/ia/extraer:', error);
    return NextResponse.json({ error: 'Error al interpretar el texto' }, { status: 500 });
  }
}
