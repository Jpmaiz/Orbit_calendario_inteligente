import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarEventoPuntual, validarRango } from '@/lib/validacion/eventoPuntual';
import { revisarEvento } from '@/lib/eventos/revisarEvento';

/**
 * Eventos de UNA sola vez (reunión, charla, defensa).
 * Las clases semanales están en /api/eventos. Para LISTAR por fechas usar /api/agenda.
 *
 * POST /api/eventos-puntuales
 * Body: { titulo, inicio, fin?, descripcion?, ubicacion?, materiaId?, confirmarNueva? }
 * - 201 { evento, choques }   choques = aviso, no bloquea
 * - 409 { error, duplicado }  ya hay uno igual a menos de 1 h → reenviar con confirmarNueva: true si es otro
 */
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

  const v = validarEventoPuntual(body, 'crear');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const { titulo, inicio, fin = null, ...resto } = v.datos;
  const errorRango = validarRango(inicio!, fin);
  if (errorRango) {
    return NextResponse.json({ error: errorRango }, { status: 400 });
  }
  const confirmarNueva = (body as { confirmarNueva?: unknown }).confirmarNueva === true;

  try {
    if (resto.materiaId) {
      const materia = await prisma.materia.findFirst({
        where: { id: resto.materiaId, usuarioId: user.id, eliminadoEn: null },
      });
      if (!materia) {
        return NextResponse.json({ error: 'Materia no encontrada' }, { status: 400 });
      }
    }

    const revision = await revisarEvento(user.id, titulo!, inicio!, fin);
    if (revision.duplicado && !confirmarNueva) {
      return NextResponse.json(
        { error: `Ya tienes «${revision.duplicado.titulo}» a esa hora. ¿Es otro?`, duplicado: revision.duplicado },
        { status: 409 },
      );
    }

    const evento = await prisma.evento.create({
      data: { ...resto, titulo: titulo!, inicio: inicio!, fin, origen: 'manual', usuarioId: user.id },
      include: { materia: { select: { id: true, nombre: true, color: true } } },
    });

    return NextResponse.json({ evento, choques: revision.choques }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/eventos-puntuales:', error);
    return NextResponse.json({ error: 'Error al crear el evento' }, { status: 500 });
  }
}
