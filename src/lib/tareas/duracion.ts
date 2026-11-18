/**
 * Duración de exámenes y exposiciones (lo que dura el examen, NO las horas de estudio = duracionEstMin).
 * Código puro: se prueba con scripts/probar-duracion.ts. Sin dato, null: nunca se inventa una duración.
 */
export const TIPOS_CON_DURACION = ['examen', 'exposicion'] as const;
export const DURACION_MAX_MIN = 600;

export const tieneDuracion = (tipo: string | null | undefined) => (TIPOS_CON_DURACION as readonly string[]).includes(tipo ?? '');

const aMin = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const valida = (m: number) => (Number.isInteger(m) && m >= 1 && m <= DURACION_MAX_MIN ? m : null);

/** "10:00" → "12:00" = 120. null si no hay fin o el fin no es posterior. */
export function duracionEntre(hora: string | null, horaFin: string | null): number | null {
  if (!hora || !horaFin) return null;
  return valida(aMin(horaFin) - aMin(hora));
}

/**
 * "2 h", "2 horas", "90 min", "1 h 30", "1:30 h", "hora y media", "dura 2 h" → minutos.
 * null si es por grupo o por persona ("15 min por grupo"): eso no es lo que dura para el usuario.
 */
export function duracionDeTexto(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\b(por|cada)\s+(grupo|persona|equipo|estudiante|alumno)|c\/u\b/.test(t)) return null;
  if (/\bhora y media\b/.test(t)) return 90;
  if (/\bmedia hora\b/.test(t)) return 30;
  const hm = t.match(/(\d{1,2}):(\d{2})\s*(h|hr|hrs|hora|horas)\b/);
  if (hm) return valida(+hm[1] * 60 + +hm[2]);
  const hyM = t.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:h|hr|hrs|hora|horas)\b(?:\s*(?:y\s*)?(\d{1,2})\s*(?:min|minutos)?\b)?/);
  if (hyM) return valida(Math.round(parseFloat(hyM[1].replace(',', '.')) * 60) + (hyM[2] ? +hyM[2] : 0));
  const m = t.match(/(\d{1,3})\s*(?:min|mins|minutos)\b/);
  if (m) return valida(+m[1]);
  return null;
}

/** Duración de un examen o exposición leído por la IA: primero el rango de horas, luego lo que dice el texto. */
export function duracionDeItem(it: { tipo?: string | null; hora?: string | null; horaFin?: string | null; duracion?: string | null }): number | null {
  if (!tieneDuracion(it.tipo)) return null;
  return duracionEntre(it.hora ?? null, it.horaFin ?? null) ?? duracionDeTexto(it.duracion);
}

/**
 * Un "evento" que en realidad es una evaluación (la IA o un calendario externo lo trajo como evento):
 * devuelve el tipo de tarea que le corresponde, o null si no lo es.
 */
export function tipoEvaluado(titulo: string): 'examen' | 'exposicion' | null {
  const t = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (/^(exposicion|defensa|presentacion final)\b/.test(t)) return 'exposicion';
  if (/^(examen|parcial|final|control|quiz|recuperatorio|evaluacion|segundo parcial|primer parcial)\b/.test(t)) return 'examen';
  return null;
}
