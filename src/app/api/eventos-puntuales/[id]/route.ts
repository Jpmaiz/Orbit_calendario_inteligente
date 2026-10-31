import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarEventoPuntual, validarRango } from '@/lib/validacion/eventoPuntual';
import { revisarEvento } from '@/lib/eventos/revisarEvento';

type Contexto = { params: Promise<{ id: string }> };

const materia = { select: { id: true, nombre: true, color: true } };

async function buscarPropio(id: string, usuarioId: string) {
  return prisma.evento.findFirst({ where: { id, usuarioId, eliminadoEn: null }, include: { materia } });
}

// GET /api/eventos-puntuales/[id] → un evento (para la pantalla de edición)
export async function GET(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const evento = await buscarPropio(id, user.id);
    if (!evento) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ evento });
  } catch (error) {
    console.error('Error GET /api/eventos-puntuales/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener el evento' }, { status: 500 });
  }
}

/**
 * PATCH /api/eventos-puntuales/[id] → editar (todo opcional)
 * Body: { titulo?, inicio?, fin?, descripcion?, ubicacion?, materiaId? }
 * 200 { evento, choques }  — choques se recalculan con los datos NUEVOS
 */
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

  const v = validarEventoPuntual(body, 'editar');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    const existente = await buscarPropio(id, user.id);
    if (!existente) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    // inicio y fin se validan JUNTOS: lo que llega + lo que ya estaba
    const inicio = v.datos.inicio ?? existente.inicio;
    const fin = v.datos.fin !== undefined ? v.datos.fin : existente.fin;
    const errorRango = validarRango(inicio, fin);
    if (errorRango) {
      return NextResponse.json({ error: errorRango }, { status: 400 });
    }

    if (v.datos.materiaId) {
      const m = await prisma.materia.findFirst({
        where: { id: v.datos.materiaId, usuarioId: user.id, eliminadoEn: null },
      });
      if (!m) {
        return NextResponse.json({ error: 'Materia no encontrada' }, { status: 400 });
      }
    }

    const evento = await prisma.evento.update({ where: { id }, data: v.datos, include: { materia } });
    const { choques } = await revisarEvento(user.id, evento.titulo, evento.inicio, evento.fin, id);
    return NextResponse.json({ evento, choques });
  } catch (error) {
    console.error('Error PATCH /api/eventos-puntuales/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar el evento' }, { status: 500 });
  }
}

// DELETE /api/eventos-puntuales/[id] → borrado suave (eliminadoEn)
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const existente = await buscarPropio(id, user.id);
    if (!existente) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    await prisma.evento.update({ where: { id }, data: { eliminadoEn: new Date() } });
    return NextResponse.json({ mensaje: 'Evento eliminado' });
  } catch (error) {
    console.error('Error DELETE /api/eventos-puntuales/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar el evento' }, { status: 500 });
  }
}
