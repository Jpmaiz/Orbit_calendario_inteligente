// Utilidad de fechas de la captura IA.
// El flujo legado (POST /api/ia con guardar: true) se eliminó: la captura usa /api/ia/extraer + /api/ia/confirmar.

/** "2026-10-29T18:00" (lo que devuelve un <input type="datetime-local">) → ISO en UTC, interpretado en hora de Bolivia. */
export function fechaElegidaISO(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const fecha = new Date(valor + ':00-04:00');
  if (Number.isNaN(fecha.getTime())) return null;
  const local = new Date(fecha.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return local === valor ? fecha.toISOString() : null;
}
