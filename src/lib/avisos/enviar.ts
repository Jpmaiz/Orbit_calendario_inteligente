/**
 * Envío de avisos push (D25) con web-push y claves VAPID. Solo en el servidor.
 * Variables: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_CONTACTO (mailto: o https:, opcional).
 * Una suscripción que ya no existe (el usuario borró la app o quitó el permiso: 404/410) se borra sola.
 */
import { sendNotification, setVapidDetails, WebPushError } from 'web-push';
import { prisma } from '@/lib/prisma/cliente';
import type { Aviso } from './mensajes';

let configurado: boolean | null = null;

export function avisosConfigurados(): boolean {
  if (configurado !== null) return configurado;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return (configurado = false);
  setVapidDetails(process.env.VAPID_CONTACTO || 'https://orbit-calendario-inteligente.vercel.app', publica, privada);
  return (configurado = true);
}

/** Manda el aviso a todos los dispositivos del usuario. Devuelve a cuántos llegó. */
export async function enviarAUsuario(usuarioId: string, aviso: Aviso, ttlSegundos = 1800): Promise<number> {
  if (!avisosConfigurados()) return 0;
  const subs = await prisma.suscripcionPush.findMany({ where: { usuarioId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  const cuerpo = JSON.stringify(aviso);
  const resultados = await Promise.allSettled(subs.map((s) =>
    sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, { TTL: ttlSegundos, urgency: 'normal' }),
  ));
  const vencidas = subs.filter((_, i) => {
    const r = resultados[i];
    return r.status === 'rejected' && r.reason instanceof WebPushError && (r.reason.statusCode === 404 || r.reason.statusCode === 410);
  });
  if (vencidas.length) await prisma.suscripcionPush.deleteMany({ where: { id: { in: vencidas.map((s) => s.id) } } });
  for (const [i, r] of resultados.entries()) {
    if (r.status === 'rejected' && !vencidas.includes(subs[i])) console.error('Aviso push no enviado:', (r.reason as Error)?.message);
  }
  return resultados.filter((r) => r.status === 'fulfilled').length;
}
