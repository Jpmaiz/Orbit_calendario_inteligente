/**
 * Qué dice cada aviso y cuándo toca (D25). Código puro, sin base de datos: scripts/probar-avisos.ts.
 * - Bloque: entre 2 y 20 min antes de que empiece un bloque de estudio guardado ("En 15 min: …").
 * - Mañana: una vez por día, a las 20:00 de la hora del usuario, solo si algo vence mañana. Si no hay nada, silencio.
 */
export type Aviso = { titulo: string; cuerpo: string; url: string; tag: string };

export const CONFIG_AVISOS = {
  /** Un bloque se avisa si empieza dentro de esta ventana (el envío corre cada 5 min). */
  bloqueDesdeMin: 2,
  bloqueHastaMin: 20,
  /** Hora local del resumen de mañana (de 20:00 a 20:59). */
  horaResumen: 20,
  /** Cuántas actividades se nombran en el resumen. */
  maxNombres: 3,
};

const MIN_MS = 60_000;

const hora = (f: Date, zona: string) =>
  new Intl.DateTimeFormat('es-BO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
const diaLocal = (f: Date, zona: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(f);
const horaLocal = (f: Date, zona: string) =>
  +new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', hourCycle: 'h23' }).format(f);

export function avisoBloque(
  b: { id: string; titulo: string; tipo: string; inicio: Date; fin: Date }, ahora: Date, zona: string,
): Aviso {
  const faltan = Math.max(1, Math.round((b.inicio.getTime() - ahora.getTime()) / MIN_MS));
  return {
    titulo: `En ${faltan} min: ${b.titulo}`,
    cuerpo: `${b.tipo === 'repaso' ? 'Repaso' : 'Estudio'} de ${hora(b.inicio, zona)} a ${hora(b.fin, zona)}`,
    url: '/dia',
    tag: `bloque-${b.id}`,
  };
}

/** Resumen de lo que vence mañana; null si no vence nada (no se manda nada). */
export function avisoManana(
  tareas: { titulo: string; fechaLimite: Date; horaDefinida: boolean }[], zona: string, cfg = CONFIG_AVISOS,
): Aviso | null {
  if (!tareas.length) return null;
  const ordenadas = [...tareas].sort((a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime());
  const nombre = (t: (typeof tareas)[number]) => (t.horaDefinida ? `${t.titulo} (${hora(t.fechaLimite, zona)})` : t.titulo);
  const vistos = ordenadas.slice(0, cfg.maxNombres).map(nombre);
  const resto = ordenadas.length - vistos.length;
  return {
    titulo: ordenadas.length === 1 ? `Mañana: ${ordenadas[0].titulo}` : `Mañana tienes ${ordenadas.length} cosas`,
    cuerpo: vistos.join(' · ') + (resto > 0 ? ` y ${resto} más` : ''),
    url: '/dia',
    tag: `manana-${diaLocal(tareas[0].fechaLimite, zona)}`,
  };
}

/** ¿Es la hora del resumen en la zona del usuario? */
export const esHoraDelResumen = (ahora: Date, zona: string, cfg = CONFIG_AVISOS) => horaLocal(ahora, zona) === cfg.horaResumen;

/** Clave del resumen de hoy (uno por día): "manana:2026-11-24". */
export const claveManana = (ahora: Date, zona: string) => `manana:${diaLocal(ahora, zona)}`;
export const claveBloque = (id: string) => `bloque:${id}`;

/** Ventana de inicio de los bloques que hay que avisar ahora. */
export function ventanaBloques(ahora: Date, cfg = CONFIG_AVISOS) {
  return { desde: new Date(ahora.getTime() + cfg.bloqueDesdeMin * MIN_MS), hasta: new Date(ahora.getTime() + cfg.bloqueHastaMin * MIN_MS) };
}
