import { avisarAgendaActualizada } from './actualizacionAgenda';

/** v2.14 «¿Cómo estás hoy?»: tres botones opcionales; el back solo PROPONE y nada se mueve sin confirmar. */
export type EstadoAnimo = 'energia' | 'normal' | 'cansado';
export type Tramo = { inicio: Date; fin: Date };
export type CambioBloque = { id: string; tareaId: string; titulo: string; de: Tramo; a: Tramo; razon: string | null };
export type PropuestaAnimo = { cambios: CambioBloque[]; mensaje: string | null };
export type SugerenciaAnimo = { texto: string; cambio: Record<string, unknown> } | null;

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const esEstado = (v: unknown): v is EstadoAnimo => v === 'energia' || v === 'normal' || v === 'cansado';
function tramo(v: unknown): Tramo | null {
  const t = objeto(v);
  const inicio = new Date(String(t.inicio)), fin = new Date(String(t.fin));
  return Number.isNaN(+inicio) || Number.isNaN(+fin) ? null : { inicio, fin };
}

async function pedir(url: string, init?: RequestInit): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(url, { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  } catch {
    throw new Error('No hay conexión. Inténtalo de nuevo en un momento.');
  }
  const datos: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    const error = objeto(datos).error;
    throw new Error(typeof error === 'string' && error.trim() ? error : 'No se pudo completar. Inténtalo de nuevo.');
  }
  return datos;
}

/** GET /api/dia/animo → lo que marcó hoy (o null) y una sugerencia rara («Los lunes sueles tener poca energía…»). */
export async function leerAnimo(signal?: AbortSignal): Promise<{ hoy: EstadoAnimo | null; sugerencia: SugerenciaAnimo }> {
  const d = objeto(await pedir('/api/dia/animo', { signal }));
  const s = objeto(d.sugerencia);
  return {
    hoy: esEstado(d.hoy) ? d.hoy : null,
    sugerencia: typeof s.texto === 'string' && s.texto && s.cambio && typeof s.cambio === 'object' ? { texto: s.texto, cambio: s.cambio as Record<string, unknown> } : null,
  };
}

/** POST /api/dia/animo: guarda cómo está hoy y devuelve una propuesta (no mueve nada). */
export async function enviarAnimo(estado: EstadoAnimo): Promise<PropuestaAnimo> {
  const p = objeto(objeto(await pedir('/api/dia/animo', { method: 'POST', body: JSON.stringify({ estado }) })).propuesta);
  const cambios = (Array.isArray(p.cambios) ? p.cambios : []).flatMap((x): CambioBloque[] => {
    const c = objeto(x), de = tramo(c.de), a = tramo(c.a);
    return typeof c.id === 'string' && de && a
      ? [{ id: c.id, tareaId: String(c.tareaId ?? ''), titulo: String(c.titulo ?? 'Estudio'), de, a, razon: typeof c.razon === 'string' && c.razon.trim() ? c.razon : null }] : [];
  });
  return { cambios, mensaje: typeof p.mensaje === 'string' && p.mensaje.trim() ? p.mensaje : null };
}

/** POST /api/dia/reacomodar: todo o nada. Después, Tu día se vuelve a cargar. */
export async function reacomodar(cambios: CambioBloque[]): Promise<void> {
  await pedir('/api/dia/reacomodar', {
    method: 'POST',
    body: JSON.stringify({ cambios: cambios.map((c) => ({ id: c.id, inicio: c.a.inicio.toISOString(), fin: c.a.fin.toISOString() })) }),
  });
  avisarAgendaActualizada();
}

/** Nombres cortos y con onda para cada estado (burbuja e insignia del saludo). */
export const NOMBRE_ANIMO: Record<EstadoAnimo, string> = { energia: 'A full', normal: 'Tranqui', cansado: 'Modo ahorro' };

/** La burbuja avisa lo elegido; la insignia del saludo pide volver a abrirla. */
export const ANIMO_ELEGIDO = 'orbit:animo-elegido';
export const ANIMO_CAMBIAR = 'orbit:animo-cambiar';
export const avisarAnimo = (estado: EstadoAnimo) => window.dispatchEvent(new CustomEvent<EstadoAnimo>(ANIMO_ELEGIDO, { detail: estado }));
export const pedirCambioAnimo = () => window.dispatchEvent(new Event(ANIMO_CAMBIAR));
