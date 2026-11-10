import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarTarea } from '@/lib/validacion/tarea';
import { CONFIG_PRIORIDAD, priorizarTareas } from '@/lib/prioridad';
import { cargarContextoPlan } from '@/lib/plan/cargar';
import { horasLibresPorDia } from '@/lib/plan/huecos';
import { CONFIG_PLAN } from '@/lib/plan/planificador';
import { cerrarVencidas } from '@/lib/tareas/cierre';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';

// GET /api/tareas → tareas del usuario logueado, con prioridad calculada
/**
 * Horas de estudio por día: las reales (huecos de las próximas 2 semanas, con tope de 4 h), no un 3 fijo.
 * En caché 10 min por usuario: son 4 consultas y la capacidad casi no cambia de un minuto a otro.
 */
const capacidades = new Map<string, { horas: number; hasta: number }>();
async function capacidadDe(usuarioId: string): Promise<number> {
  const c = capacidades.get(usuarioId);
  if (c && c.hasta > Date.now()) return c.horas;
  try {
    const ahora = new Date();
    const ctx = await cargarContextoPlan(usuarioId, ahora, new Date(ahora.getTime() + 14 * 86_400_000), ahora);
    const horas = Math.max(0.5, horasLibresPorDia(ctx.dias, CONFIG_PLAN.maxEstudioDiaMin / 60));
    capacidades.set(usuarioId, { horas, hasta: Date.now() + 10 * 60_000 });
    return horas;
  } catch (error) {
    console.error('Capacidad de estudio: se usa el valor por defecto', error);
    return CONFIG_PRIORIDAD.horasEstudioPorDia;
  }
}

export async function GET() {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Lo que ya pasó se da por hecho (Fase 3): el usuario no tiene que marcar nada
    await cerrarVencidas(user.id);
    // La lista y la capacidad diaria van en paralelo (la base está lejos: cada ronda de consultas pesa)
    const [tareas, horasEstudioPorDia] = await Promise.all([
      prisma.tarea.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        orderBy: { fechaLimite: 'asc' },
        include: { materia: { select: { id: true, nombre: true, color: true } } },
      }),
      capacidadDe(user.id),
    ]);
    return NextResponse.json({
      tareas: priorizarTareas(tareas, new Date(), { ...CONFIG_PRIORIDAD, horasEstudioPorDia }),
      horasEstudioPorDia,
    });
  } catch (error) {
    console.error('Error GET /api/tareas:', error);
    return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 });
  }
}

// POST /api/tareas → crear tarea
// Body opcional: confirmarNueva: true → el usuario ya dijo "es otra", se crea aunque se parezca.
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

  const v = validarTarea(body, 'crear');
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const confirmarNueva = (body as { confirmarNueva?: unknown }).confirmarNueva === true;

  try {
    // La materia tiene que ser del mismo usuario
    if (v.datos.materiaId) {
      const materia = await prisma.materia.findFirst({
        where: { id: v.datos.materiaId, usuarioId: user.id, eliminadoEn: null },
      });
      if (!materia) {
        return NextResponse.json({ error: 'Materia no encontrada' }, { status: 400 });
      }
    }

    const { titulo, tipo, fechaLimite, ...resto } = v.datos;

    // Duplicados: el sistema compara y, si se parece, PREGUNTA (nunca descarta solo)
    if (!confirmarNueva) {
      const dup = await buscarDuplicada(user.id, {
        titulo: titulo!,
        fechaLimite: fechaLimite!,
        materiaId: v.datos.materiaId ?? null,
      });
      if (dup.estado !== 'nuevo') {
        return NextResponse.json(
          {
            error: 'Posible duplicado',
            tipoDuplicado: dup.estado,
            similitud: dup.similitud,
            tarea: dup.tarea,
            pregunta: preguntaDuplicado(dup.tarea),
            sugerenciasDiferencia: DIFERENCIAS_POR_TIPO[tipo!] ?? [],
          },
          { status: 409 },
        );
      }
    }

    const tarea = await prisma.tarea.create({
      data: {
        ...resto,
        // Si el usuario escribió las horas, son suyas: ninguna estimación las reemplaza
        horasDelUsuario: resto.duracionEstMin != null,
        titulo: titulo!,
        tipo: tipo!,
        fechaLimite: fechaLimite!,
        usuarioId: user.id, // siempre del token, nunca del body
      },
    });

    return NextResponse.json({ tarea }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/tareas:', error);
    return NextResponse.json({ error: 'Error al crear la tarea' }, { status: 500 });
  }
}