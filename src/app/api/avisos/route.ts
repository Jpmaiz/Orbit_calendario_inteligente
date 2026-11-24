import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { leerPreferencias, normalizarPreferencias } from '@/lib/avisos/preferencias';
import { avisosConfigurados } from '@/lib/avisos/enviar';

/**
 * GET /api/avisos → { configurado, preferencias: { bloques, manana }, dispositivos }
 * configurado = el servidor tiene las claves VAPID (si es false, ocultar la opción de avisos).
 * dispositivos = cuántos dispositivos del usuario tienen los avisos activados.
 * Si ESTE dispositivo los tiene, lo sabe el front con pushManager.getSubscription() (src/lib/pwa/avisos.ts).
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const [u, dispositivos] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: user.id }, select: { avisos: true } }),
      prisma.suscripcionPush.count({ where: { usuarioId: user.id } }),
    ]);
    return NextResponse.json({ configurado: avisosConfigurados(), preferencias: leerPreferencias(u?.avisos), dispositivos });
  } catch (error) {
    console.error('Error GET /api/avisos:', error);
    return NextResponse.json({ error: 'Error al leer los avisos' }, { status: 500 });
  }
}

/** PATCH /api/avisos  Body: { bloques?: boolean, manana?: boolean } → 200 { preferencias } (interruptores, sin texto). */
export async function PATCH(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  try {
    const actual = await prisma.usuario.findUnique({ where: { id: user.id }, select: { avisos: true } });
    const v = normalizarPreferencias(body, leerPreferencias(actual?.avisos));
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    await prisma.usuario.update({ where: { id: user.id }, data: { avisos: v.avisos } });
    return NextResponse.json({ preferencias: v.avisos });
  } catch (error) {
    console.error('Error PATCH /api/avisos:', error);
    return NextResponse.json({ error: 'Error al guardar los avisos' }, { status: 500 });
  }
}
