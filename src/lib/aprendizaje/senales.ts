/**
 * Señales de aprendizaje (Fase 3): se guardan cuando el usuario hace algo que ya hace en la app.
 * Nunca se le pide marcar nada. El cálculo vive en src/lib/estimacion/personal.ts.
 *
 * clase "horas":    razon = horas reales ÷ horas del estudiante promedio (estimacion.horasPromedio)
 * clase "franja":   voto por un momento del día (columna franja: manana | mediodia | tarde | noche), ver energia.ts
 * clase "pregunta": la pregunta semanal ya se mostró para esa actividad (peso 0: solo para no repetir)
 * clase "animo":    "¿Cómo estás hoy?" (fuente = energia | normal | cansado, peso 0: no cambia horas ni momentos)
 * clase "aviso":    una sugerencia ya mostrada (fuente = energia | cansancio): no se repite en 60 días
 */
import { prisma } from '@/lib/prisma/cliente';
import type { SenalHoras } from '@/lib/estimacion/personal';
import type { VotoMomento } from '@/lib/aprendizaje/energia';
import { MOMENTOS, type Momento } from '@/lib/usuarios/ritmo';

export const FUENTES = { plan: 0.5, edicion: 1, respuesta: 1 } as const;
export type Fuente = keyof typeof FUENTES;

const AÑO_MS = 365 * 86_400_000;
const DIA_MS = 86_400_000;

/** Horas del estudiante promedio de una tarea (sin el factor personal). null si no hay estimación. */
export function horasPromedioDe(t: { estimacion: unknown; duracionEstMin: number | null }): number | null {
  const e = t.estimacion as { horasPromedio?: unknown; horas?: unknown } | null;
  if (e && typeof e.horasPromedio === 'number' && e.horasPromedio > 0) return e.horasPromedio;
  if (e && typeof e.horas === 'number' && e.horas > 0) return e.horas;
  return null;
}

/**
 * Guarda una señal de horas. Por actividad y fuente queda solo la última (cambiar varias veces no suma datos).
 */
export async function registrarHoras(
  usuarioId: string,
  tarea: { id: string; materiaId: string | null; tipo: string; estimacion: unknown; duracionEstMin: number | null },
  horasReales: number,
  fuente: Fuente,
) {
  const promedio = horasPromedioDe(tarea);
  if (!promedio || !(horasReales > 0)) return null;
  await prisma.senalAprendizaje.deleteMany({ where: { usuarioId, tareaId: tarea.id, clase: 'horas', fuente } });
  return prisma.senalAprendizaje.create({
    data: {
      usuarioId, tareaId: tarea.id, materiaId: tarea.materiaId, tipoTarea: tarea.tipo,
      clase: 'horas', fuente, razon: Math.round((horasReales / promedio) * 1000) / 1000, peso: FUENTES[fuente],
    },
  });
}

/** Guarda los votos por momento del día que deja guardar un plan (energia.ts: votosDelPlan). */
export async function registrarMomentos(usuarioId: string, tareaId: string, votos: { momento: Momento; voto: number; peso: number }[]) {
  // Por actividad cuenta solo el último plan guardado: reintentar o guardar de nuevo no duplica votos
  await prisma.senalAprendizaje.deleteMany({ where: { usuarioId, tareaId, clase: 'franja' } });
  if (!votos.length) return;
  await prisma.senalAprendizaje.createMany({
    data: votos.map((v) => ({ usuarioId, tareaId, clase: 'franja', fuente: 'plan', franja: v.momento, voto: v.voto, peso: v.peso })),
  });
}

/** Señales del último año, listas para personal.ts (horas) y energia.ts (momentos). */
export async function cargarAprendizaje(usuarioId: string, ahora: Date = new Date()): Promise<{ horas: SenalHoras[]; momentos: VotoMomento[] }> {
  const filas = await prisma.senalAprendizaje.findMany({
    where: { usuarioId, clase: { in: ['horas', 'franja'] }, creadoEn: { gte: new Date(ahora.getTime() - AÑO_MS) } },
    orderBy: { creadoEn: 'desc' },
    take: 1000,
    select: { clase: true, razon: true, peso: true, materiaId: true, tipoTarea: true, franja: true, voto: true, creadoEn: true },
  });
  return {
    horas: filas
      .filter((f) => f.clase === 'horas' && f.razon !== null)
      .map((f) => ({ razon: f.razon!, peso: f.peso, materiaId: f.materiaId, tipoTarea: f.tipoTarea, creadoEn: f.creadoEn })),
    momentos: filas
      .filter((f) => f.clase === 'franja' && f.voto !== null && MOMENTOS.includes(f.franja as Momento))
      .map((f) => ({ momento: f.franja as Momento, voto: f.voto!, peso: f.peso, creadoEn: f.creadoEn })),
  };
}

/** ¿Ya se mostró esta sugerencia en los últimos `dias` días? */
export async function avisoReciente(usuarioId: string, fuente: 'energia' | 'cansancio', dias: number, ahora: Date = new Date()) {
  const fila = await prisma.senalAprendizaje.findFirst({
    where: { usuarioId, clase: 'aviso', fuente, creadoEn: { gte: new Date(ahora.getTime() - dias * DIA_MS) } },
    select: { id: true },
  });
  return fila !== null;
}

/** Deja constancia de que una sugerencia se mostró (si el usuario la ignora, no vuelve en 60 días). */
export async function registrarAviso(usuarioId: string, fuente: 'energia' | 'cansancio') {
  await prisma.senalAprendizaje.create({ data: { usuarioId, clase: 'aviso', fuente, peso: 0 } });
}
