import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { aplicarCambios } from '@/lib/plan/animo';
import { olvidarDisponibilidad } from '@/lib/plan/disponibilidad';

/**
 * POST /api/dia/reacomodar  Body: { cambios: [{ id, inicio, fin }] }   (1 a 10; lo que propuso POST /api/dia/animo)
 * Mueve bloques de estudio ya guardados. Cada uno: es del usuario, todavía no empezó y su actividad sigue abierta;
 * la hora nueva es desde ahora, en cuartos de hora, con la misma duración, antes de la fecha y sin cruzarse con clases,
 * eventos ni otros bloques. O se aplican todos o ninguno. No cuenta para aprender la energía del usuario.
 * 200 { bloques: [{ id, tareaId, inicio, fin }] } · 400 regla · 404 bloque · 409 ya empezó
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  try {
    const r = await aplicarCambios(user.id, body);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    olvidarDisponibilidad(user.id); // "te faltarían ~X h" cambia con los bloques movidos
    return NextResponse.json({ bloques: r.bloques });
  } catch (error) {
    console.error('Error POST /api/dia/reacomodar:', error);
    return NextResponse.json({ error: 'Error al mover los bloques' }, { status: 500 });
  }
}
