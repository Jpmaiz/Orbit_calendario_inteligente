/**
 * Lee de la base lo que necesita el planificador (Fase 2): clases, eventos y bloques de estudio ya aceptados.
 * El cálculo vive en huecos.ts y planificador.ts (código puro).
 */
import { prisma } from '@/lib/prisma/cliente';
import { zonaDeUsuario } from '@/lib/usuarios/zona';
import { ritmoDeUsuario } from '@/lib/usuarios/zona';
import type { Ritmo } from '@/lib/usuarios/ritmo';
import { resumirBloques } from './resumen';
import { CONFIG_HUECOS, huecosLibres, ocupacionesDeClases, diaLocal, claveDia, type Ocupacion, type HuecosDelDia } from './huecos';

const HORA_MS = 3_600_000;

/** Estados de un bloque de estudio (tabla Sugerencia). "aceptada" = está en el calendario. */
export const ESTADOS_BLOQUE = ['aceptada', 'cumplida', 'omitida'] as const;

export type BloqueGuardado = { id: string; inicio: Date; fin: Date; tipo: string; estado: string; origen: string | null };

export type ContextoDeUsuario = {
  zona: string;
  ocupaciones: Ocupacion[];                  // clases, eventos y bloques de OTRAS actividades
  dias: HuecosDelDia[];
  minutosMateriaPorDia: Map<string, number>;
  minutosEstudioPorDia: Map<string, number>;
  propios: BloqueGuardado[];                 // TODOS los bloques futuros aceptados de esta actividad
  /** "Mi ritmo" del usuario: horario de estudio, tope por día, días libres y franja preferida. */
  ritmo: Ritmo;
  /** Bloques aceptados del rango, de todas las actividades (para descontar lo ya planificado). */
  bloquesAceptados?: { tareaId: string; inicio: Date; fin: Date }[];
};

/**
 * @param tareaId actividad que se planifica: sus propios bloques NO cuentan como ocupados (se pueden rehacer)
 * @param materiaId para el tope de 2 h por materia y día
 */
