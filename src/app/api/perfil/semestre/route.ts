import { NextResponse } from 'next/server';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { cargarTareas } from '@/lib/agenda/consultas';
import { resumirSemestre } from '@/lib/agenda/semestre';
import { zonaDeUsuario } from '@/lib/usuarios/zona';

/**
 * GET /api/perfil/semestre → "Tu semestre a la vista" (próximas 8 semanas)
 * 200 {
 *   semanas: [{ desde, hasta, etiqueta, horas, actividades }],
 *   semanaPesada: { ...semana, mensaje } | null,      ← solo si tiene 6 h o más
 *   materiaMasPesada: { nombre, color, horas, actividades } | null, materias: [...],
 *   porPlanificarHoras,                                ← horas estimadas que todavía no tienen bloques
 *   proximoExamen: { id, titulo, tipo, fecha } | null
 * }
 */
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const [{ tareas }, zona] = await Promise.all([cargarTareas(user.id), zonaDeUsuario(user.id)]);
    return NextResponse.json(resumirSemestre(tareas, new Date(), zona));
  } catch (error) {
    console.error('Error GET /api/perfil/semestre:', error);
    return NextResponse.json({ error: 'Error al armar el resumen del semestre' }, { status: 500 });
  }
}
