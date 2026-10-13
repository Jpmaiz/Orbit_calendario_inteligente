import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarMateria } from '@/lib/validacion/materia';

export async function GET() {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const materias = await prisma.materia.findMany({
      where: { usuarioId: user.id, eliminadoEn: null },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json({ materias });
  } catch (error) {
    console.error('Error GET /api/materias:', error);
    return NextResponse.json({ error: 'Error al obtener materias' }, { status: 500 });
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

  const v = validarMateria(body, 'crear');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    const materia = await prisma.materia.create({
      data: {
        nombre: v.datos.nombre!,
        color: v.datos.color ?? undefined,
        semestre: v.datos.semestre ?? null,
        usuarioId: user.id,
      },
    });
    return NextResponse.json({ materia }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/materias:', error);
    return NextResponse.json({ error: 'Error al crear la materia' }, { status: 500 });
  }
}