import type { CargaEstudio, Estimado, EstimacionTarea } from '@/tipos/tarea';

function carga(valor: unknown): CargaEstudio | null {
  return valor === 'ligera' || valor === 'media' || valor === 'pesada' ? valor : null;
}
/** Solo la proyección pública del borrador: nunca copiar la rúbrica ni sus razones. */
export function leerEstimado(valor: unknown): Estimado | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const e = valor as Record<string, unknown>;
  if (typeof e.horas !== 'number' || !Number.isFinite(e.horas) || e.horas <= 0) return null;
  return { horas: e.horas, carga: carga(e.carga) };
}
/** Tarea guardada (v2.9): el back manda estimado { horas, carga, razones } o null. */
export function leerEstimacionTarea(datos: Record<string, unknown>): EstimacionTarea {
  const duracion = datos.duracionEstMin;
  const minutos = typeof duracion === 'number' && Number.isInteger(duracion) && duracion > 0 ? duracion : null;
  const base = leerEstimado(datos.estimado);
  const e = datos.estimado as Record<string, unknown> | null | undefined;
  const razones = Array.isArray(e?.razones)
    ? e.razones.filter((r): r is string => typeof r === 'string' && !!r.trim()).slice(0, 3) : [];
  return {
    duracionEstMin: minutos,
    horasDelUsuario: typeof datos.horasDelUsuario === 'boolean' ? datos.horasDelUsuario : undefined,
    estimado: base ? { ...base, razones } : null,
  };
}
export function formatearHoras(horas: number): string | null {
  if (!Number.isFinite(horas) || horas < 0) return null;
  const minutos = Math.round(horas * 60);
  const h = Math.floor(minutos / 60), m = minutos % 60;
  return '~' + (h ? h + ' h' + (m ? ' ' + m : '') : minutos + ' min');
}
/** El formulario presenta horas; el contrato sigue recibiendo minutos enteros. */
export function minutosDesdeHoras(valor: string): number | null {
  if (!valor.trim()) return null;
  const horas = Number(valor);
  if (!Number.isFinite(horas) || horas <= 0 || horas > 100) return NaN;
  const minutos = Math.round(horas * 60);
  return minutos >= 1 ? minutos : NaN;
}
