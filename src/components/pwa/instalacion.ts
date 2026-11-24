'use client';

/** Evento de Chrome/Android para instalar (no está en los tipos de TS). */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

// El evento llega una sola vez, al cargar la página: se guarda aquí (el aviso de conexión importa este archivo
// en el layout raíz), así el perfil lo encuentra aunque se abra después.
let guardado: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); guardado = e as EventoInstalar; avisar(); });
  window.addEventListener('appinstalled', () => { guardado = null; avisar(); });
}

export const suscribirInstalacion = (f: () => void) => {
  oyentes.add(f);
  const modo = window.matchMedia('(display-mode: standalone)');
  modo.addEventListener('change', f);
  return () => { oyentes.delete(f); modo.removeEventListener('change', f); };
};
export const puedeInstalar = () => guardado !== null;
export const estaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const esIPhone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Abre el diálogo de Chrome. true si la instaló. */
export async function instalar(): Promise<boolean> {
  const e = guardado;
  if (!e) return false;
  guardado = null;
  avisar();
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}
