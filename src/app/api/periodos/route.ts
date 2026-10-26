import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { diaEnZona, periodoVigente } from '@/lib/periodos/periodos';

const DIA_MS = 86_400_000;

// GET /api/periodos → { periodos, actual }  (actual = el que contiene hoy, o null)
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const [periodos, actual] = await Promise.all([
      prisma.periodoAcademico.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        orderBy: { inicio: 'desc' },
      }),
      periodoVigente(user.id),
    ]);
    return NextResponse.json({ periodos, actual });
  } catch (error) {
    console.error('Error GET /api/periodos:', error);
    return NextResponse.json({ error: 'Error al obtener los periodos' }, { status: 500 });
  }
}

// POST /api/periodos → crear  Body: { nombre: "II/2026", inicio: "2026-08-03", fin: "2026-12-11" }
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (!nombre || nombre.length > 50) {
    return NextResponse.json({ error: 'El nombre debe tener entre 1 y 50 caracteres (ej. "II/2026")' }, { status: 400 });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: user.id }, select: { zonaHoraria: true } });
    const zona: string = usuario?.zonaHoraria ?? 'America/La_Paz';

    // inicio = primer minuto del día; fin = último minuto del día (hora del usuario)
    const inicio = typeof body.inicio === 'string' ? diaEnZona(body.inicio, '00:00', zona) : null;
    const fin = typeof body.fin === 'string' ? diaEnZona(body.fin, '23:59', zona) : null;
    if (!inicio || !fin) {
      return NextResponse.json({ error: 'Fechas inválidas: usa el formato AAAA-MM-DD' }, { status: 400 });
    }
    const dias = (fin.getTime() - inicio.getTime()) / DIA_MS;
    if (dias < 7 || dias > 366) {
      return NextResponse.json({ error: 'El periodo debe durar entre 1 semana y 1 año' }, { status: 400 });
    }

    // Dos semestres no se pueden pisar: así "el periodo de hoy" es siempre uno solo
    const choca = await prisma.periodoAcademico.findFirst({
      where: { usuarioId: user.id, eliminadoEn: null, inicio: { lte: fin }, fin: { gte: inicio } },
    });
    if (choca) {
      return NextResponse.json(
        { error: `Se cruza con el periodo «${choca.nombre}»`, periodo: choca },
        { status: 409 },
      );
    }

    const periodo = await prisma.periodoAcademico.create({
      data: { usuarioId: user.id, nombre, inicio, fin },
    });
    return NextResponse.json({ periodo }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/periodos:', error);
    return NextResponse.json({ error: 'Error al crear el periodo' }, { status: 500 });
  }
}