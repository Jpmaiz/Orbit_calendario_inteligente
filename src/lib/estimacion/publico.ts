/**
 * Lo que el front ve de la estimación de una tarea ya guardada (D18 y D21).
 * Tarea.estimacion es interna (lectura de la rúbrica, dificultad, factor personal): nunca sale tal cual.
 */
import { cargaDe, razonesParaUsuario, type Carga, type LecturaEstimacion } from './rubrica';

export type EstimadoPublico = { horas: number; carga: Carga; razones: string[] };

type TareaConEstimacion = {
  tipo: string;
  duracionEstMin: number | null;
  dificultad?: number | null;
  horasDelUsuario?: boolean;
  estimacion?: unknown;
};

/** La lectura guardada tiene la forma que espera la rúbrica (por si quedó una de una versión vieja). */
function lecturaValida(v: unknown): LecturaEstimacion | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const l = v as Record<string, unknown>;
  if (!Array.isArray(l.temas) || !l.cantidades || typeof l.cantidades !== 'object' || typeof l.nivelCognitivo !== 'number') return null;
  return l as unknown as LecturaEstimacion;
}

/**
 * { horas, carga, razones } de una tarea guardada; null si no tiene horas.
 * - razones: [] si las horas las puso el usuario o si la tarea no pasó por la estimación (creada a mano).
 * - Tareas viejas (desde la v2.4) también tienen razones: se calculan con la lectura guardada.
 */
export function estimadoPublico(t: TareaConEstimacion): EstimadoPublico | null {
  if (!t.duracionEstMin || t.duracionEstMin <= 0) return null;
  const e = (t.estimacion && typeof t.estimacion === 'object' ? t.estimacion : null) as
    | { lectura?: unknown; origen?: unknown; dificultad?: unknown } | null;
  const dificultad = t.dificultad ?? (typeof e?.dificultad === 'number' ? e.dificultad : null);
  let razones: string[] = [];
  if (!t.horasDelUsuario && e) {
    const lectura = lecturaValida(e.lectura);
    if (lectura) razones = razonesParaUsuario(t.tipo, lectura);
    else if (e.origen === 'general') razones = razonesParaUsuario(t.tipo, null);
  }
  return { horas: Math.round((t.duracionEstMin / 60) * 100) / 100, carga: cargaDe(dificultad), razones };
}

/** La tarea como la ve el front: sin la estimación interna y con `estimado`. */
export function tareaPublica<T extends TareaConEstimacion>(t: T): Omit<T, 'estimacion'> & { estimado: EstimadoPublico | null } {
  const { estimacion: _interna, ...resto } = t;
  void _interna;
  return { ...resto, estimado: estimadoPublico(t) };
}
