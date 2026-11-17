import { horarioDelDia, type AgendaDia } from './agendaDia';
import { diaEnBolivia, sumarDias } from './organizarTareasDia';
import { duracion, hhmm, minutoBolivia } from '../plan/grillaPlan';

/** "Órbita del día": el día de 07:00 a 23:00 como un arco; cada actividad es un tramo y el planeta es "ahora". */
export const INICIO_DIA = 7 * 60;
export const FIN_DIA = 23 * 60;
export const ARCO = { cx: 159, cy: 158, r: 140, ancho: 318, alto: 170 };
export const RUTA_ARCO = `M ${ARCO.cx - ARCO.r} ${ARCO.cy} A ${ARCO.r} ${ARCO.r} 0 0 1 ${ARCO.cx + ARCO.r} ${ARCO.cy}`;

export type TipoTramo = 'clase' | 'evento' | 'estudio';
export type Tramo = { clave: string; tipo: TipoTramo; ini: number; fin: number; titulo: string; color: string };
export type Hito = { clave: string; minuto: number; titulo: string };
export type TemaOrbita = 'oscuro' | 'estudio' | 'claro' | 'noche';
export type Orbita = {
  tema: TemaOrbita; etiqueta: string; grande: string; grandeEsNumero: boolean; bajo: string;
  despues: { hora: string; titulo: string; color: string } | null;
  tramos: (Tramo & { actual: boolean; pasado: boolean })[]; hitos: Hito[]; fraccion: number;
};

const COLOR: Record<TipoTramo, string> = { clase: '#80ACC3', evento: '#C5A355', estudio: '#A392C4' };

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
export function fraccionDel(minuto: number): number {
  return Math.max(0, Math.min(1, (minuto - INICIO_DIA) / (FIN_DIA - INICIO_DIA)));
}
export function puntoDel(minuto: number): [number, number] {
  const a = Math.PI * (1 - fraccionDel(minuto));
  return [ARCO.cx + ARCO.r * Math.cos(a), ARCO.cy - ARCO.r * Math.sin(a)];
}
export function arcoEntre(ini: number, fin: number): string {
  const [x1, y1] = puntoDel(ini), [x2, y2] = puntoDel(fin);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${ARCO.r} ${ARCO.r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
/** "Taller de Sistemas de Información" → "Taller de Sistemas" (para frases cortas). */
export function nombreCorto(titulo: string): string {
  let salida = '';
  for (const palabra of titulo.trim().split(/\s+/)) {
    const siguiente = salida ? salida + ' ' + palabra : palabra;
    if (siguiente.length > 24 && salida) break;
    salida = siguiente;
  }
  return salida.replace(/\s+(de|del|y|la|el|en|los|las)$/i, '');
}

/** Clases, eventos y bloques de estudio de un día (minutos en Bolivia) y las tareas con hora como hitos. */
export function tramosDelDia(agenda: AgendaDia, dia: string): { tramos: Tramo[]; hitos: Hito[] } {
  const horario = horarioDelDia(agenda, new Date(dia + 'T12:00:00-04:00'));
  const cero = new Date(dia + 'T00:00:00-04:00').getTime();
  const enDia = (fecha: Date) => Math.max(0, Math.min(1440, Math.round((fecha.getTime() - cero) / 60000)));
  const tramos: Tramo[] = [
    ...horario.clases.map((c): Tramo => ({
      clave: 'c' + c.id, tipo: 'clase', ini: aMinutos(c.horaInicio), fin: aMinutos(c.horaFin),
      titulo: c.titulo, color: c.materia?.color ?? COLOR.clase,
    })),
    ...horario.eventos.map((e): Tramo => {
      const ini = enDia(e.inicio);
      return { clave: 'e' + e.id, tipo: 'evento', ini, fin: e.fin ? enDia(e.fin) : ini + 60, titulo: e.titulo, color: e.materia?.color ?? COLOR.evento };
    }),
    ...horario.bloques.map((b): Tramo => ({
      clave: 'b' + b.id, tipo: 'estudio', ini: enDia(b.inicio), fin: enDia(b.fin), titulo: b.tarea.titulo, color: COLOR.estudio,
    })),
  ].filter((t) => t.fin > t.ini).sort((a, b) => a.ini - b.ini || a.fin - b.fin);
  const hitos = agenda.tareas
    .filter((t) => t.horaDefinida && diaEnBolivia(t.fechaLimite) === dia)
    .map((t) => ({ clave: 't' + t.id, minuto: minutoBolivia(t.fechaLimite), titulo: t.titulo }));
  return { tramos, hitos };
}

export function calcularOrbita(agenda: AgendaDia, ahora: Date): Orbita {
  const hoy = diaEnBolivia(ahora);
  const m = minutoBolivia(ahora);
  const { tramos, hitos } = tramosDelDia(agenda, hoy);
  const manana = tramosDelDia(agenda, sumarDias(hoy, 1)).tramos[0] ?? null;
  const enCurso = tramos.filter((t) => t.ini <= m && m < t.fin);
  // Si se cruzan, manda la clase; luego un evento; luego el estudio.
  const actual = enCurso.find((t) => t.tipo === 'clase') ?? enCurso.find((t) => t.tipo === 'evento') ?? enCurso[0] ?? null;
  const siguiente = tramos.find((t) => t.ini > m && t.clave !== actual?.clave) ?? null;
  const conFlags = tramos.map((t) => ({ ...t, actual: t.clave === actual?.clave, pasado: t.fin <= m }));
  const base = { tramos: conFlags, hitos, fraccion: fraccionDel(m) };

  if (actual) {
    const despues = siguiente
      ? { hora: hhmm(siguiente.ini), titulo: siguiente.titulo, color: siguiente.color }
      : manana ? { hora: 'Mañana ' + hhmm(manana.ini), titulo: manana.titulo, color: manana.color } : null;
    return {
      ...base, tema: actual.tipo === 'estudio' ? 'estudio' : 'oscuro', etiqueta: 'Ahora · ' + actual.tipo,
      grande: actual.titulo, grandeEsNumero: false, bajo: 'quedan ' + duracion(actual.fin - m), despues,
    };
  }
  if (siguiente) {
    return {
      ...base, tema: 'claro', etiqueta: 'Libre ahora', grande: duracion(siguiente.ini - m), grandeEsNumero: true,
      bajo: `hasta ${nombreCorto(siguiente.titulo)} · ${hhmm(siguiente.ini)}`, despues: null,
    };
  }
  const noche = m >= 18 * 60 || m < 6 * 60;
  return {
    ...base, tema: noche ? 'noche' : 'claro', etiqueta: 'Libre por hoy',
    grande: noche ? 'Día terminado' : tramos.length ? 'Nada más hoy' : 'Día libre', grandeEsNumero: false,
    bajo: manana ? `Mañana ${hhmm(manana.ini)} · ${nombreCorto(manana.titulo)}` : 'Mañana también estás libre', despues: null,
  };
}
