import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { cargarAgenda } from '@/lib/agenda/consultas';

/**
 * GET /api/agenda?desde=2026-10-26&hasta=2026-11-01
 * Todo lo que el usuario tiene en ese rango (fechas en su zona horaria, ambos días incluidos):
 * - clases: EventoFijo VIGENTES en el rango (una fila por día de la semana; el front las repite)
 * - eventos: Evento de una vez que se cruzan con el rango
 * - tareas: tareas con fecha límite dentro del rango
 * - bloques: bloques de estudio aceptados del plan (Fase 2), con su actividad
 */
export async function GET(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  try {
    const r = await cargarAgenda(user.id, params.get('desde'), params.get('hasta'));
    return r.ok ? NextResponse.json(r.datos) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (error) {
    console.error('Error GET /api/agenda:', error);
    return NextResponse.json({ error: 'Error al obtener la agenda' }, { status: 500 });
  }
}
