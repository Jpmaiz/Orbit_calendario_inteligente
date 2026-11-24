/**
 * "Mi ritmo": cómo y cuándo estudia el usuario. Lo usan el planificador, los huecos libres y "te faltarían".
 * Sin preferencias guardadas, se usan los valores de siempre (07:00–22:30, 4 h por día, sin días libres,
 * energía normal todo el día). Se guarda en usuarios.ritmo (JSON). Código puro (scripts/probar-ritmo.ts);
 * la lectura con caché está en zona.ts.
 *
 * Nada de esto se escribe en texto libre (D23): todo llega de botones, selectores y toques.
 */
export type Momento = 'manana' | 'mediodia' | 'tarde' | 'noche';
export type Nivel = 'alta' | 'normal' | 'baja';
export type Energia = Record<Momento, Nivel>;
/** Compatibilidad con el front anterior (v2.13): una sola franja preferida. */
export type Franja = 'manana' | 'tarde' | 'noche';

export type Ritmo = {
  desde: string;            // "HH:MM": desde qué hora puede estudiar
  hasta: string;            // "HH:MM": hasta qué hora
  maxHorasDia: number;      // tope de estudio por día (1 a 8, en medias horas)
  diasLibres: number[];     // 1 = lunes … 7 = domingo: días sin estudio
  energia: Energia;         // lo que ELIGIÓ el usuario por momento del día; "normal" = no dijo nada
  energiaPreguntada: boolean; // ya vio las dos preguntas de energía (respondió o las saltó): no se repiten
  menosEstudio: number[];   // días de la semana con la mitad del tope (aceptó "sueles estar cansado ese día")
};

export const MOMENTOS: Momento[] = ['manana', 'mediodia', 'tarde', 'noche'];
export const NIVELES: Nivel[] = ['alta', 'normal', 'baja'];
/** Horario de cada momento ("24:00" = fin del día). El horario de estudio del usuario recorta los extremos. */
export const HORARIO_MOMENTO: Record<Momento, [string, string]> = {
  manana: ['00:00', '12:00'], mediodia: ['12:00', '15:00'], tarde: ['15:00', '19:00'], noche: ['19:00', '24:00'],
};
export const ENERGIA_NORMAL: Energia = { manana: 'normal', mediodia: 'normal', tarde: 'normal', noche: 'normal' };

export const RITMO_POR_DEFECTO: Ritmo = {
  desde: '07:00', hasta: '22:30', maxHorasDia: 4, diasLibres: [],
  energia: ENERGIA_NORMAL, energiaPreguntada: false, menosEstudio: [],
};
const FRANJAS: Franja[] = ['manana', 'tarde', 'noche'];

const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const aMinutos = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const diasValidos = (v: unknown): v is number[] => Array.isArray(v) && v.every((d) => Number.isInteger(d) && d >= 1 && d <= 7);

/** Momento del día de una hora local en minutos: mañana < 12:00 ≤ mediodía < 15:00 ≤ tarde < 19:00 ≤ noche. */
export function momentoDeMinuto(min: number): Momento {
  return min < 720 ? 'manana' : min < 900 ? 'mediodia' : min < 1140 ? 'tarde' : 'noche';
}

/** Momento del día de un instante en la zona del usuario. */
export function momentoDe(fecha: Date, zona: string): Momento {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fecha);
  return momentoDeMinuto(aMinutos(hhmm));
}

/** Para el front v2.13: la franja "preferida" es el primer momento con energía alta (mañana, tarde o noche). */
export function franjaCompatible(energia: Energia): Franja | null {
  return FRANJAS.find((f) => energia[f] === 'alta') ?? null;
}

/** Lee lo guardado (puede venir incompleto o de una versión vieja): siempre devuelve un ritmo válido. */
export function leerRitmo(v: unknown): Ritmo {
  const r = normalizarRitmo(v, RITMO_POR_DEFECTO);
  return r.ok ? r.ritmo : RITMO_POR_DEFECTO;
}

