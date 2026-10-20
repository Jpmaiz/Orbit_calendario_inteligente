import type { ResultadoPrioridad } from '@/lib/prioridad';

export type PrioridadCalculada = ResultadoPrioridad;
export type Dificultad = 1 | 2 | 3 | 4 | 5 | null;
export type EstadoTarea = 'pendiente' | 'en_proceso' | 'completada' | 'no_realizada';

export function esDificultad(valor: unknown): valor is Dificultad {
  return valor === null || (typeof valor === 'number' && Number.isInteger(valor) && valor >= 1 && valor <= 5);
}
