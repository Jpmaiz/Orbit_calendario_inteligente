import { avisarAgendaActualizada } from '../calendario/actualizacionAgenda';

export type OrigenBloque = 'orbit' | 'usuario';
export type BloquePlan = { inicio: string; fin: string; tipo: 'estudio' | 'repaso' };
/** Lo que se manda al guardar (v2.10): cuartos de hora, de 30 min a 4 h, con su origen. */
export type BloqueAGuardar = BloquePlan & { origen: OrigenBloque };
/** enCurso: empezó y no terminó; el back lo conserva y no se edita. */
export type BloqueGuardado = BloquePlan & { id: string; estado: string; origen: OrigenBloque; enCurso: boolean };
export type DatosPlan = {
  tarea: { id: string; titulo: string; tipo: string; fechaLimite: string; horas: number };
  propuesta: {
    bloques: BloquePlan[]; minutosNecesarios: number; minutosPlanificados: number;
    faltanMin: number; aviso: string | null;
  };
  guardado: BloqueGuardado[];
  conflictos: { id: string; motivo: string }[];
};
export type ResultadoPlan = {
  bloques: BloqueGuardado[]; minutosPlanificados: number; resumen: string;
  choques: { inicio: string; titulo: string }[];
};
export class ErrorPlan extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje); }
}
function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Respuesta de planificación inválida.');
  return v as Record<string, unknown>;
}
function texto(v: unknown): string {
  if (typeof v !== 'string') throw new Error('Falta un texto en el plan.');
  return v;
}
function numero(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('Cantidad inválida en el plan.');
  return v;
}
function lista(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new Error('Falta una lista de planificación.');
  return v;
}
function instante(v: unknown): string {
  const s = texto(v);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(s) || Number.isNaN(+new Date(s))) throw new Error('Fecha del plan inválida o sin zona horaria.');
  return s;
}
function bloque(v: unknown): BloquePlan {
  const b = objeto(v);
  const inicio = instante(b.inicio), fin = instante(b.fin);
  if (+new Date(fin) <= +new Date(inicio)) throw new Error('Intervalo de estudio inválido.');
  if (b.tipo !== 'estudio' && b.tipo !== 'repaso') throw new Error('Tipo de bloque desconocido.');
  return { inicio, fin, tipo: b.tipo };
}
function guardado(v: unknown): BloqueGuardado {
  const b = objeto(v);
  return {
    ...bloque(b), id: texto(b.id), estado: texto(b.estado),
    origen: b.origen === 'orbit' ? 'orbit' : 'usuario', enCurso: b.enCurso === true,
  };
}
export function leerPlan(v: unknown): DatosPlan {
  const d = objeto(v), t = objeto(d.tarea), p = objeto(d.propuesta);
  return {
    tarea: { id: texto(t.id), titulo: texto(t.titulo), tipo: texto(t.tipo), fechaLimite: instante(t.fechaLimite), horas: numero(t.horas) },
    propuesta: {
      bloques: lista(p.bloques).map(bloque), minutosNecesarios: numero(p.minutosNecesarios),
      minutosPlanificados: numero(p.minutosPlanificados), faltanMin: numero(p.faltanMin),
      aviso: p.aviso === null ? null : texto(p.aviso),
    },
    guardado: lista(d.guardado).map(guardado),
    conflictos: lista(d.conflictos).map((v) => { const c = objeto(v); return { id: texto(c.id), motivo: texto(c.motivo) }; }),
  };
}
export function construirBodyPlan(bloques: readonly BloqueAGuardar[]) {
  return { bloques: bloques.map((b) => ({ ...bloque(b), origen: b.origen })) };
}
function leerGuardado(v: unknown): ResultadoPlan {
  const d = objeto(v);
  return {
    bloques: lista(d.bloques).map(guardado), minutosPlanificados: numero(d.minutosPlanificados),
    resumen: typeof d.resumen === 'string' ? d.resumen : 'Plan guardado',
    choques: (d.choques === undefined ? [] : lista(d.choques)).map((v) => { const c = objeto(v); return { inicio: instante(c.inicio), titulo: texto(c.titulo) }; }),
  };
}
async function solicitar(tareaId: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const respuesta = await fetch('/api/plan/' + encodeURIComponent(tareaId), {
    method, cache: 'no-store', signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const datos: unknown = await respuesta.json().catch(() => null);
  if (respuesta.status !== 200) {
    const respaldo: Record<number, string> = {
      401: 'Tu sesión venció. Inicia sesión de nuevo.',
      404: 'La actividad ya no está disponible.',
      409: 'La actividad ya está cerrada.',
      500: 'No se pudo completar la solicitud. Intenta de nuevo.',
    };
    const error = datos && typeof datos === 'object' && 'error' in datos && typeof datos.error === 'string' ? datos.error : null;
    throw new ErrorPlan(respuesta.status, error || respaldo[respuesta.status] || 'No se pudo consultar el plan.');
  }
  // Un 200 confirma la mutación incluso si el cuerpo no se puede interpretar.
  if (method !== 'GET') avisarAgendaActualizada();
  return datos;
}
export async function cargarPlan(tareaId: string, signal?: AbortSignal): Promise<DatosPlan> {
  return leerPlan(await solicitar(tareaId, 'GET', undefined, signal));
}
export async function guardarPlan(tareaId: string, bloques: readonly BloqueAGuardar[]): Promise<ResultadoPlan> {
  const datos = await solicitar(tareaId, 'POST', construirBodyPlan(bloques));
  try { return leerGuardado(datos); }
  catch { throw new ErrorPlan(200, 'El plan se guardó, pero no pude leer el resultado. Vuelve a consultar antes de guardar otra vez.'); }
}
export async function eliminarPlan(tareaId: string): Promise<number> {
  const datos = await solicitar(tareaId, 'DELETE');
  try { return numero(objeto(datos).eliminados); }
  catch { throw new ErrorPlan(200, 'El plan se eliminó, pero no pude leer el resultado. Vuelve a consultar.'); }
}
