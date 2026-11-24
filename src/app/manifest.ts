import type { MetadataRoute } from 'next';

/** Manifiesto de la PWA (/manifest.webmanifest): Orbit se instala en el celular como una app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orbit — Tu tiempo en órbita',
    short_name: 'Orbit',
    description: 'Organizador académico inteligente: estima, prioriza y planifica tu estudio.',
    lang: 'es',
    start_url: '/dia',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#35695D',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
