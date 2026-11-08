/**
 * Huecos libres del estudiante (Fase 2). Código puro: sin base de datos ni IA, se prueba con scripts/probar-plan.ts.
 *
 * Hueco libre = franja diaria de estudio (por defecto 07:00–22:30)
 *             − clases vigentes, eventos y bloques de estudio ya aceptados (cada uno con 15 min de margen)
 *             − lo que ya pasó.
 * Se descartan los huecos de menos de 30 min: no alcanzan para una sesión útil.
 */
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

export const CONFIG_HUECOS = {
  franjaInicio: '07:00',
  franjaFin: '22:30',
  /** Margen antes y después de cada actividad (traslado, descanso). */
  margenMin: 15,
  /** Un hueco más corto que esto no sirve para estudiar. */
  huecoMinimoMin: 30,
  /** Los bloques empiezan en múltiplos de esto (09:00, 09:15…). */
  pasoMin: 15,
};
export type ConfigHuecos = typeof CONFIG_HUECOS;

export type Dia = { y: number; m: number; d: number };
export type Ocupacion = { inicio: Date; fin: Date; titulo: string };
export type Hueco = { inicio: Date; fin: Date; minutos: number };
export type HuecosDelDia = { dia: string; diaSemana: number; huecos: Hueco[]; libresMin: number };

/** Clase semanal tal como está en la base (EventoFijo). */
export type ClaseSemanal = {
  titulo: string; diaSemana: number; horaInicio: string; horaFin: string;
  vigenteDesde: Date | null; vigenteHasta: Date | null;
};

const MIN_MS = 60_000;
const DIA_MS = 86_400_000;

// ───────────────────────── Días en la zona del usuario ─────────────────────────

/** Día calendario (y/m/d) y día de la semana (1 = lunes) de un instante, en la zona del usuario. */
export function diaLocal(fecha: Date, zona: string): Dia & { diaSemana: number } {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(fecha);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    y: +v('year'), m: +v('month'), d: +v('day'),
    diaSemana: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(v('weekday')) + 1,
  };
}

export const claveDia = (d: Dia) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;

export function sumarDias(d: Dia, n: number): Dia & { diaSemana: number } {
  const f = new Date(Date.UTC(d.y, d.m - 1, d.d) + n * DIA_MS);
  return { y: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate(), diaSemana: ((f.getUTCDay() + 6) % 7) + 1 };
}

/** Días calendario desde el día de `desde` hasta el día de `hasta`, ambos incluidos (máx. 62). */
export function diasEntre(desde: Date, hasta: Date, zona: string): (Dia & { diaSemana: number })[] {
  const ini = diaLocal(desde, zona);
  const fin = claveDia(diaLocal(hasta, zona));
  const dias: (Dia & { diaSemana: number })[] = [];
  for (let i = 0; i < 62; i++) {
    const d = sumarDias(ini, i);
    dias.push(d);
    if (claveDia(d) >= fin) break;
  }
  return dias;
}

const redondearArriba = (fecha: Date, pasoMin: number) => new Date(Math.ceil(fecha.getTime() / (pasoMin * MIN_MS)) * pasoMin * MIN_MS);
const redondearAbajo = (fecha: Date, pasoMin: number) => new Date(Math.floor(fecha.getTime() / (pasoMin * MIN_MS)) * pasoMin * MIN_MS);

// ───────────────────────── Ocupaciones ─────────────────────────

/** Repite cada clase semanal en los días del rango en que está vigente. */
export function ocupacionesDeClases(clases: ClaseSemanal[], desde: Date, hasta: Date, zona: string): Ocupacion[] {
  const salida: Ocupacion[] = [];
  for (const dia of diasEntre(desde, hasta, zona)) {
    for (const c of clases) {
      if (c.diaSemana !== dia.diaSemana) continue;
      const inicio = instanteEnZona(dia, c.horaInicio, zona);
      const fin = instanteEnZona(dia, c.horaFin, zona);
      if (c.vigenteDesde && c.vigenteDesde > fin) continue;
      if (c.vigenteHasta && c.vigenteHasta < inicio) continue;
      if (fin > inicio) salida.push({ inicio, fin, titulo: c.titulo });
    }
  }
  return salida;
}

// ───────────────────────── Huecos ─────────────────────────

/**
 * Huecos libres por día entre `desde` y `hasta`.
 * @param ahora nada antes de este momento (redondeado al siguiente paso de 15 min)
 */
export function huecosLibres(
  desde: Date,
  hasta: Date,
  ocupaciones: Ocupacion[],
  zona: string,
  ahora: Date = new Date(),
  config: ConfigHuecos = CONFIG_HUECOS,
): HuecosDelDia[] {
  const margen = config.margenMin * MIN_MS;
  const ocupado = ocupaciones
    .map((o) => ({ inicio: o.inicio.getTime() - margen, fin: o.fin.getTime() + margen }))
    .sort((a, b) => a.inicio - b.inicio);
  const piso = Math.max(desde.getTime(), redondearArriba(ahora, config.pasoMin).getTime());
  const techo = hasta.getTime();

  return diasEntre(desde, hasta, zona).map((dia) => {
    let ini = Math.max(instanteEnZona(dia, config.franjaInicio, zona).getTime(), piso);
    const fin = Math.min(instanteEnZona(dia, config.franjaFin, zona).getTime(), techo);
    const huecos: Hueco[] = [];
    for (const o of ocupado) {
      if (ini >= fin) break;
      if (o.fin <= ini || o.inicio >= fin) continue;
      if (o.inicio > ini) agregar(huecos, ini, o.inicio, config);
      ini = Math.max(ini, o.fin);
    }
    if (ini < fin) agregar(huecos, ini, fin, config);
    return { dia: claveDia(dia), diaSemana: dia.diaSemana, huecos, libresMin: huecos.reduce((s, h) => s + h.minutos, 0) };
  });
}

function agregar(huecos: Hueco[], ini: number, fin: number, config: ConfigHuecos) {
  const inicio = redondearArriba(new Date(ini), config.pasoMin);
  const final = redondearAbajo(new Date(fin), config.pasoMin);
  const minutos = Math.round((final.getTime() - inicio.getTime()) / MIN_MS);
  if (minutos >= config.huecoMinimoMin) huecos.push({ inicio, fin: final, minutos });
}

/** Horas libres de estudio por día, en promedio, con un tope por día (lo usa el motor de prioridad). */
export function horasLibresPorDia(dias: HuecosDelDia[], topeHorasDia: number): number {
  if (!dias.length) return topeHorasDia;
  const total = dias.reduce((s, d) => s + Math.min(topeHorasDia * 60, d.libresMin), 0);
  return Math.round((total / dias.length / 60) * 10) / 10;
}
