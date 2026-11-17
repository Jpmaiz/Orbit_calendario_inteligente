import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { nombreVisible, normalizarApodo } from '@/lib/usuarios/perfil';

const seleccion = { nombre: true, apodo: true, email: true } as const;
const respuesta = (u: { nombre: string; apodo: string | null; email: string }) =>
  ({ nombre: u.nombre, apodo: u.apodo, nombreVisible: nombreVisible(u), correo: u.email });

/**
 * GET /api/perfil → { nombre, apodo, nombreVisible, correo }
 * nombre = el de registro (no se edita aquí); apodo = cómo quiere que Orbit lo llame; nombreVisible = apodo || nombre.
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const u = await prisma.usuario.findUnique({ where: { id: user.id }, select: seleccion });
    if (!u) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    return NextResponse.json(respuesta(u));
  } catch (error) {
    console.error('Error GET /api/perfil:', error);
    return NextResponse.json({ error: 'Error al obtener el perfil' }, { status: 500 });
  }
}

/**
 * PATCH /api/perfil  Body: { apodo: string | null }
 * Guarda el apodo (máx. 40 caracteres). "" o null lo quita y se vuelve a mostrar el nombre de registro.
 * El nombre de registro, el correo y Supabase Auth no se tocan.
 * 200 { nombre, apodo, nombreVisible, correo }
 */
export async function PATCH(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: { apodo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!('apodo' in (body ?? {}))) return NextResponse.json({ error: 'Usa { apodo: string | null }' }, { status: 400 });
  const v = normalizarApodo(body.apodo);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const u = await prisma.usuario.update({ where: { id: user.id }, data: { apodo: v.apodo }, select: seleccion });
    return NextResponse.json(respuesta(u));
  } catch (error) {
    console.error('Error PATCH /api/perfil:', error);
    return NextResponse.json({ error: 'Error al guardar el apodo' }, { status: 500 });
  }
}
