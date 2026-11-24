/**
 * Avisos en ESTE dispositivo (lado del navegador). Lo usa el front en el perfil: un interruptor "Avisos".
 * El permiso se pide SOLO cuando el usuario toca el interruptor, nunca al abrir la app.
 * En iPhone solo funciona con Orbit instalada en la pantalla de inicio (iOS 16.4 o superior).
 * El service worker solo corre en producción: en `npm run dev` los avisos no se pueden activar.
 */
export type ResultadoAvisos = { ok: true } | { ok: false; mensaje: string };

export function avisosDisponibles(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** "granted" | "denied" | "default" (todavía no se pidió) | "no-disponible" */
export function permisoAvisos(): NotificationPermission | 'no-disponible' {
  return avisosDisponibles() ? Notification.permission : 'no-disponible';
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  const listo = navigator.serviceWorker.ready;
  const espera = new Promise<null>((r) => setTimeout(() => r(null), 4000));
  return Promise.race([listo, espera]);
}

function claveABytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

/** ¿Este dispositivo ya tiene los avisos activados? */
export async function avisosActivos(): Promise<boolean> {
  if (!avisosDisponibles() || Notification.permission !== 'granted') return false;
  const reg = await registro();
  return !!(await reg?.pushManager.getSubscription());
}

export async function activarAvisos(): Promise<ResultadoAvisos> {
  if (!avisosDisponibles()) {
    return { ok: false, mensaje: 'Este navegador no permite avisos. En iPhone, primero instala Orbit en tu pantalla de inicio.' };
  }
  const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!clave) return { ok: false, mensaje: 'Los avisos todavía no están configurados.' };
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    return { ok: false, mensaje: 'Bloqueaste los avisos. Puedes permitirlos en la configuración del navegador o del teléfono.' };
  }
  const reg = await registro();
  if (!reg) return { ok: false, mensaje: 'Los avisos funcionan en la app publicada, no en modo desarrollo.' };
  try {
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave) }));
    const r = await fetch('/api/avisos/suscripcion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suscripcion: sub.toJSON() }),
    });
    if (!r.ok) return { ok: false, mensaje: 'No se pudieron activar los avisos. Inténtalo de nuevo.' };
    return { ok: true };
  } catch {
    return { ok: false, mensaje: 'No se pudieron activar los avisos. Revisa tu conexión e inténtalo de nuevo.' };
  }
}

export async function desactivarAvisos(): Promise<ResultadoAvisos> {
  if (!avisosDisponibles()) return { ok: true };
  const reg = await registro();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return { ok: true };
  try {
    await fetch('/api/avisos/suscripcion', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } finally {
    await sub.unsubscribe();
  }
  return { ok: true };
}

/** Manda un aviso de prueba a los dispositivos del usuario. */
export async function probarAvisos(): Promise<ResultadoAvisos> {
  const r = await fetch('/api/avisos/prueba', { method: 'POST' });
  if (r.ok) return { ok: true };
  const datos = (await r.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, mensaje: datos?.error ?? 'No se pudo mandar la prueba.' };
}
