/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Service worker de Orbit (Serwist). Lo compila src/app/serwist/[path]/route.ts y se sirve en /serwist/sw.js.
 * - Sin conexión se ve lo último guardado: páginas y respuestas GET de /api (las de siempre de Serwist: primero la red).
 * - Nunca se guarda: Supabase (inicio de sesión) ni la IA. Los POST, PATCH y DELETE tampoco (solo se guardan los GET).
 * - Si una pantalla nunca se abrió con internet, se muestra /~offline.
 * - Al cerrar sesión se borran las cachés con datos del usuario (src/lib/pwa/cache.ts).
 * - Avisos push (D25): muestra el aviso que manda el servidor y, al tocarlo, abre Orbit en esa pantalla.
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

type Aviso = { titulo?: string; cuerpo?: string; url?: string; tag?: string };

self.addEventListener('push', (evento) => {
  let aviso: Aviso = {};
  try {
    aviso = (evento.data?.json() ?? {}) as Aviso;
  } catch {
    aviso = { cuerpo: evento.data?.text() };
  }
  evento.waitUntil(self.registration.showNotification(aviso.titulo ?? 'Orbit', {
    body: aviso.cuerpo,
    icon: '/icons/icon-192.png',
    tag: aviso.tag,
    data: { url: aviso.url ?? '/dia' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data as { url?: string } | null)?.url ?? '/dia', self.location.origin).href;
  evento.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
    if (abierta) {
      await abierta.focus();
      await abierta.navigate(url).catch(() => undefined);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
