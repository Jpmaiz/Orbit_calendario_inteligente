/**
 * Qué avisos quiere el usuario (D25). Se guarda en usuarios.avisos (JSON); null = todos activados.
 * Se cambian con interruptores, nunca con texto. Código puro: scripts/probar-avisos.ts.
 */
export type PreferenciasAvisos = {
  bloques: boolean; // "En 15 min: estudio de Redes"
  manana: boolean;  // a las 20:00, lo que vence mañana
};

export const AVISOS_POR_DEFECTO: PreferenciasAvisos = { bloques: true, manana: true };

export function leerPreferencias(v: unknown): PreferenciasAvisos {
  const x = (v ?? {}) as Record<string, unknown>;
  return {
    bloques: typeof x.bloques === 'boolean' ? x.bloques : AVISOS_POR_DEFECTO.bloques,
    manana: typeof x.manana === 'boolean' ? x.manana : AVISOS_POR_DEFECTO.manana,
  };
}

/** Cambio parcial ({ manana: false }); lo que no viene se conserva. */
export function normalizarPreferencias(v: unknown, actual: PreferenciasAvisos): { ok: true; avisos: PreferenciasAvisos } | { ok: false; error: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return { ok: false, error: 'Usa { bloques?: true|false, manana?: true|false }' };
  const x = v as Record<string, unknown>;
  const r = { ...actual };
  for (const k of ['bloques', 'manana'] as const) {
    if (x[k] === undefined) continue;
    if (typeof x[k] !== 'boolean') return { ok: false, error: `${k}: true o false` };
    r[k] = x[k] as boolean;
  }
  return { ok: true, avisos: r };
}
