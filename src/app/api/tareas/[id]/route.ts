import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarTarea } from '@/lib/validacion/tarea';
import { moverVinculadas } from '@/lib/tareas/vinculos';
import { registrarHoras } from '@/lib/aprendizaje/senales';

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
    // Horas: un número = las fija el usuario y mandan. null = vuelve a la estimación automática (la guardada).
    if (v.datos.duracionEstMin !== undefined) {
      data.horasDelUsuario = v.datos.duracionEstMin !== null;
      if (v.datos.duracionEstMin === null) {
        const horas = (existente.estimacion as { horas?: unknown } | null)?.horas;
        data.duracionEstMin = typeof horas === 'number' && horas > 0 ? Math.round(horas * 60) : null;
      }
    }

    // completadaEn se maneja solo según el estado
    if (v.datos.estado !== undefined) {
      data.completadaEn =
        v.datos.estado === 'completada' ? existente.completadaEn ?? new Date() : null;
    }

    // Cierre automático: reabrir una tarea (cerrada sola o a mano) impide que se vuelva a cerrar sola.
    // Si cambia la fecha, se limpia: la nueva fecha vuelve a seguir la regla normal.
    const cerrada = existente.estado === 'completada' || existente.estado === 'no_realizada';
    const reabre = cerrada && (v.datos.estado === 'pendiente' || v.datos.estado === 'en_proceso');
    if (v.datos.fechaLimite !== undefined && +new Date(v.datos.fechaLimite) !== +existente.fechaLimite) data.cerradaSolaEn = null;
    else if (reabre) data.cerradaSolaEn = existente.cerradaSolaEn ?? new Date();

    const tarea = await prisma.tarea.update({ where: { id }, data });

    // "Vence con": si cambió la fecha de este examen, las entregas atadas a él se mueven con él
    if (v.datos.fechaLimite !== undefined || v.datos.horaDefinida !== undefined) {
      await moverVinculadas(user.id, id, 'tarea', tarea.fechaLimite, tarea.horaDefinida);
    }
    // Aprendizaje (Fase 3): si el usuario cambió las horas a mano, ese es su número real (peso 1)
    if (v.datos.duracionEstMin != null && v.datos.duracionEstMin !== existente.duracionEstMin) {
      try {
        await registrarHoras(user.id, { ...existente, materiaId: tarea.materiaId, tipo: tarea.tipo }, v.datos.duracionEstMin / 60, 'edicion');
      } catch (error) {
        console.error('Aprendizaje por edición (no bloquea):', error);
      }
    }

    // Plan de estudio: si la actividad se cerró, sus bloques futuros salen del calendario
    if (tarea.estado === 'completada' || tarea.estado === 'no_realizada') {
      await prisma.sugerencia.deleteMany({ where: { usuarioId: user.id, tareaId: id, estado: 'aceptada', fechaInicio: { gt: new Date() } } });
    }
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