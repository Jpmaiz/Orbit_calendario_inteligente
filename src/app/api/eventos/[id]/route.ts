import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarEvento } from '@/lib/validacion/evento';

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

  const v = validarEvento(body, 'editar');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    const existente = await prisma.eventoFijo.findFirst({
      where: { id, usuarioId: user.id, eliminadoEn: null },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    if (v.datos.materiaId) {
      const materia = await prisma.materia.findFirst({
        where: { id: v.datos.materiaId, usuarioId: user.id, eliminadoEn: null },
      });
      if (!materia) {
        return NextResponse.json({ error: 'Materia no encontrada' }, { status: 400 });
      }
    }

    const evento = await prisma.eventoFijo.update({ where: { id }, data: v.datos });
    return NextResponse.json({ evento });
  } catch (error) {
    console.error('Error PATCH /api/eventos/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar el evento' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existente = await prisma.eventoFijo.findFirst({
      where: { id, usuarioId: user.id, eliminadoEn: null },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    await prisma.eventoFijo.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
    return NextResponse.json({ mensaje: 'Evento eliminado' });
  } catch (error) {
    console.error('Error DELETE /api/eventos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar el evento' }, { status: 500 });
  }
}