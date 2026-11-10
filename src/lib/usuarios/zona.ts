import { prisma } from '@/lib/prisma/cliente';

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
