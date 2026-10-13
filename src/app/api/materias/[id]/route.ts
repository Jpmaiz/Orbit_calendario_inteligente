import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarMateria } from '@/lib/validacion/materia';

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validarMateria(body, 'editar');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    const existente = await prisma.materia.findFirst({
      where: { id, usuarioId: user.id, eliminadoEn: null },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 });
    }

    const materia = await prisma.materia.update({ where: { id }, data: v.datos });
    return NextResponse.json({ materia });
  } catch (error) {
    console.error('Error PATCH /api/materias/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar la materia' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existente = await prisma.materia.findFirst({
      where: { id, usuarioId: user.id, eliminadoEn: null },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 });
    }

    await prisma.materia.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
    return NextResponse.json({ mensaje: 'Materia eliminada' });
  } catch (error) {
    console.error('Error DELETE /api/materias/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar la materia' }, { status: 500 });
  }
}