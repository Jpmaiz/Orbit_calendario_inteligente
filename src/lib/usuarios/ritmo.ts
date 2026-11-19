/**
 * "Mi ritmo": cómo y cuándo estudia el usuario. Lo usan el planificador, los huecos libres y "te faltarían".
 * Sin preferencias guardadas, se usan los valores de siempre (07:00–22:30, 4 h por día, sin días libres).
 * Se guarda en usuarios.ritmo (JSON). Código puro (scripts/probar-ritmo.ts); la lectura con caché está en zona.ts.
 */
export type Franja = 'manana' | 'tarde' | 'noche';
export type Ritmo = {
  desde: string;          // "HH:MM": desde qué hora puede estudiar
  hasta: string;          // "HH:MM": hasta qué hora
  maxHorasDia: number;    // tope de estudio por día (1 a 8, en medias horas)
  diasLibres: number[];   // 1 = lunes … 7 = domingo: días sin estudio
  franja: Franja | null;  // preferida; null = la aprende Orbit sola
};

export const RITMO_POR_DEFECTO: Ritmo = { desde: '07:00', hasta: '22:30', maxHorasDia: 4, diasLibres: [], franja: null };
const FRANJAS: Franja[] = ['manana', 'tarde', 'noche'];

const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const aMin = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);

/** Lee lo guardado (puede venir incompleto o de una versión vieja): siempre devuelve un ritmo válido. */
export function leerRitmo(v: unknown): Ritmo {
  const r = normalizarRitmo(v, RITMO_POR_DEFECTO);
  return r.ok ? r.ritmo : RITMO_POR_DEFECTO;
}

/**
 * Valida un cambio PARCIAL sobre el ritmo actual (lo que no viene se conserva).
 * Reglas: hasta después de desde con al menos 2 h; tope de 1 a 8 h por día; al menos un día con estudio.
 */
export function normalizarRitmo(v: unknown, actual: Ritmo): { ok: true; ritmo: Ritmo } | { ok: false; error: string } {
  if (v === null || v === undefined) return { ok: true, ritmo: actual };
  if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'ritmo debe ser un objeto' };
  const x = v as Record<string, unknown>;
  const r: Ritmo = { ...actual, diasLibres: [...actual.diasLibres] };
  if (x.desde !== undefined) {
    if (!esHora(x.desde)) return { ok: false, error: 'desde: usa HH:MM' };
    r.desde = x.desde;
  }
  if (x.hasta !== undefined) {
    if (!esHora(x.hasta)) return { ok: false, error: 'hasta: usa HH:MM' };
    r.hasta = x.hasta;
  }
  if (aMin(r.hasta) - aMin(r.desde) < 120) return { ok: false, error: 'Deja al menos 2 h entre "desde" y "hasta"' };
  if (x.maxHorasDia !== undefined) {
    const h = Number(x.maxHorasDia);
    if (!Number.isFinite(h) || h < 1 || h > 8) return { ok: false, error: 'maxHorasDia: de 1 a 8 horas' };
    r.maxHorasDia = Math.round(h * 2) / 2;
  }
  if (x.diasLibres !== undefined) {
    if (!Array.isArray(x.diasLibres) || x.diasLibres.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
      return { ok: false, error: 'diasLibres: lista de días 1 (lunes) a 7 (domingo)' };
    }
    r.diasLibres = [...new Set(x.diasLibres as number[])].sort();
    if (r.diasLibres.length === 7) return { ok: false, error: 'Deja al menos un día para estudiar' };
  }
  if (x.franja !== undefined) {
    if (x.franja !== null && !FRANJAS.includes(x.franja as Franja)) return { ok: false, error: 'franja: manana, tarde, noche o null' };
    r.franja = x.franja as Franja | null;
  }
  return { ok: true, ritmo: r };
}
