import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { cargarAprendizaje } from '@/lib/aprendizaje/senales';
import { describirAprendizaje } from '@/lib/aprendizaje/describir';
import { olvidarDisponibilidad } from '@/lib/plan/disponibilidad';
import { ritmoDeUsuario } from '@/lib/usuarios/zona';

/**
 * GET /api/perfil/aprendizaje → { conociendo, frases: string[], datos }
 * "Lo que Orbit sabe de ti", en palabras: sin números, sin el factor personal.
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const [senales, ritmo] = await Promise.all([cargarAprendizaje(user.id), ritmoDeUsuario(user.id)]);
    return NextResponse.json(describirAprendizaje(senales, new Date(), ritmo.energia));
  } catch (error) {
    console.error('Error GET /api/perfil/aprendizaje:', error);
    return NextResponse.json({ error: 'Error al leer lo aprendido' }, { status: 500 });
  }
}

/**
 * DELETE /api/perfil/aprendizaje → "Empezar de cero": Orbit olvida lo aprendido (horas, momentos del día, cómo estuvo
 * cada día y las sugerencias ya mostradas) y vuelve a estimar como para un estudiante promedio.
 * Las tareas, los planes y "Mi ritmo" (lo que el usuario eligió) no se tocan. 200 { olvidados }
 */
export async function DELETE() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const r = await prisma.senalAprendizaje.deleteMany({ where: { usuarioId: user.id, clase: { in: ['horas', 'franja', 'animo', 'aviso'] } } });
    olvidarDisponibilidad(user.id);
    return NextResponse.json({ olvidados: r.count });
  } catch (error) {
    console.error('Error DELETE /api/perfil/aprendizaje:', error);
    return NextResponse.json({ error: 'Error al borrar lo aprendido' }, { status: 500 });
  }
}
