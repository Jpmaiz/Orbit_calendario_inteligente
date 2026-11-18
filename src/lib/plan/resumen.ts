/**
 * Resumen del plan de estudio de cada actividad (para "Plan listo · 3 bloques" y "~19 h por planificar").
 * Cuenta TODOS los bloques guardados (aceptados o cumplidos, pasados y futuros), estén o no en el rango que
 * pidió el front. Los omitidos no cuentan. Código puro; la consulta está en cargar.ts (cargarResumenPlanes).
 */
export type ResumenPlan = { bloques: number; minutos: number; proximo: string | null };

/** Puro: agrupa los bloques por actividad. `proximo` = inicio del primer bloque que todavía no terminó. */
export function resumirBloques(
  bloques: { tareaId: string; inicio: Date; fin: Date }[], ahora: Date = new Date(),
): Map<string, ResumenPlan> {
  const salida = new Map<string, ResumenPlan & { proximoMs: number | null }>();
  for (const b of bloques) {
    const r = salida.get(b.tareaId) ?? { bloques: 0, minutos: 0, proximo: null, proximoMs: null };
    r.bloques += 1;
    r.minutos += Math.round((b.fin.getTime() - b.inicio.getTime()) / 60_000);
    if (b.fin > ahora && (r.proximoMs === null || b.inicio.getTime() < r.proximoMs)) r.proximoMs = b.inicio.getTime();
    salida.set(b.tareaId, r);
  }
  return new Map([...salida].map(([id, r]) => [id, {
    bloques: r.bloques, minutos: r.minutos, proximo: r.proximoMs === null ? null : new Date(r.proximoMs).toISOString(),
  }]));
}
