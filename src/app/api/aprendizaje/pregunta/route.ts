import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { FACTOR_RESPUESTA, type Respuesta } from '@/lib/estimacion/personal';
import { registrarHoras } from '@/lib/aprendizaje/senales';
import { textoHoras } from '@/lib/plan/planificador';

const DIA_MS = 86_400_000;
/** Una pregunta como máximo cada 7 días, solo de actividades grandes que terminaron hace poco. */
const CADA_DIAS = 7;
const RECIENTE_DIAS = 14;
const MINUTOS_MINIMOS = 240;

/**
 * GET /api/aprendizaje/pregunta → la pregunta de la semana, o null (Fase 3).
 * Solo si pasaron 7 días desde la última, y de una actividad grande (4 h o más) que terminó en las
 * últimas 2 semanas y de la que Orbit no aprendió nada por otro lado. Al mostrarse queda registrada:
 * si el usuario la ignora, no vuelve.
 * 200 { pregunta: { tareaId, titulo, texto, horasSugeridas, opciones: ["menos", "justo", "mas"] } | null }
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const ahora = new Date();
    // Elegir y registrar en una sola transacción serializable: dos pedidos a la vez no muestran dos preguntas
    const candidata = await prisma.$transaction(async (tx) => {
      const ultima = await tx.senalAprendizaje.findFirst({
        where: { usuarioId: user.id, clase: 'pregunta', creadoEn: { gte: new Date(ahora.getTime() - CADA_DIAS * DIA_MS) } },
        select: { id: true },
      });
      if (ultima) return null;
      const t = await tx.tarea.findFirst({
        where: {
          usuarioId: user.id, eliminadoEn: null, estado: 'completada',
          duracionEstMin: { gte: MINUTOS_MINIMOS },
          fechaLimite: { gte: new Date(ahora.getTime() - RECIENTE_DIAS * DIA_MS), lte: ahora },
          horasReales: null,
          senales: { none: { clase: { in: ['horas', 'pregunta'] } } }, // ya se aprendió de ella o ya se preguntó
        },
        orderBy: { fechaLimite: 'desc' },
        select: { id: true, titulo: true, duracionEstMin: true },
      });
      if (!t) return null;
      await tx.senalAprendizaje.create({ data: { usuarioId: user.id, tareaId: t.id, clase: 'pregunta', fuente: 'mostrada', peso: 0 } });
      return t;
    }, { isolationLevel: 'Serializable' }).catch((e: { code?: string }) => {
      if (e?.code === 'P2034') return null; // otro pedido ganó la carrera: esta vez no hay pregunta
      throw e;
    });
    if (!candidata) return NextResponse.json({ pregunta: null });

    const sugeridas = (candidata.duracionEstMin ?? 0) / 60;
    return NextResponse.json({
      pregunta: {
        tareaId: candidata.id,
        titulo: candidata.titulo,
        texto: `¿Cuánto te tomó «${candidata.titulo}»? Te sugerí ~${textoHoras(Math.round(sugeridas * 60))}`,
        horasSugeridas: sugeridas,
        opciones: Object.keys(FACTOR_RESPUESTA),
      },
    });
  } catch (error) {
    console.error('Error GET /api/aprendizaje/pregunta:', error);
    return NextResponse.json({ error: 'Error al obtener la pregunta' }, { status: 500 });
  }
}

/**
 * POST /api/aprendizaje/pregunta  Body: { tareaId, respuesta: "menos" | "justo" | "mas", horas? }
 * Guarda la respuesta (un toque). `horas` opcional: si el usuario escribe el número exacto, manda.
 * 200 { ok: true }
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { tareaId?: unknown; respuesta?: unknown; horas?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const respuesta = typeof body.respuesta === 'string' && body.respuesta in FACTOR_RESPUESTA ? (body.respuesta as Respuesta) : null;
  const horasExactas = typeof body.horas === 'number' && body.horas > 0 && body.horas <= 200 ? body.horas : null;
  if (typeof body.tareaId !== 'string' || (!respuesta && !horasExactas)) {
    return NextResponse.json({ error: 'Usa { tareaId, respuesta: menos | justo | mas } o { tareaId, horas }' }, { status: 400 });
  }

  try {
    const tarea = await prisma.tarea.findFirst({
      where: { id: body.tareaId, usuarioId: user.id, eliminadoEn: null },
      select: { id: true, materiaId: true, tipo: true, estimacion: true, duracionEstMin: true },
    });
    if (!tarea) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });

    const sugeridas = (tarea.duracionEstMin ?? 0) / 60;
    const reales = horasExactas ?? Math.round(sugeridas * FACTOR_RESPUESTA[respuesta!] * 2) / 2;
    if (!(reales > 0)) return NextResponse.json({ error: 'La actividad no tenía horas estimadas' }, { status: 409 });

    await prisma.tarea.update({ where: { id: tarea.id }, data: { horasReales: reales } });
    await registrarHoras(user.id, tarea, reales, 'respuesta');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error POST /api/aprendizaje/pregunta:', error);
    return NextResponse.json({ error: 'Error al guardar la respuesta' }, { status: 500 });
  }
}
