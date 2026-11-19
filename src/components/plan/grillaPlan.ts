import { diaEnBolivia, sumarDias } from '../calendario/organizarTareasDia';
import { horarioDelDia, type AgendaDia } from '../calendario/agendaDia';
import type { BloquePlan, OrigenBloque } from './contratoPlan';

/** Grilla de "Planificar estudio": de 07:00 a 23:00, en minutos del día en Bolivia. */
export const H0 = 7 * 60;
export const H1 = 23 * 60;
export const PASO = 15;
export const MIN_BLOQUE = 30;
export const MAX_BLOQUE = 240;
export const MAX_DIAS = 62;

export type Tramo = [number, number];
export type Ocupado = { a: number; b: number; etiqueta: string; titulo: string };
export type DiaPlan = { dia: string; desde: number; hasta: number; ocupados: Ocupado[] };
export type BloqueEditable = {
  clave: string; dia: number; ini: number; fin: number;
  tipo: BloquePlan['tipo']; origen: OrigenBloque; enCurso: boolean; idGuardado: string | null;
};

const formatoHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dos = (n: number) => String(n).padStart(2, '0');

export function minutoBolivia(fecha: Date): number {
  const [h, m] = formatoHora.format(fecha).split(':').map(Number);
  return (h % 24) * 60 + m;
}
/** Día "2026-11-11" + minuto 1170 → ISO en UTC (Bolivia es UTC-4 todo el año). */
export function aISO(dia: string, minuto: number): string {
  const d = minuto >= 1440 ? sumarDias(dia, 1) : dia;
  const m = minuto % 1440;
  return new Date(`${d}T${dos(Math.floor(m / 60))}:${dos(m % 60)}:00-04:00`).toISOString();
}
export function hhmm(minuto: number): string {
  const m = Math.round(minuto) % 1440;
  return dos(Math.floor(m / 60)) + ':' + dos(m % 60);
}
/** 90 → "1 h 30"; con aprox → "~1 h 30". */
export function duracion(minutos: number, aprox = false): string {
  const t = Math.round(minutos), h = Math.floor(t / 60), m = t % 60;
  return (aprox ? '~' : '') + (h ? h + ' h' + (m ? ' ' + m : '') : m + ' min');
}

