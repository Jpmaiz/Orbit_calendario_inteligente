/** Mensaje único cuando algo necesita internet. Nunca se muestra «Failed to fetch». */
export const SIN_RED = 'Necesitas internet para esto.';

/** fetch falla con TypeError («Failed to fetch», «Load failed», «NetworkError…») cuando no hay red. */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (e instanceof Error && e.name === 'AbortError') return false;
  const texto = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return e instanceof TypeError || /failed to fetch|load failed|networkerror|network request failed/i.test(texto);
}

/** El mensaje para mostrar: el de red si no hay conexión; si no, el del servidor o el de respaldo. */
export function mensajeError(e: unknown, respaldo = 'No se pudo completar. Inténtalo de nuevo.'): string {
  if (esErrorDeRed(e)) return SIN_RED;
  return e instanceof Error && e.message.trim() ? e.message : respaldo;
}
