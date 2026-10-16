import { NextRequest, NextResponse } from 'next/server';
import { ia } from '@/lib/ia/gemini';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';

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

  const texto = (body as { texto?: unknown }).texto;
  if (typeof texto !== 'string' || texto.trim() === '') {
    return NextResponse.json({ error: 'Falta el texto' }, { status: 400 });
  }

  // NUEVO: si viene guardar:true, además de interpretar, crea la tarea.
  const guardar = (body as { guardar?: unknown }).guardar === true;

  try {
    const inicio = Date.now();
    const interpretacion = await ia.interpretarTexto(texto);
    const latencia = Date.now() - inicio;

    // Buscar si el usuario ya tiene una materia con ese nombre
    let materiaId: string | null = null;
    if (interpretacion.materia) {
      const materia = await prisma.materia.findFirst({
        where: {
          usuarioId: user.id,
          eliminadoEn: null,
          nombre: { equals: interpretacion.materia, mode: 'insensitive' },
        },
        select: { id: true },
      });
      materiaId = materia?.id ?? null;
    }

    await prisma.interpretacionIA.create({
      data: {
        usuarioId: user.id,
        tipoEntrada: 'texto',
        entradaOriginal: texto,
        respuestaIa: interpretacion as object,
        confianza: interpretacion.confianza,
        modeloUsado: 'gemini-flash-latest',
        tiempoRespuestaMs: latencia,
        estado: guardar ? 'aplicada' : 'pendiente',
      },
    });

    // NUEVO: guardado directo como tarea
    if (guardar) {
      // Sin fecha no se puede guardar: hay que pedírsela al usuario.
      if (!interpretacion.fechaLimite) {
        return NextResponse.json({
          interpretacion,
          materiaId,
          materiaSugerida: interpretacion.materia ?? null,
          necesitaFecha: true, // el frontend muestra "¿para cuándo?"
        });
      }

      const tarea = await prisma.tarea.create({
        data: {
          usuarioId: user.id,
          titulo: interpretacion.titulo,
          tipo: interpretacion.tipo,
          fechaLimite: new Date(interpretacion.fechaLimite),
          prioridad: 'media',
          estado: 'pendiente',
          origen: 'texto',
          materiaId, // null si no hay materia, y está perfecto
        },
        include: {
          materia: { select: { id: true, nombre: true, color: true } },
        },
      });

      return NextResponse.json({ interpretacion, tarea, creada: true }, { status: 201 });
    }

    // Comportamiento de siempre: solo interpretar, sin guardar.
    return NextResponse.json({
      interpretacion,
      materiaId,
      materiaSugerida: interpretacion.materia ?? null,
    });
  } catch (error) {
    console.error('Error en /api/ia:', error);
    return NextResponse.json({ error: 'Error al interpretar el texto' }, { status: 500 });
  }
}