import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { diaEnZona } from '@/lib/periodos/periodos';

const DIA_MS = 86_400_000;
const MAX_DIAS = 62;

/**
 * GET /api/agenda?desde=2026-10-26&hasta=2026-11-01
 * Todo lo que el usuario tiene en ese rango (fechas en su zona horaria, ambos días incluidos):
 * - clases: EventoFijo VIGENTES en el rango (una fila por día de la semana; el front las repite)
 * - eventos: Evento de una vez que se cruzan con el rango
 * - tareas: tareas con fecha límite dentro del rango
 */
export async function GET(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const desdeTxt = params.get('desde');
  const hastaTxt = params.get('hasta');

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: user.id }, select: { zonaHoraria: true } });
    const zona: string = usuario?.zonaHoraria ?? 'America/La_Paz';

    const desde = desdeTxt ? diaEnZona(desdeTxt, '00:00', zona) : null;
    const hastaInicio = hastaTxt ? diaEnZona(hastaTxt, '00:00', zona) : null;
    if (!desde || !hastaInicio) {
      return NextResponse.json({ error: 'Usa ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD' }, { status: 400 });
    }
    const hasta = new Date(hastaInicio.getTime() + DIA_MS - 1); // hasta el final de ese día
    const dias = (hasta.getTime() - desde.getTime()) / DIA_MS;
    if (dias <= 0 || dias > MAX_DIAS) {
      return NextResponse.json({ error: `El rango debe ser de 1 a ${MAX_DIAS} días` }, { status: 400 });
    }

    const materia = { select: { id: true, nombre: true, color: true } };
    const [clases, eventos, tareas] = await Promise.all([
      prisma.eventoFijo.findMany({
        where: {
          usuarioId: user.id,
          eliminadoEn: null,
          // vigente en algún momento del rango (sin fechas = siempre vigente)
          AND: [
            { OR: [{ vigenteDesde: null }, { vigenteDesde: { lte: hasta } }] },
            { OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: desde } }] },
          ],
        },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        include: { materia },
      }),
      prisma.evento.findMany({
        where: {
          usuarioId: user.id,
          eliminadoEn: null,
          inicio: { lte: hasta },
          OR: [{ fin: { gte: desde } }, { fin: null, inicio: { gte: desde } }],
        },
        orderBy: { inicio: 'asc' },
        include: { materia },
      }),
      prisma.tarea.findMany({
        where: { usuarioId: user.id, eliminadoEn: null, fechaLimite: { gte: desde, lte: hasta } },
        orderBy: { fechaLimite: 'asc' },
        include: { materia },
      }),
    ]);

    return NextResponse.json({ desde, hasta, zonaHoraria: zona, clases, eventos, tareas });
  } catch (error) {
    console.error('Error GET /api/agenda:', error);
    return NextResponse.json({ error: 'Error al obtener la agenda' }, { status: 500 });
  }
}