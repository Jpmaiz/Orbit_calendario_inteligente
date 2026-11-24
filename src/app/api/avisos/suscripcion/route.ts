import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';

const MAX_DISPOSITIVOS = 10;

function leerSuscripcion(v: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const s = (v ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const corto = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max;
  if (!corto(s.endpoint, 1000) || !(s.endpoint as string).startsWith('https://')) return null;
  if (!corto(s.keys?.p256dh, 200) || !corto(s.keys?.auth, 100)) return null;
  return { endpoint: s.endpoint as string, p256dh: s.keys!.p256dh as string, auth: s.keys!.auth as string };
}

/**
 * POST /api/avisos/suscripcion  Body: { suscripcion: PushSubscription.toJSON() } → 200 { dispositivos }
 * Activa los avisos en este dispositivo. Si el dispositivo era de otra cuenta, pasa a esta. Máximo 10 por usuario.
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: { suscripcion?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const s = leerSuscripcion(body?.suscripcion);
  if (!s) return NextResponse.json({ error: 'Usa { suscripcion: { endpoint, keys: { p256dh, auth } } }' }, { status: 400 });
  try {
    await prisma.suscripcionPush.upsert({
      where: { endpoint: s.endpoint },
      create: { usuarioId: user.id, ...s },
      update: { usuarioId: user.id, p256dh: s.p256dh, auth: s.auth },
    });
    const todas = await prisma.suscripcionPush.findMany({ where: { usuarioId: user.id }, orderBy: { creadoEn: 'desc' }, select: { id: true } });
    if (todas.length > MAX_DISPOSITIVOS) {
      await prisma.suscripcionPush.deleteMany({ where: { id: { in: todas.slice(MAX_DISPOSITIVOS).map((t) => t.id) } } });
    }
    return NextResponse.json({ dispositivos: Math.min(todas.length, MAX_DISPOSITIVOS) });
  } catch (error) {
    console.error('Error POST /api/avisos/suscripcion:', error);
    return NextResponse.json({ error: 'No se pudieron activar los avisos' }, { status: 500 });
  }
}

/** DELETE /api/avisos/suscripcion  Body: { endpoint } → 200 { eliminados }. Apaga los avisos en este dispositivo. */
export async function DELETE(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Usa { endpoint }' }, { status: 400 });
  try {
    const r = await prisma.suscripcionPush.deleteMany({ where: { usuarioId: user.id, endpoint: body.endpoint } });
    return NextResponse.json({ eliminados: r.count });
  } catch (error) {
    console.error('Error DELETE /api/avisos/suscripcion:', error);
    return NextResponse.json({ error: 'No se pudieron apagar los avisos' }, { status: 500 });
  }
}
