import { prisma } from '@/lib/prisma/cliente';
import { leerRitmo, type Ritmo } from './ritmo';

/**
 * Zona horaria del usuario, en caché por proceso (10 min).
 * Casi todos los endpoints la necesitan y la base está lejos (São Paulo): leerla en cada pedido sumaba
 * un viaje entero antes de las consultas de verdad. Ningún endpoint la cambia hoy; si alguno lo hace,
 * debe llamar a olvidarZona().
 */
const cache = new Map<string, { zona: string; hasta: number }>();
const TTL_MS = 10 * 60_000;

export async function zonaDeUsuario(usuarioId: string): Promise<string> {
  const c = cache.get(usuarioId);
  if (c && c.hasta > Date.now()) return c.zona;
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { zonaHoraria: true } });
  const zona = u?.zonaHoraria ?? 'America/La_Paz';
  cache.set(usuarioId, { zona, hasta: Date.now() + TTL_MS });
  return zona;
}

export function olvidarZona(usuarioId: string) {
  cache.delete(usuarioId);
}

/** Ritmo del usuario, en caché por proceso (10 min). Guardarlo debe llamar a olvidarRitmo(). */
const cacheRitmo = new Map<string, { ritmo: Ritmo; hasta: number }>();

export async function ritmoDeUsuario(usuarioId: string): Promise<Ritmo> {
  const c = cacheRitmo.get(usuarioId);
  if (c && c.hasta > Date.now()) return c.ritmo;
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { ritmo: true } });
  const ritmo = leerRitmo(u?.ritmo ?? null);
  cacheRitmo.set(usuarioId, { ritmo, hasta: Date.now() + TTL_MS });
  return ritmo;
}

export function olvidarRitmo(usuarioId: string) {
  cacheRitmo.delete(usuarioId);
}
