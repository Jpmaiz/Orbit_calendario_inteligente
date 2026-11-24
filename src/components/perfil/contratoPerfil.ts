import { avisarAgendaActualizada } from '../calendario/actualizacionAgenda';

/**
 * Contrato del Perfil (v2.13–2.14): Mi ritmo con la energía por momento, lo aprendido y el semestre.
 * Lectores tolerantes: lo que no venga bien se reemplaza por un valor seguro, sin romper la pantalla.
 */
export type Franja = 'manana' | 'tarde' | 'noche';
/** v2.14: energía por momento del día. Lo que el estudiante dice de sí mismo va con botones, nunca con texto libre. */
export type Momento = 'manana' | 'mediodia' | 'tarde' | 'noche';
export type Nivel = 'alta' | 'normal' | 'baja';
export const MOMENTOS: Momento[] = ['manana', 'mediodia', 'tarde', 'noche'];
export type Ritmo = {
  desde: string; hasta: string; maxHorasDia: number; diasLibres: number[];
  energia: Record<Momento, Nivel>; energiaPreguntada: boolean; menosEstudio: number[];
  /** Solo compatibilidad (primer momento alto): no usar en pantallas nuevas. */
  franja: Franja | null;
};
/** Cambio parcial para PATCH /api/perfil { ritmo }: la energía también puede ir por momento. */
export type CambioRitmo = Partial<Omit<Ritmo, 'energia'>> & { energia?: Partial<Record<Momento, Nivel>> };
/** Algo fijo cada semana (trabajo, gimnasio…): clase fija sin materia = tiempo ocupado. */
export type Compromiso = { titulo: string; diasSemana: number[]; hora: string; horaFin: string };
export type MomentoEnergia = { momento: Momento; nombre: string; desde: string; hasta: string; disponible: boolean; nivel: Nivel; aprendido: boolean };
export type EnergiaPerfil = { momentos: MomentoEnergia[]; preguntar: boolean; sugerencia: { texto: string; cambio: CambioRitmo } | null };
export type SemanaSemestre = { desde: string; hasta: string; etiqueta: string; horas: number; actividades: number };
export type Semestre = {
  semanas: SemanaSemestre[];
  semanaPesada: (SemanaSemestre & { mensaje: string }) | null;
  materiaMasPesada: { nombre: string; color: string | null } | null;
  porPlanificarHoras: number;
  proximoExamen: { id: string; titulo: string; tipo: string; fecha: Date } | null;
};
export type Aprendizaje = { conociendo: boolean; frases: string[] };

const ENERGIA_NORMAL: Record<Momento, Nivel> = { manana: 'normal', mediodia: 'normal', tarde: 'normal', noche: 'normal' };
export const RITMO_BASE: Ritmo = {
  desde: '07:00', hasta: '22:30', maxHorasDia: 4, diasLibres: [], energia: ENERGIA_NORMAL, energiaPreguntada: false, menosEstudio: [], franja: null,
};

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const texto = (v: unknown, otro = '') => (typeof v === 'string' ? v : otro);
const numero = (v: unknown, otro = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : otro);
const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(v);
const dias = (v: unknown) => (Array.isArray(v) ? v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : []);

const esNivel = (v: unknown): v is Nivel => v === 'alta' || v === 'normal' || v === 'baja';

export function leerRitmo(v: unknown, base: Ritmo = RITMO_BASE): Ritmo {
  const r = objeto(v);
  const franja = r.franja === 'manana' || r.franja === 'tarde' || r.franja === 'noche' ? r.franja : null;
  const e = objeto(r.energia);
  const energia = Object.fromEntries(MOMENTOS.map((m) => [m, esNivel(e[m]) ? e[m] : base.energia[m]])) as Record<Momento, Nivel>;
  return {
    desde: esHora(r.desde) ? r.desde : base.desde, hasta: esHora(r.hasta) ? r.hasta : base.hasta,
    maxHorasDia: numero(r.maxHorasDia, base.maxHorasDia), diasLibres: [...new Set(dias(r.diasLibres))].sort(),
    energia, energiaPreguntada: r.energiaPreguntada === true, menosEstudio: [...new Set(dias(r.menosEstudio))].sort(), franja,
  };
}

/** GET /api/perfil/energia: los 4 momentos (recortados a tu horario), si hay que preguntar y una sugerencia rara. */
export function leerEnergia(v: unknown): EnergiaPerfil {
  const d = objeto(v);
  const momentos = (Array.isArray(d.momentos) ? d.momentos : []).flatMap((x): MomentoEnergia[] => {
    const m = objeto(x);
    if (!MOMENTOS.includes(m.momento as Momento)) return [];
    return [{
      momento: m.momento as Momento, nombre: texto(m.nombre, String(m.momento)), desde: texto(m.desde), hasta: texto(m.hasta),
      disponible: m.disponible !== false, nivel: esNivel(m.nivel) ? m.nivel : 'normal', aprendido: m.aprendido === true,
    }];
  });
  const s = d.sugerencia ? objeto(d.sugerencia) : null;
  return {
    momentos, preguntar: d.preguntar === true,
    sugerencia: s && texto(s.texto) && s.cambio && typeof s.cambio === 'object' ? { texto: texto(s.texto), cambio: s.cambio as CambioRitmo } : null,
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
export async function guardarRitmo(cambio: CambioRitmo | null): Promise<Ritmo> {
  const datos = await pedir('/api/perfil', { method: 'PATCH', body: JSON.stringify({ ritmo: cambio }) }, 'No pude guardar tu ritmo.');
  return leerPerfilRitmo(datos).ritmo;
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
