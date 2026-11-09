/**
 * Señales de aprendizaje (Fase 3): se guardan cuando el usuario hace algo que ya hace en la app.
 * Nunca se le pide marcar nada. El cálculo vive en src/lib/estimacion/personal.ts.
 *
 * clase "horas":    razon = horas reales ÷ horas del estudiante promedio (estimacion.horasPromedio)
 * clase "franja":   voto +1 (puso un bloque en esa franja) o −1 (sacó uno de ahí)
 * clase "pregunta": la pregunta semanal ya se mostró para esa actividad (peso 0: solo para no repetir)
 */
import { prisma } from '@/lib/prisma/cliente';
import type { SenalFranja, SenalHoras } from '@/lib/estimacion/personal';
import type { Franja } from '@/lib/plan/planificador';

export const FUENTES = { plan: 0.5, edicion: 1, respuesta: 1 } as const;
export type Fuente = keyof typeof FUENTES;

const FRANJAS: Franja[] = ['manana', 'tarde', 'noche'];
const AÑO_MS = 365 * 86_400_000;

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

/** Guarda votos de franja (bloques que el usuario puso o sacó respecto de lo que Orbit propuso). */
export async function registrarFranjas(usuarioId: string, tareaId: string, votos: { franja: Franja; voto: number }[]) {
  // Por actividad cuenta solo el último plan guardado: reintentar o guardar de nuevo no duplica votos
  await prisma.senalAprendizaje.deleteMany({ where: { usuarioId, tareaId, clase: 'franja' } });
  if (!votos.length) return;
  await prisma.senalAprendizaje.createMany({
    data: votos.map((v) => ({ usuarioId, tareaId, clase: 'franja', fuente: 'plan', franja: v.franja, voto: v.voto, peso: FUENTES.plan })),
  });
}

/** Señales del último año, listas para personal.ts. */
export async function cargarAprendizaje(usuarioId: string, ahora: Date = new Date()): Promise<{ horas: SenalHoras[]; franjas: SenalFranja[] }> {
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
    franjas: filas
      .filter((f) => f.clase === 'franja' && f.voto !== null && FRANJAS.includes(f.franja as Franja))
      .map((f) => ({ franja: f.franja as Franja, voto: f.voto!, peso: f.peso, creadoEn: f.creadoEn })),
  };
}
