import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarEvento } from '@/lib/validacion/evento';

export async function GET() {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const eventos = await prisma.eventoFijo.findMany({
      where: { usuarioId: user.id, eliminadoEn: null },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      include: { materia: { select: { id: true, nombre: true, color: true } } },
    });
    return NextResponse.json({ eventos });
  } catch (error) {
    console.error('Error GET /api/eventos:', error);
    return NextResponse.json({ error: 'Error al obtener eventos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const v = validarEvento(body, 'crear');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    if (v.datos.materiaId) {
      const materia = await prisma.materia.findFirst({
        where: { id: v.datos.materiaId, usuarioId: user.id, eliminadoEn: null },
      });
      if (!materia) {
        return NextResponse.json({ error: 'Materia no encontrada' }, { status: 400 });
      }
    }

    const { titulo, diaSemana, horaInicio, horaFin, ...resto } = v.datos;

    const evento = await prisma.eventoFijo.create({
      data: {
        ...resto,
        titulo: titulo!,
        diaSemana: diaSemana!,
        horaInicio: horaInicio!,
        horaFin: horaFin!,
        usuarioId: user.id,
      },
    });

    return NextResponse.json({ evento }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/eventos:', error);
    return NextResponse.json({ error: 'Error al crear el evento' }, { status: 500 });
  }
}