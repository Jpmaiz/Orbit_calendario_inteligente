import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { diaEnZona } from '@/lib/periodos/periodos';

type Contexto = { params: Promise<{ id: string }> };

const DIA_MS = 86_400_000;

/**
 * PATCH /api/periodos/[id] → corregir nombre o fechas del semestre
 * Body (todo opcional): { nombre?, inicio?: "AAAA-MM-DD", fin?: "AAAA-MM-DD" }
 *
 * Las clases COPIARON las fechas del semestre al crearse (vigenteDesde / vigenteHasta).
 * Si cambian las fechas, se actualizan SOLO las clases que todavía tienen las fechas viejas
 * (las heredadas). Las que el usuario ajustó a mano no se tocan.
 * 200 { periodo, clasesActualizadas }
 */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (body.nombre === undefined && body.inicio === undefined && body.fin === undefined) {
    return NextResponse.json({ error: 'No hay nada para actualizar' }, { status: 400 });
  }

  try {
    const existente = await prisma.periodoAcademico.findFirst({ where: { id, usuarioId: user.id, eliminadoEn: null } });
    if (!existente) {
      return NextResponse.json({ error: 'Periodo no encontrado' }, { status: 404 });
    }
    const usuario = await prisma.usuario.findUnique({ where: { id: user.id }, select: { zonaHoraria: true } });
    const zona: string = usuario?.zonaHoraria ?? 'America/La_Paz';

    // nombre
    let nombre = existente.nombre;
    if (body.nombre !== undefined) {
      nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
      if (!nombre || nombre.length > 50) {
        return NextResponse.json({ error: 'El nombre debe tener entre 1 y 50 caracteres (ej. "II/2026")' }, { status: 400 });
      }
    }

    // fechas: lo que llega + lo que ya estaba
    let inicio = existente.inicio;
    let fin = existente.fin;
    if (body.inicio !== undefined) {
      const d = typeof body.inicio === 'string' ? diaEnZona(body.inicio, '00:00', zona) : null;
      if (!d) return NextResponse.json({ error: 'Fecha de inicio inválida: usa AAAA-MM-DD' }, { status: 400 });
      inicio = d;
    }
    if (body.fin !== undefined) {
      const d = typeof body.fin === 'string' ? diaEnZona(body.fin, '23:59', zona) : null;
      if (!d) return NextResponse.json({ error: 'Fecha de fin inválida: usa AAAA-MM-DD' }, { status: 400 });
      fin = d;
    }
    const dias = (fin.getTime() - inicio.getTime()) / DIA_MS;
    if (dias < 7 || dias > 366) {
      return NextResponse.json({ error: 'El periodo debe durar entre 1 semana y 1 año' }, { status: 400 });
    }

    // No puede pisar a OTRO semestre
    const choca = await prisma.periodoAcademico.findFirst({
      where: { usuarioId: user.id, eliminadoEn: null, id: { not: id }, inicio: { lte: fin }, fin: { gte: inicio } },
    });
    if (choca) {
      return NextResponse.json({ error: `Se cruza con el periodo «${choca.nombre}»`, periodo: choca }, { status: 409 });
    }

    const cambiaInicio = inicio.getTime() !== existente.inicio.getTime();
    const cambiaFin = fin.getTime() !== existente.fin.getTime();

    const resultado = await prisma.$transaction(async (tx) => {
      const periodo = await tx.periodoAcademico.update({ where: { id }, data: { nombre, inicio, fin } });

      // Clases que heredaron las fechas viejas del semestre → se mueven con él
      let clasesActualizadas = 0;
      if (cambiaInicio) {
        const r = await tx.eventoFijo.updateMany({
          where: { usuarioId: user.id, eliminadoEn: null, vigenteDesde: existente.inicio },
          data: { vigenteDesde: inicio },
        });
        clasesActualizadas += r.count;
      }
      if (cambiaFin) {
        const r = await tx.eventoFijo.updateMany({
          where: { usuarioId: user.id, eliminadoEn: null, vigenteHasta: existente.fin },
          data: { vigenteHasta: fin },
        });
        clasesActualizadas += r.count;
      }
      // Materias creadas con el nombre viejo del semestre
      if (nombre !== existente.nombre) {
        await tx.materia.updateMany({
          where: { usuarioId: user.id, eliminadoEn: null, semestre: existente.nombre },
          data: { semestre: nombre },
        });
      }
      return { periodo, clasesActualizadas };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error PATCH /api/periodos/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar el periodo' }, { status: 500 });
  }
}

/**
 * DELETE /api/periodos/[id] → borrado suave del semestre.
 * Las clases NO se borran: conservan su vigencia (si quiere quitarlas, se borran aparte).
 */
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;

  try {
    const existente = await prisma.periodoAcademico.findFirst({ where: { id, usuarioId: user.id, eliminadoEn: null } });
    if (!existente) {
      return NextResponse.json({ error: 'Periodo no encontrado' }, { status: 404 });
    }
    await prisma.periodoAcademico.update({ where: { id }, data: { eliminadoEn: new Date() } });
    return NextResponse.json({ mensaje: 'Periodo eliminado. Tus clases se mantienen.' });
  } catch (error) {
    console.error('Error DELETE /api/periodos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar el periodo' }, { status: 500 });
  }
}
