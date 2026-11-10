import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { validarTarea } from '@/lib/validacion/tarea';
import { CONFIG_PRIORIDAD, priorizarTareas } from '@/lib/prioridad';
import { cargarDisponibilidad } from '@/lib/plan/disponibilidad';
import { tareaPublica } from '@/lib/estimacion/publico';
import { cerrarVencidas } from '@/lib/tareas/cierre';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';

// GET /api/tareas → tareas del usuario logueado, con prioridad calculada
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Lo que ya pasó se da por hecho (Fase 3): el usuario no tiene que marcar nada
    await cerrarVencidas(user.id);
    // La lista y el tiempo libre real van en paralelo (la base está lejos: cada ronda de consultas pesa).
    // Tiempo libre: huecos de las próximas 2 semanas, en caché 10 min (src/lib/plan/disponibilidad.ts).
    const [tareas, libre] = await Promise.all([
      prisma.tarea.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        orderBy: { fechaLimite: 'asc' },
        include: { materia: { select: { id: true, nombre: true, color: true } } },
      }),
      cargarDisponibilidad(user.id).catch((error) => {
        console.error('Tiempo libre: se usa el promedio por defecto', error);
        return null;
      }),
    ]);
    const ahora = new Date();
    const horasEstudioPorDia = libre?.horasPorDia ?? CONFIG_PRIORIDAD.horasEstudioPorDia;
    const priorizadas = priorizarTareas(tareas, ahora, { ...CONFIG_PRIORIDAD, horasEstudioPorDia }, libre ? {
      libresHasta: (fin) => libre.libresHasta(fin, ahora),
      planificadas: (t) => libre.planificadas(t.id, new Date(t.fechaLimite), ahora),
    } : undefined);
    return NextResponse.json({ tareas: priorizadas.map(tareaPublica), horasEstudioPorDia });
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

    return NextResponse.json({ tarea: tareaPublica(tarea) }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/tareas:', error);
    return NextResponse.json({ error: 'Error al crear la tarea' }, { status: 500 });
  }
}