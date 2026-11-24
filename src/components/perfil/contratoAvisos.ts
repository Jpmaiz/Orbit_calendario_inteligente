import { mensajeError } from '../pwa/errorRed';

/** v2.16 · GET/PATCH /api/avisos. El usuario lo toma el back de la sesión: nunca se manda usuarioId. */
export type PreferenciasAvisos = { bloques: boolean; manana: boolean };
export type EstadoAvisos = { configurado: boolean; preferencias: PreferenciasAvisos };

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

function leer(datos: unknown): EstadoAvisos {
  const d = objeto(datos), p = objeto(d.preferencias);
  return { configurado: d.configurado === true, preferencias: { bloques: p.bloques !== false, manana: p.manana !== false } };
}

async function pedir(init?: RequestInit): Promise<EstadoAvisos> {
  let r: Response;
  try {
    r = await fetch('/api/avisos', { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  } catch (e) {
    throw new Error(mensajeError(e, 'No se pudo conectar.'));
  }
  const datos: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    const error = objeto(datos).error;
    throw new Error(typeof error === 'string' && error.trim() ? error : 'No se pudo completar. Inténtalo de nuevo.');
  }
  return leer(datos);
}

export const leerAvisos = (signal?: AbortSignal) => pedir({ signal });
/** PATCH /api/avisos { bloques } o { manana }. */
export async function guardarPreferencia(cambio: Partial<PreferenciasAvisos>): Promise<void> {
  await pedir({ method: 'PATCH', body: JSON.stringify(cambio) });
}