function aMinuto(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Clases, eventos y bloques de OTRAS actividades de ese día (los de esta tarea se editan aparte). */
export function ocupadosDelDia(agenda: AgendaDia, dia: string, tareaId: string): Ocupado[] {
  const h = horarioDelDia(agenda, new Date(dia + 'T12:00:00-04:00'));
  const cero = new Date(dia + 'T00:00:00-04:00').getTime();
  const enDia = (i: Date, f: Date): Tramo => [Math.max(0, (i.getTime() - cero) / 60000), Math.min(1440, (f.getTime() - cero) / 60000)];
  const ocupados: Ocupado[] = [
    ...h.clases.map((c) => ({
      a: aMinuto(c.horaInicio), b: aMinuto(c.horaFin),
      etiqueta: c.materia?.nombre ?? c.titulo, titulo: c.titulo + ' · ' + c.horaInicio + '–' + c.horaFin,
    })),
    ...h.eventos.map((e) => {
      const [a, b] = enDia(e.inicio, e.fin ?? new Date(e.inicio.getTime() + 3_600_000));
      return { a, b, etiqueta: e.titulo, titulo: e.titulo };
    }),
    ...h.bloques.filter((b) => b.tarea.id !== tareaId).map((b) => {
      const [a, f] = enDia(b.inicio, b.fin);
      return { a, b: f, etiqueta: 'Estudio · ' + b.tarea.titulo, titulo: 'Estudio de ' + b.tarea.titulo };
    }),
  ];
  return ocupados.filter((o) => o.b > o.a).sort((x, y) => x.a - y.a);
}

/** Días desde hoy hasta la fecha de la tarea (máx. 62). Hoy empieza en el cuarto de hora actual. */
export function armarDias(fechaLimite: string, horaDefinida: boolean, agenda: AgendaDia | null, tareaId: string, ahora: Date): DiaPlan[] {
  const hoy = diaEnBolivia(ahora);
  const limite = new Date(fechaLimite);
  const ultimo = diaEnBolivia(limite);
  const dias: DiaPlan[] = [];
  for (let dia = hoy; dia <= ultimo && dias.length < MAX_DIAS; dia = sumarDias(dia, 1)) {
    const desde = dia === hoy ? Math.ceil(minutoBolivia(ahora) / PASO) * PASO : H0;
    // Sin hora definida, la tarea vence al final del día.
    const hasta = dia === ultimo && horaDefinida ? minutoBolivia(limite) : H1;
    dias.push({
      dia, desde: Math.min(Math.max(desde, H0), H1), hasta: Math.min(Math.max(hasta, H0), H1),
      ocupados: agenda ? ocupadosDelDia(agenda, dia, tareaId) : [],
    });
  }
  return dias;
}

/** Bloque del back (ISO) → bloque editable en la grilla, o null si cae fuera de los días visibles. */
export function aEditable(
  b: BloquePlan & { origen: OrigenBloque; enCurso?: boolean; id?: string }, dias: readonly DiaPlan[], clave: string,
): BloqueEditable | null {
  const inicio = new Date(b.inicio), fin = new Date(b.fin);
  const indice = dias.findIndex((d) => d.dia === diaEnBolivia(inicio));
  if (indice < 0) return null;
  const finMin = diaEnBolivia(fin) === dias[indice].dia ? minutoBolivia(fin) : 1440;
  return {
    clave, dia: indice, ini: minutoBolivia(inicio), fin: finMin, tipo: b.tipo, origen: b.origen,
    enCurso: !!b.enCurso, idGuardado: b.id ?? null,
  };
}

/** Tiempo libre del día: entre "desde" y "hasta", sin clases, eventos ni otros bloques (sin margen). */
export function libres(dias: readonly DiaPlan[], bloques: readonly BloqueEditable[], indice: number, excluir: string | null = null): Tramo[] {
  const d = dias[indice];
  const tapados: Tramo[] = [
    ...d.ocupados.map((o): Tramo => [o.a, o.b]),
    ...bloques.filter((b) => b.dia === indice && b.clave !== excluir).map((b): Tramo => [b.ini, b.fin]),
  ].sort((x, y) => x[0] - y[0]);
  const salida: Tramo[] = [];
  let cursor = d.desde;
  for (const [a, b] of tapados) {
    if (a > cursor) salida.push([cursor, Math.min(a, d.hasta)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < d.hasta) salida.push([cursor, d.hasta]);
  return salida.filter(([a, b]) => b - a > 0);
}

/** Tocar un hueco: bloque de 1 h desde la media hora más cercana; si no cabe, lo que haya libre (mín. 30 min). */
export function crearEn(tramo: Tramo, minuto: number): Tramo | null {
  const [a, b] = tramo;
  if (b - a < MIN_BLOQUE) return null;
  let ini = Math.max(Math.floor(minuto / 30) * 30, Math.ceil(a / PASO) * PASO);
  const tope = Math.floor(b / PASO) * PASO;
  let fin = Math.min(ini + 60, tope);
  if (fin - ini < 60) ini = Math.max(Math.ceil(a / PASO) * PASO, fin - 60);
  if (fin - ini < MIN_BLOQUE) { ini = Math.ceil(a / PASO) * PASO; fin = tope; }
  return fin - ini >= MIN_BLOQUE ? [ini, fin] : null;
}

/** Mover un borde en pasos de 15 min, sin pisar nada ocupado, entre 30 min y 4 h. */
export function ajustar(dias: readonly DiaPlan[], bloques: readonly BloqueEditable[], clave: string, borde: 'ini' | 'fin', valor: number): BloqueEditable[] {
  const b = bloques.find((x) => x.clave === clave);
  if (!b || b.enCurso) return bloques as BloqueEditable[];
  const tramo = libres(dias, bloques, b.dia, clave).find(([a, f]) => a <= b.ini && f >= b.fin) ?? [b.ini, b.fin];
  const v = Math.round(valor / PASO) * PASO;
  const cambio = borde === 'ini'
    ? { ini: Math.min(Math.max(v, Math.ceil(tramo[0] / PASO) * PASO, b.fin - MAX_BLOQUE), b.fin - MIN_BLOQUE) }
    : { fin: Math.max(Math.min(v, Math.floor(tramo[1] / PASO) * PASO, b.ini + MAX_BLOQUE), b.ini + MIN_BLOQUE) };
  if (('ini' in cambio && cambio.ini === b.ini) || ('fin' in cambio && cambio.fin === b.fin)) return bloques as BloqueEditable[];
  return bloques.map((x) => (x.clave === clave ? { ...x, ...cambio, origen: 'usuario', idGuardado: null } : x));
}

/** Con qué se cruza un bloque (clase, evento u otro bloque), o null. */
export function choqueDe(dias: readonly DiaPlan[], bloques: readonly BloqueEditable[], b: BloqueEditable): string | null {
  const ocupado = dias[b.dia].ocupados.find((o) => o.a < b.fin && o.b > b.ini);
  if (ocupado) return ocupado.etiqueta;
  return bloques.some((x) => x.clave !== b.clave && x.dia === b.dia && x.ini < b.fin && x.fin > b.ini) ? 'otro bloque de tu plan' : null;
}
