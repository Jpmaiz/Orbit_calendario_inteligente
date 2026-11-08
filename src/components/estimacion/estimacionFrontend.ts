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
export function leerEstimacionTarea(datos: Record<string, unknown>): EstimacionTarea {
  const duracion = datos.duracionEstMin;
  const minutos = typeof duracion === 'number' && Number.isInteger(duracion) && duracion > 0 ? duracion : null;
  const d = datos.dificultad;
  // Misma correspondencia que cargaDe en la rúbrica de JP; sin inferir una dificultad.
  const nivel = d === null ? 'media' : typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 5
    ? d <= 2 ? 'ligera' : d >= 4 ? 'pesada' : 'media' : null;
  return {
    duracionEstMin: minutos,
    horasDelUsuario: typeof datos.horasDelUsuario === 'boolean' ? datos.horasDelUsuario : undefined,
    // La duración vigente manda, incluso si el JSON interno conserva una estimación anterior.
    estimado: minutos === null ? null : { horas: minutos / 60, carga: nivel },
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
