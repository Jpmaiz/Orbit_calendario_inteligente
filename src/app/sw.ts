/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Service worker de Orbit (Serwist). Lo compila src/app/serwist/[path]/route.ts y se sirve en /serwist/sw.js.
 * - Sin conexión se ve lo último guardado: páginas y respuestas GET de /api (las de siempre de Serwist: primero la red).
 * - Nunca se guarda: Supabase (inicio de sesión) ni la IA. Los POST, PATCH y DELETE tampoco (solo se guardan los GET).
 * - Si una pantalla nunca se abrió con internet, se muestra /~offline.
 * - Al cerrar sesión se borran las cachés con datos del usuario (src/lib/pwa/cache.ts).
 */
import { defaultCache } from '@serwist/turbopack/worker';
import { NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ url }) => url.hostname.endsWith('.supabase.co'), handler: new NetworkOnly() },
    { matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/ia/'), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: '/~offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
