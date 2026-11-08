/**
 * Personalización (Fase 3): Orbit aprende el ritmo del usuario SIN pedirle que marque nada.
 * Código puro: sin base de datos, se prueba con scripts/probar-personal.ts.
 *
 * De dónde salen los datos (señales):
 * - Lo que el usuario ya hace: baja o sube las horas del plan, agrega o quita bloques, cambia las horas a mano.
 *   Valen la mitad que un dato preguntado (peso 0,5), salvo cambiar las horas a mano (peso 1: es su número).
 * - Una pregunta como máximo por semana, solo en actividades grandes (peso 1). Ignorarla no cuenta.
 *
 * Horas: cada señal es una razón real ÷ estimada para un estudiante promedio. Se promedian en escala
 * logarítmica (×2 y ×0,5 se compensan), lo reciente pesa más (media vida de 120 días) y se mezclan con lo
 * general según cuántos datos hay: n ÷ (n + 3). Niveles: esta materia y tipo → este tipo → otros tipos → 1.
 * Franja: los bloques que el usuario pone o saca votan por mañana, tarde o noche.
 */
import type { Franja } from '@/lib/plan/planificador';

export const CONFIG_PERSONAL = {
  /** Datos "previos": con 3 datos el historial pesa la mitad; con 10, el 77 %. */
  previo: 3,
  mediaVidaDias: 120,
  factorMin: 0.5,
  factorMax: 2,
  /** Una razón fuera de esto se recorta: un dato raro no descalibra. */
  razonMin: 0.25,
  razonMax: 4,
  /** Votos netos mínimos para que una franja gane, y ventaja sobre la segunda. */
  votosFranja: 2,
  ventajaFranja: 1,
};

export type SenalHoras = { razon: number; peso: number; materiaId: string | null; tipoTarea: string | null; creadoEn: Date };
export type SenalFranja = { franja: Franja; voto: number; peso: number; creadoEn: Date };
export type FactorPersonal = { factor: number; datos: number; nivel: 'materia' | 'tipo' | 'global' | 'ninguno' };

const DIA_MS = 86_400_000;
const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const pesoEnElTiempo = (fecha: Date, ahora: Date, cfg = CONFIG_PERSONAL) =>
  Math.pow(0.5, Math.max(0, ahora.getTime() - fecha.getTime()) / DIA_MS / cfg.mediaVidaDias);

/** Promedio logarítmico ponderado y "cuántos datos" (suma de pesos). */
function resumen(senales: SenalHoras[], ahora: Date, cfg = CONFIG_PERSONAL) {
  let n = 0, suma = 0;
  for (const s of senales) {
    const w = s.peso * pesoEnElTiempo(s.creadoEn, ahora, cfg);
    if (w <= 0) continue;
    n += w;
    suma += w * Math.log(entre(s.razon, cfg.razonMin, cfg.razonMax));
  }
  return { n, log: n > 0 ? suma / n : 0 };
}

/** Mezcla el historial con el nivel de arriba según cuántos datos hay. */
const mezclar = (base: number, r: { n: number; log: number }, previo: number) =>
  r.n > 0 ? base + (r.n / (r.n + previo)) * (r.log - base) : base;

/**
 * Factor personal para una actividad: 1 = como el estudiante promedio; 1,4 = le toma 40 % más.
 * Mezcla por niveles sin contar dos veces el mismo dato: otros tipos → este tipo (otras materias) → esta materia.
 */
export function factorPersonal(
  senales: SenalHoras[], materiaId: string | null, tipo: string, ahora: Date = new Date(), cfg = CONFIG_PERSONAL,
): FactorPersonal {
  if (!senales.length) return { factor: 1, datos: 0, nivel: 'ninguno' };
  const esMateria = (s: SenalHoras) => materiaId !== null && s.materiaId === materiaId;
  const deMateria = resumen(senales.filter((s) => s.tipoTarea === tipo && esMateria(s)), ahora, cfg);
  const delTipo = resumen(senales.filter((s) => s.tipoTarea === tipo && !esMateria(s)), ahora, cfg);
  const otros = resumen(senales.filter((s) => s.tipoTarea !== tipo), ahora, cfg);
  if (deMateria.n + delTipo.n + otros.n === 0) return { factor: 1, datos: 0, nivel: 'ninguno' };

  let log = mezclar(0, otros, cfg.previo);
  log = mezclar(log, delTipo, cfg.previo);
  log = mezclar(log, deMateria, cfg.previo);
  const nivel = deMateria.n > 0 ? 'materia' : delTipo.n > 0 ? 'tipo' : 'global';
  const datos = Math.round((deMateria.n || delTipo.n || otros.n) * 10) / 10;
  return { factor: Math.round(entre(Math.exp(log), cfg.factorMin, cfg.factorMax) * 100) / 100, datos, nivel };
}

/** Horas personales: las del estudiante promedio por el factor, redondeadas a media hora. */
export function aplicarFactor(horasPromedio: number, factor: number): number {
  if (horasPromedio <= 0) return 0;
  return Math.max(0.5, Math.round(horasPromedio * factor * 2) / 2);
}

/** Franja preferida, si hay suficientes votos y una gana con ventaja. */
export function franjaPreferida(votos: SenalFranja[], ahora: Date = new Date(), cfg = CONFIG_PERSONAL): Franja | null {
  const puntos: Record<Franja, number> = { manana: 0, tarde: 0, noche: 0 };
  for (const v of votos) puntos[v.franja] += v.voto * v.peso * pesoEnElTiempo(v.creadoEn, ahora, cfg) * 2; // peso 0,5 → 1 voto
  const orden = (Object.entries(puntos) as [Franja, number][]).sort((a, b) => b[1] - a[1]);
  const [primera, segunda] = orden;
  return primera[1] >= cfg.votosFranja && primera[1] - segunda[1] >= cfg.ventajaFranja ? primera[0] : null;
}

/** Franja de un instante según la hora local: mañana < 14:00 ≤ tarde < 19:00 ≤ noche. */
export function franjaDe(fecha: Date, zona: string): Franja {
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', hourCycle: 'h23' }).format(fecha);
  return h < 14 ? 'manana' : h < 19 ? 'tarde' : 'noche';
}

/** Respuesta a la pregunta semanal → horas reales (relativas a lo que se le sugirió). */
export const FACTOR_RESPUESTA = { menos: 0.75, justo: 1, mas: 1.4 } as const;
export type Respuesta = keyof typeof FACTOR_RESPUESTA;
