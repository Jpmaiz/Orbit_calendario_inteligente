import { NextRequest, NextResponse } from 'next/server';
import { ia, modeloIA } from '@/lib/ia';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { resolverFecha } from '@/lib/fechas/resolverFecha';
import type { ItemExtraido } from '@/lib/ia/extraccion';
import { periodoVigente } from '@/lib/periodos/periodos';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';
import {
  proponerMateria, proponerHoraDesdeHorario, choquesDeEvento, revisarClase, nombreDia, normalizarNombre,
  type ClaseFija, type EventoPuntual,
} from '@/lib/borrador/enriquecer';

const DIA_MS = 86_400_000;

/**
 * POST /api/ia/extraer   Body: { texto }
 * Devuelve un BORRADOR enriquecido. NO guarda nada.
 * - La IA desmenuza el texto en ítems.
 * - El sistema calcula fechas, propone materia, propone hora desde el horario,
 *   asigna vigencia a las clases y detecta duplicados y choques.
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
    const [usuario, materias, alias, clases, eventos, periodo] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: user.id }, select: { zonaHoraria: true } }),
      prisma.materia.findMany({
        where: { usuarioId: user.id, eliminadoEn: null }, select: { id: true, nombre: true, codigo: true },
      }),
      prisma.aliasMateria.findMany({ where: { usuarioId: user.id }, select: { alias: true, materiaId: true } }),
      prisma.eventoFijo.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        select: { id: true, titulo: true, materiaId: true, diaSemana: true, horaInicio: true, horaFin: true, vigenteDesde: true, vigenteHasta: true },
      }),
      prisma.evento.findMany({
        where: { usuarioId: user.id, eliminadoEn: null, inicio: { gte: new Date(ahora.getTime() - DIA_MS), lte: new Date(ahora.getTime() + 365 * DIA_MS) } },
        select: { id: true, titulo: true, inicio: true, fin: true },
      }),
      periodoVigente(user.id, ahora),
    ]);
    const zona: string = usuario?.zonaHoraria ?? 'America/La_Paz';

    // 1) La IA desmenuza
    const inicio = Date.now();
    const items: ItemExtraido[] = await ia.extraerItems(texto, {
      ahora, zonaHoraria: zona, materias: materias.map((m: { nombre: string }) => m.nombre),
    });
    const latencia = Date.now() - inicio;

    // Clases que vienen en el mismo texto (para proponer la hora de un examen de esa materia)
    const clasesDelTexto = items
      .filter((i) => i.clase === 'evento_fijo')
      .map((i) => ({
        materiaClave: i.materia ? normalizarNombre(i.materia) : null,
        diasSemana: i.diasSemana, hora: i.hora, horaFin: i.horaFin, titulo: i.titulo,
      }));

    // 2) El sistema decide
    const borrador = [];
    for (const item of items) {
      const base = armarFechas(item, ahora, zona);
      const materiaPropuesta = proponerMateria(item.materia, item.codigoMateria, materias, alias);
      const materiaClave = item.materia ? normalizarNombre(item.materia) : null;
      const inicioItem = base.inicio ? new Date(base.inicio) : null;

      let horaPropuesta = null;
      let duplicado: Record<string, unknown> | null = null;
      let choques: { titulo: string; cuando: string }[] = [];
      let vigencia: { desde: string; hasta: string; periodo: string } | null = null;

      if (item.clase === 'tarea' && inicioItem) {
        // Examen o exposición sin hora → ¿es en horario de clase?
        if (!base.horaDefinida && (item.tipo === 'examen' || item.tipo === 'exposicion')) {
          horaPropuesta = proponerHoraDesdeHorario(
            inicioItem, zona, materiaPropuesta, clases as ClaseFija[], clasesDelTexto, materiaClave,
          );
        }
        // ¿Ya existe?
        const dup = await buscarDuplicada(user.id, {
          titulo: item.titulo,
          fechaLimite: inicioItem,
          materiaId: materiaPropuesta.accion === 'vincular' ? materiaPropuesta.materiaId : null,
          materiaNombre: item.materia,
        });
        if (dup.estado !== 'nuevo') {
          duplicado = {
            tipoDuplicado: dup.estado,
            similitud: dup.similitud,
            tarea: dup.tarea,
            pregunta: preguntaDuplicado(dup.tarea),
            sugerenciasDiferencia: DIFERENCIAS_POR_TIPO[item.tipo ?? 'tarea'] ?? [],
          };
        }
      }

      if (item.clase === 'evento' && inicioItem) {
        choques = choquesDeEvento(
          inicioItem, base.fin ? new Date(base.fin) : null, zona, clases as ClaseFija[], eventos as EventoPuntual[],
        );
      }

      if (item.clase === 'evento_fijo') {
        if (periodo) {
          vigencia = { desde: periodo.inicio.toISOString(), hasta: periodo.fin.toISOString(), periodo: periodo.nombre };
        } else {
          base.faltantes.push('periodo'); // el front pregunta "¿Cuándo termina tu semestre?"
        }
        if (item.hora && item.horaFin) {
          const r = revisarClase(
            item.diasSemana, item.hora, item.horaFin, item.titulo,
            materiaPropuesta.accion === 'vincular' ? materiaPropuesta.materiaId : null,
            clases as ClaseFija[], ahora,
          );
          choques = r.choques;
          if (r.existentes.length > 0) {
            const dias = r.existentes.map(nombreDia).join(' y ');
            duplicado = {
              tipoDuplicado: r.existentes.length === item.diasSemana.length ? 'seguro' : 'parcial',
              diasExistentes: r.existentes,
              pregunta: `Ya tienes «${item.titulo}» los ${dias} de ${item.hora} a ${item.horaFin}.`,
            };
          }
        }
      }

      borrador.push({ ...base, materiaPropuesta, horaPropuesta, vigencia, duplicado, choques });
    }

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

    return NextResponse.json({
      interpretacionId: registro.id, // se reenvía a /api/ia/confirmar
      items: borrador,
      periodo: periodo ? { nombre: periodo.nombre, inicio: periodo.inicio, fin: periodo.fin } : null,
      advertencias: items.length === 0 ? ['No encontré ninguna actividad en el texto.'] : [],
    });
  } catch (error) {
    console.error('Error en /api/ia/extraer:', error);
    return NextResponse.json({ error: 'Error al interpretar el texto' }, { status: 500 });
  }
}

/** Calcula fechas exactas y lo que falta de un ítem (las fechas las decide el sistema, no la IA). */
function armarFechas(item: ItemExtraido, ahora: Date, zona: string) {
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