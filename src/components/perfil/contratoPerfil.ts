import { avisarAgendaActualizada } from '../calendario/actualizacionAgenda';

/**
 * Contrato del Perfil (v2.13): Mi ritmo, Cuéntale a Orbit tu semana, lo aprendido y el semestre.
 * Lectores tolerantes: lo que no venga bien se reemplaza por un valor seguro, sin romper la pantalla.
 */
export type Franja = 'manana' | 'tarde' | 'noche';
export type Ritmo = { desde: string; hasta: string; maxHorasDia: number; diasLibres: number[]; franja: Franja | null };
export type Compromiso = { titulo: string; diasSemana: number[]; hora: string; horaFin: string };
export type Propuesta = { ritmo: Ritmo; compromisos: Compromiso[]; resumen: string[] };
export type SemanaSemestre = { desde: string; hasta: string; etiqueta: string; horas: number; actividades: number };
export type Semestre = {
  semanas: SemanaSemestre[];
  semanaPesada: (SemanaSemestre & { mensaje: string }) | null;
  materiaMasPesada: { nombre: string; color: string | null } | null;
  porPlanificarHoras: number;
  proximoExamen: { id: string; titulo: string; tipo: string; fecha: Date } | null;
};
export type Aprendizaje = { conociendo: boolean; frases: string[] };

export const RITMO_BASE: Ritmo = { desde: '07:00', hasta: '22:30', maxHorasDia: 4, diasLibres: [], franja: null };

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const texto = (v: unknown, otro = '') => (typeof v === 'string' ? v : otro);
const numero = (v: unknown, otro = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : otro);
const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(v);
const dias = (v: unknown) => (Array.isArray(v) ? v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : []);

export function leerRitmo(v: unknown, base: Ritmo = RITMO_BASE): Ritmo {
  const r = objeto(v);
  const franja = r.franja === 'manana' || r.franja === 'tarde' || r.franja === 'noche' ? r.franja : null;
  return {
    desde: esHora(r.desde) ? r.desde : base.desde, hasta: esHora(r.hasta) ? r.hasta : base.hasta,
    maxHorasDia: numero(r.maxHorasDia, base.maxHorasDia), diasLibres: [...new Set(dias(r.diasLibres))].sort(), franja,
  };
}

export function leerPerfilRitmo(v: unknown): { ritmo: Ritmo; porDefecto: Ritmo } {
  const d = objeto(v);
  const porDefecto = leerRitmo(d.ritmoPorDefecto);
  return { ritmo: leerRitmo(d.ritmo, porDefecto), porDefecto };
}

export function leerSemestre(v: unknown): Semestre {
  const d = objeto(v);
  const semana = (x: unknown): SemanaSemestre => {
    const s = objeto(x);
    return { desde: texto(s.desde), hasta: texto(s.hasta), etiqueta: texto(s.etiqueta), horas: numero(s.horas), actividades: numero(s.actividades) };
  };
  const pesada = d.semanaPesada ? { ...semana(d.semanaPesada), mensaje: texto(objeto(d.semanaPesada).mensaje) } : null;
  const materia = d.materiaMasPesada ? objeto(d.materiaMasPesada) : null;
  const examen = d.proximoExamen ? objeto(d.proximoExamen) : null;
  const fecha = examen ? new Date(texto(examen.fecha)) : null;
  return {
    semanas: (Array.isArray(d.semanas) ? d.semanas : []).map(semana).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.desde)),
    semanaPesada: pesada && pesada.mensaje ? pesada : null,
    materiaMasPesada: materia && texto(materia.nombre) ? { nombre: texto(materia.nombre), color: typeof materia.color === 'string' ? materia.color : null } : null,
    porPlanificarHoras: numero(d.porPlanificarHoras),
    proximoExamen: examen && fecha && !Number.isNaN(fecha.getTime()) && texto(examen.titulo)
      ? { id: texto(examen.id), titulo: texto(examen.titulo), tipo: texto(examen.tipo), fecha } : null,
  };
}

export function leerAprendizaje(v: unknown): Aprendizaje {
  const d = objeto(v);
  const frases = (Array.isArray(d.frases) ? d.frases : []).filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
  return { conociendo: d.conociendo === true || frases.length === 0, frases };
}

export function leerPropuesta(v: unknown, actual: Ritmo): Propuesta {
  const d = objeto(v);
  const compromisos = (Array.isArray(d.compromisos) ? d.compromisos : []).flatMap((x): Compromiso[] => {
    const c = objeto(x);
    const diasSemana = dias(c.diasSemana);
    return texto(c.titulo).trim() && diasSemana.length && esHora(c.hora) && esHora(c.horaFin)
      ? [{ titulo: texto(c.titulo).trim(), diasSemana, hora: texto(c.hora), horaFin: texto(c.horaFin) }] : [];
  });
  const resumen = (Array.isArray(d.resumen) ? d.resumen : []).filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
  return { ritmo: leerRitmo(d.ritmo, actual), compromisos, resumen };
}

/** Error con el mensaje del back tal cual (los 400 y 422 ya vienen redactados para el usuario). */
export class ErrorPerfil extends Error {
  constructor(mensaje: string, readonly estado: number) { super(mensaje); }
}

async function pedir(url: string, init: RequestInit, otro: string): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    throw new ErrorPerfil('No hay conexión. Inténtalo de nuevo en un momento.', 0);
  }
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = objeto(datos).error;
    throw new ErrorPerfil(typeof error === 'string' && error.trim() ? error : otro, respuesta.status);
  }
  return datos;
}

/** PATCH /api/perfil { ritmo }: cambio parcial; null = volver a lo de siempre. Devuelve el ritmo que quedó. */
export async function guardarRitmo(cambio: Partial<Ritmo> | null): Promise<Ritmo> {
  const datos = await pedir('/api/perfil', { method: 'PATCH', body: JSON.stringify({ ritmo: cambio }) }, 'No pude guardar tu ritmo.');
  return leerPerfilRitmo(datos).ritmo;
}

/** POST /api/perfil/ritmo/interpretar: solo propone, no guarda nada. 422 = no entendió (mensaje listo). */
export async function interpretarRitmo(textoUsuario: string, actual: Ritmo): Promise<Propuesta> {
  const datos = await pedir('/api/perfil/ritmo/interpretar', { method: 'POST', body: JSON.stringify({ texto: textoUsuario }) },
    'No pude leerlo ahora. Inténtalo de nuevo o ajústalo a mano.');
  return leerPropuesta(datos, actual);
}

/** Cada compromiso es tiempo ocupado: una clase fija sin materia por cada día. Devuelve los que no se pudieron crear. */
export async function crearCompromisos(compromisos: Compromiso[]): Promise<string[]> {
  const fallidos = new Set<string>();
  await Promise.all(compromisos.flatMap((c) => c.diasSemana.map(async (diaSemana) => {
    try {
      await pedir('/api/eventos', {
        method: 'POST',
        body: JSON.stringify({ titulo: c.titulo, diaSemana, horaInicio: c.hora, horaFin: c.horaFin === '24:00' ? '23:59' : c.horaFin, materiaId: null }),
      }, 'No se pudo guardar.');
    } catch {
      fallidos.add(c.titulo);
    }
  })));
  if (compromisos.length) avisarAgendaActualizada();
  return [...fallidos];
}

/** DELETE /api/perfil/aprendizaje: «Empezar de cero». */
export async function olvidarAprendizaje(): Promise<void> {
  await pedir('/api/perfil/aprendizaje', { method: 'DELETE' }, 'No pude borrar lo aprendido. Inténtalo de nuevo.');
}

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
