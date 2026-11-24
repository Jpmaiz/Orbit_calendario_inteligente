/**
 * Cachés del service worker que guardan datos del usuario (respuestas de /api y páginas ya abiertas).
 * Se borran al llegar a /login o /registro: en un teléfono compartido, nadie ve lo del anterior sin conexión.
 */
export const CACHES_DE_USUARIO = ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'others', 'next-data'] as const;

export async function limpiarDatosOffline(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await Promise.all(CACHES_DE_USUARIO.map((nombre) => caches.delete(nombre)));
  } catch {
    // Sin permiso de almacenamiento (modo privado): no hay nada que borrar
  }
}