export async function cargarContextoPlan(
  usuarioId: string, desde: Date, hasta: Date, ahora: Date, tareaId?: string, materiaId?: string | null,
): Promise<ContextoDeUsuario> {
  const [zona, clases, eventos, bloques, propiosFuturos, examenes, ritmo] = await Promise.all([
    zonaDeUsuario(usuarioId),
    prisma.eventoFijo.findMany({
      where: {
        usuarioId, eliminadoEn: null,
        AND: [
          { OR: [{ vigenteDesde: null }, { vigenteDesde: { lte: hasta } }] },
          { OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }] },
        ],
      },
      select: { titulo: true, diaSemana: true, horaInicio: true, horaFin: true, vigenteDesde: true, vigenteHasta: true },
    }),
    prisma.evento.findMany({
      where: {
        usuarioId, eliminadoEn: null, inicio: { lte: hasta },
        OR: [{ fin: { gte: desde } }, { fin: null, inicio: { gte: new Date(desde.getTime() - HORA_MS) } }],
      },
      select: { titulo: true, inicio: true, fin: true },
    }),
    prisma.sugerencia.findMany({
      where: {
        usuarioId, estado: 'aceptada', fechaInicio: { lte: hasta }, fechaFin: { gte: desde },
        tarea: { eliminadoEn: null },
      },
      select: { id: true, tareaId: true, fechaInicio: true, fechaFin: true, motivo: true, estado: true, tarea: { select: { titulo: true, materiaId: true } } },
      orderBy: { fechaInicio: 'asc' },
    }),
    // Los bloques propios se traen TODOS los futuros, sin tope: si la fecha se adelantó, los que quedaron
    // después siguen visibles (y salen como conflicto) para poder quitarlos o reemplazarlos.
    tareaId
      ? prisma.sugerencia.findMany({
          where: { usuarioId, tareaId, estado: 'aceptada', fechaFin: { gt: ahora } },
          select: { id: true, fechaInicio: true, fechaFin: true, motivo: true, estado: true, origen: true },
          orderBy: { fechaInicio: 'asc' },
        })
      : Promise.resolve([]),
    // Exámenes y exposiciones con hora y duración conocidas: ese tramo está ocupado (no se estudia encima)
    prisma.tarea.findMany({
      where: {
        usuarioId, eliminadoEn: null, tipo: { in: ['examen', 'exposicion'] }, horaDefinida: true, duracionMin: { not: null },
        fechaLimite: { gte: new Date(desde.getTime() - 10 * HORA_MS), lte: hasta },
        ...(tareaId ? { id: { not: tareaId } } : {}),
      },
      select: { titulo: true, fechaLimite: true, duracionMin: true },
    }),
    ritmoDeUsuario(usuarioId),
  ]);

  const ajenos = bloques.filter((b) => b.tareaId !== tareaId);
  const ocupaciones: Ocupacion[] = [
    ...ocupacionesDeClases(clases, desde, hasta, zona),
    ...eventos.map((e) => ({ inicio: e.inicio, fin: e.fin ?? new Date(e.inicio.getTime() + HORA_MS), titulo: e.titulo })),
    ...ajenos.map((b) => ({ inicio: b.fechaInicio, fin: b.fechaFin, titulo: `Estudio: ${b.tarea.titulo}` })),
    ...examenes.map((t) => ({ inicio: t.fechaLimite, fin: new Date(t.fechaLimite.getTime() + t.duracionMin! * 60_000), titulo: t.titulo })),
  ];

  const minutosMateriaPorDia = new Map<string, number>();
  const minutosEstudioPorDia = new Map<string, number>();
  for (const b of ajenos) {
    const dia = claveDia(diaLocal(b.fechaInicio, zona));
    const min = Math.round((b.fechaFin.getTime() - b.fechaInicio.getTime()) / 60_000);
    minutosEstudioPorDia.set(dia, (minutosEstudioPorDia.get(dia) ?? 0) + min);
    if (materiaId && b.tarea.materiaId === materiaId) minutosMateriaPorDia.set(dia, (minutosMateriaPorDia.get(dia) ?? 0) + min);
  }

  return {
    zona,
    ocupaciones,
    // Huecos dentro del horario de estudio del usuario; sus días libres no tienen huecos
    dias: huecosLibres(desde, hasta, ocupaciones, zona, ahora, { ...CONFIG_HUECOS, franjaInicio: ritmo.desde, franjaFin: ritmo.hasta })
      .map((d) => (ritmo.diasLibres.includes(d.diaSemana) ? { ...d, huecos: [], libresMin: 0 } : d)),
    ritmo,
    minutosMateriaPorDia,
    minutosEstudioPorDia,
    propios: propiosFuturos.map((b) => ({ id: b.id, inicio: b.fechaInicio, fin: b.fechaFin, tipo: b.motivo, estado: b.estado, origen: b.origen })),
    bloquesAceptados: bloques.map((b) => ({ tareaId: b.tareaId, inicio: b.fechaInicio, fin: b.fechaFin })),
  };
}

/** Resumen del plan de cada actividad del usuario (todos sus bloques aceptados o cumplidos). */
export async function cargarResumenPlanes(usuarioId: string, ahora: Date = new Date()) {
  const filas = await prisma.sugerencia.findMany({
    where: { usuarioId, estado: { in: ['aceptada', 'cumplida'] }, tarea: { eliminadoEn: null } },
    select: { tareaId: true, fechaInicio: true, fechaFin: true },
  });
  return resumirBloques(filas.map((f) => ({ tareaId: f.tareaId, inicio: f.fechaInicio, fin: f.fechaFin })), ahora);
}

/** Bloques que pisan una ocupación (una clase o evento nuevo cayó encima): hay que ofrecer moverlos. */
export function bloquesEnConflicto(propios: BloqueGuardado[], ocupaciones: Ocupacion[], limite: Date) {
  return propios.flatMap((b) => {
    if (b.fin > limite) return [{ id: b.id, motivo: 'Termina después de la fecha de la actividad' }];
    const choca = ocupaciones.find((o) => b.inicio < o.fin && o.inicio < b.fin);
    return choca ? [{ id: b.id, motivo: `Se cruza con «${choca.titulo}»` }] : [];
  });
}