/**
 * Valida un cambio PARCIAL sobre el ritmo actual (lo que no viene se conserva).
 * Reglas: hasta después de desde con al menos 2 h; tope de 1 a 8 h por día; al menos un día con estudio.
 * energia: parcial por momento ({ noche: "alta" }). franja (v2.13): ese momento pasa a alta y los demás altos a normal.
 */
export function normalizarRitmo(v: unknown, actual: Ritmo): { ok: true; ritmo: Ritmo } | { ok: false; error: string } {
  if (v === null || v === undefined) return { ok: true, ritmo: actual };
  if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'ritmo debe ser un objeto' };
  const x = v as Record<string, unknown>;
  const r: Ritmo = {
    ...actual, diasLibres: [...actual.diasLibres], energia: { ...actual.energia }, menosEstudio: [...actual.menosEstudio],
  };
  if (x.desde !== undefined) {
    if (!esHora(x.desde)) return { ok: false, error: 'desde: usa HH:MM' };
    r.desde = x.desde;
  }
  if (x.hasta !== undefined) {
    if (!esHora(x.hasta)) return { ok: false, error: 'hasta: usa HH:MM' };
    r.hasta = x.hasta;
  }
  if (aMinutos(r.hasta) - aMinutos(r.desde) < 120) return { ok: false, error: 'Deja al menos 2 h entre "desde" y "hasta"' };
  if (x.maxHorasDia !== undefined) {
    const h = Number(x.maxHorasDia);
    if (!Number.isFinite(h) || h < 1 || h > 8) return { ok: false, error: 'maxHorasDia: de 1 a 8 horas' };
    r.maxHorasDia = Math.round(h * 2) / 2;
  }
  if (x.diasLibres !== undefined) {
    if (!diasValidos(x.diasLibres)) return { ok: false, error: 'diasLibres: lista de días 1 (lunes) a 7 (domingo)' };
    r.diasLibres = [...new Set(x.diasLibres)].sort();
    if (r.diasLibres.length === 7) return { ok: false, error: 'Deja al menos un día para estudiar' };
  }
  // Versión anterior: una sola franja preferida → ese momento pasa a alta
  if (x.franja !== undefined && x.energia === undefined) {
    if (x.franja !== null && !FRANJAS.includes(x.franja as Franja)) return { ok: false, error: 'franja: manana, tarde, noche o null' };
    for (const m of MOMENTOS) if (r.energia[m] === 'alta') r.energia[m] = 'normal';
    if (x.franja) {
      r.energia[x.franja as Franja] = 'alta';
      r.energiaPreguntada = true; // ya dijo cuándo rinde: no se le vuelve a preguntar
    }
  }
  if (x.energia !== undefined) {
    if (typeof x.energia !== 'object' || x.energia === null || Array.isArray(x.energia)) {
      return { ok: false, error: 'energia: { manana | mediodia | tarde | noche: "alta" | "normal" | "baja" }' };
    }
    for (const [m, n] of Object.entries(x.energia as Record<string, unknown>)) {
      if (!MOMENTOS.includes(m as Momento)) return { ok: false, error: `energia: "${m}" no es un momento (manana, mediodia, tarde, noche)` };
      if (!NIVELES.includes(n as Nivel)) return { ok: false, error: `energia.${m}: usa "alta", "normal" o "baja"` };
      r.energia[m as Momento] = n as Nivel;
    }
  }
  if (x.energiaPreguntada !== undefined) {
    if (typeof x.energiaPreguntada !== 'boolean') return { ok: false, error: 'energiaPreguntada: true o false' };
    r.energiaPreguntada = x.energiaPreguntada;
  }
  if (x.menosEstudio !== undefined) {
    if (!diasValidos(x.menosEstudio)) return { ok: false, error: 'menosEstudio: lista de días 1 (lunes) a 7 (domingo)' };
    r.menosEstudio = [...new Set(x.menosEstudio)].sort();
  }
  return { ok: true, ritmo: r };
}
