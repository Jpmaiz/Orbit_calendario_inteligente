/**
 * Lo que devuelven GET /api/agenda y GET /api/tareas, en funciones compartidas: las usan las rutas y también
 * las páginas del servidor (/dia manda el día ya cargado en el HTML, sin esperar otra vuelta a la base).
 */
import { prisma } from '@/lib/prisma/cliente';
import { tareaPublica } from '@/lib/estimacion/publico';
import { cargarResumenPlanes } from '@/lib/plan/cargar';
import { diaEnZona } from '@/lib/periodos/periodos';
import { cerrarVencidas } from '@/lib/tareas/cierre';
import { zonaDeUsuario } from '@/lib/usuarios/zona';
import { ritmoDeUsuario } from '@/lib/usuarios/zona';
import { CONFIG_PRIORIDAD, priorizarTareas } from '@/lib/prioridad';
import { cargarDisponibilidad } from '@/lib/plan/disponibilidad';

const DIA_MS = 86_400_000;
const MAX_DIAS = 62;

/**
 * Agenda del rango (fechas AAAA-MM-DD en la zona del usuario, ambos días incluidos): clases vigentes, eventos,
 * tareas que vencen en el rango (con estimado y plan) y bloques de estudio. Ver GET /api/agenda.
 */
export async function cargarAgenda(usuarioId: string, desdeTxt: string | null, hastaTxt: string | null) {
  const [zonaHoraria, ritmo] = await Promise.all([zonaDeUsuario(usuarioId), ritmoDeUsuario(usuarioId)]);
  const zona: string = zonaHoraria;

  const desde = desdeTxt ? diaEnZona(desdeTxt, '00:00', zona) : null;
  const hastaInicio = hastaTxt ? diaEnZona(hastaTxt, '00:00', zona) : null;
  if (!desde || !hastaInicio) {
    return { ok: false as const, status: 400, error: 'Usa ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD' };
  }
  const hasta = new Date(hastaInicio.getTime() + DIA_MS - 1); // hasta el final de ese día
  const dias = (hasta.getTime() - desde.getTime()) / DIA_MS;
  if (dias <= 0 || dias > MAX_DIAS) {
    return { ok: false as const, status: 400, error: `El rango debe ser de 1 a ${MAX_DIAS} días` };
  }

  await cerrarVencidas(usuarioId); // lo que ya pasó se da por hecho (Fase 3)
  const materia = { select: { id: true, nombre: true, color: true } };
  const [clases, eventos, tareas, bloques, planes] = await Promise.all([
    prisma.eventoFijo.findMany({
      where: {
        usuarioId: usuarioId,
        eliminadoEn: null,
        // vigente en algún momento del rango (sin fechas = siempre vigente)
        AND: [
          { OR: [{ vigenteDesde: null }, { vigenteDesde: { lte: hasta } }] },
          { OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }] },
        ],
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      include: { materia },
    }),
    prisma.evento.findMany({
      where: {
        usuarioId: usuarioId,
        eliminadoEn: null,
        inicio: { lte: hasta },
        OR: [{ fin: { gte: desde } }, { fin: null, inicio: { gte: desde } }],
      },
      orderBy: { inicio: 'asc' },
      include: { materia },
    }),
    prisma.tarea.findMany({
      where: { usuarioId: usuarioId, eliminadoEn: null, fechaLimite: { gte: desde, lte: hasta } },
      orderBy: { fechaLimite: 'asc' },
      include: { materia },
    }),
    prisma.sugerencia.findMany({
      where: {
        usuarioId: usuarioId,
        estado: { in: ['aceptada', 'cumplida'] },
        fechaInicio: { lte: hasta },
        fechaFin: { gte: desde },
        tarea: { eliminadoEn: null },
      },
      orderBy: { fechaInicio: 'asc' },
      select: {
        id: true, fechaInicio: true, fechaFin: true, motivo: true, estado: true,
        tarea: { select: { id: true, titulo: true, tipo: true, materia } },
      },
    }),
    cargarResumenPlanes(usuarioId),
  ]);

  return { ok: true as const, datos: {
    desde, hasta, zonaHoraria: zona, clases, eventos,
    // Sin la estimación interna; con estimado { horas, carga, razones } (D21)
    // plan: resumen de TODOS sus bloques (también fuera del rango pedido)
    tareas: tareas.map((t) => ({ ...tareaPublica(t), plan: planes.get(t.id) ?? null })),
    // Horario de estudio del usuario ("Mi ritmo"): el que usa Orbit para huecos, sugerencias y horas libres
    ventana: { desde: ritmo.desde, hasta: ritmo.hasta, diasLibres: ritmo.diasLibres, maxHorasDia: ritmo.maxHorasDia },
    bloques: bloques.map((b) => ({
      id: b.id, inicio: b.fechaInicio, fin: b.fechaFin, tipo: b.motivo, estado: b.estado, tarea: b.tarea,
    })),
  } };
}

/** Todas las tareas del usuario, priorizadas, con estimado, plan y horas libres. Ver GET /api/tareas. */
export async function cargarTareas(usuarioId: string) {
  // Lo que ya pasó se da por hecho (Fase 3): el usuario no tiene que marcar nada
  await cerrarVencidas(usuarioId);
  // La lista, el tiempo libre real y los planes van en paralelo (la base está lejos: cada ronda de consultas pesa).
  const [tareas, libre, planes] = await Promise.all([
    prisma.tarea.findMany({
      where: { usuarioId, eliminadoEn: null },
      orderBy: { fechaLimite: 'asc' },
      include: { materia: { select: { id: true, nombre: true, color: true } } },
    }),
    cargarDisponibilidad(usuarioId).catch((error) => {
      console.error('Tiempo libre: se usa el promedio por defecto', error);
      return null;
    }),
    cargarResumenPlanes(usuarioId),
  ]);
  const ahora = new Date();
  const horasEstudioPorDia = libre?.horasPorDia ?? CONFIG_PRIORIDAD.horasEstudioPorDia;
  const priorizadas = priorizarTareas(tareas, ahora, { ...CONFIG_PRIORIDAD, horasEstudioPorDia }, libre ? {
    libresHasta: (fin) => libre.libresHasta(fin, ahora),
    planificadas: (t) => libre.planificadas(t.id, new Date(t.fechaLimite), ahora),
  } : undefined);
  return {
    tareas: priorizadas.map((t) => ({ ...tareaPublica(t), plan: planes.get(t.id) ?? null })),
    horasEstudioPorDia,
  };
}
