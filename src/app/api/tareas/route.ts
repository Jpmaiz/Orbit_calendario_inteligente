import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { cargarTareas } from '@/lib/agenda/consultas';
import { validarTarea } from '@/lib/validacion/tarea';
import { tareaPublica } from '@/lib/estimacion/publico';
import { tieneDuracion } from '@/lib/tareas/duracion';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';

// GET /api/tareas → tareas del usuario logueado, con prioridad calculada
export async function GET() {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    return NextResponse.json(await cargarTareas(user.id));
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
        duracionMin: tieneDuracion(tipo) ? resto.duracionMin ?? null : null, // solo examen y exposición
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