import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarTarea } from '@/lib/validacion/tarea';

type Contexto = { params: Promise<{ id: string }> };

// PATCH /api/tareas/[id] → editar (incluye marcar completada)
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

  const v = validarTarea(body, 'editar');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    // Solo puede editar SUS tareas
    const existente = await prisma.tarea.findFirst({
      where: { id, usuarioId: user.id, eliminadoEn: null },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    if (v.datos.materiaId) {
      const materia = await prisma.materia.findFirst({
        where: { id: v.datos.materiaId, usuarioId: user.id, eliminadoEn: null },
      });
      if (!materia) {
        return NextResponse.json({ error: 'Materia no encontrada' }, { status: 400 });
      }
    }

    const data: Prisma.TareaUncheckedUpdateInput = { ...v.datos };

    // completadaEn se maneja solo según el estado
    if (v.datos.estado !== undefined) {
      data.completadaEn =
        v.datos.estado === 'completada' ? existente.completadaEn ?? new Date() : null;
    }

    const tarea = await prisma.tarea.update({ where: { id }, data });
    return NextResponse.json({ tarea });
  } catch (error) {
    console.error('Error PATCH /api/tareas/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar la tarea' }, { status: 500 });
  }
}

// DELETE /api/tareas/[id] → soft delete
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existente = await prisma.tarea.findFirst({
      where: { id, usuarioId: user.id, eliminadoEn: null },
    });
    if (!existente) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    await prisma.tarea.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });

    return NextResponse.json({ mensaje: 'Tarea eliminada' });
  } catch (error) {
    console.error('Error DELETE /api/tareas/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar la tarea' }, { status: 500 });
  }
}