import { NextRequest, NextResponse } from 'next/server';
import { ia, modeloIA } from '@/lib/ia';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';

const TIPOS_VALIDOS = ['examen', 'tarea', 'entrega', 'proyecto', 'exposicion'];

/**
 * POST /api/ia
 * Body: { texto, guardar?, confirmarNueva?, tituloFinal? }
 * - guardar: true        → además de interpretar, crea la tarea
 * - confirmarNueva: true → el usuario dijo "es otra": se crea aunque se parezca a una existente
 * - tituloFinal          → título elegido por el usuario (ej. "Examen práctico de Redes")
 */
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

  const guardar = (body as { guardar?: unknown }).guardar === true;
  const confirmarNueva = (body as { confirmarNueva?: unknown }).confirmarNueva === true;
  const tituloFinal = (body as { tituloFinal?: unknown }).tituloFinal;
  const tituloElegido =
    typeof tituloFinal === 'string' && tituloFinal.trim() ? tituloFinal.trim().slice(0, 200) : null;

  try {
    const inicio = Date.now();
    const interpretacion = await ia.interpretarTexto(texto);
    const latencia = Date.now() - inicio;

    // Nunca confiar ciegamente en la IA: validar fecha y tipo
    const fecha = interpretacion.fechaLimite ? new Date(interpretacion.fechaLimite) : null;
    const tipo = TIPOS_VALIDOS.includes(interpretacion.tipo) ? interpretacion.tipo : 'tarea';
    const titulo = tituloElegido ?? interpretacion.titulo;

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

    // Registro de trazabilidad con el resultado REAL (para métricas)
    const registrar = (estado: 'pendiente' | 'aplicada' | 'duplicada') =>
      prisma.interpretacionIA.create({
        data: {
          usuarioId: user.id,
          tipoEntrada: 'texto',
          entradaOriginal: texto,
          respuestaIa: interpretacion as object,
          confianza: interpretacion.confianza,
          modeloUsado: modeloIA,
          tiempoRespuestaMs: latencia,
          estado,
        },
      });

    // Solo interpretar, sin guardar
    if (!guardar) {
      await registrar('pendiente');
      return NextResponse.json({
        interpretacion,
        materiaId,
        materiaSugerida: interpretacion.materia ?? null,
      });
    }

    // Sin fecha válida no se puede guardar: el frontend pregunta "¿para cuándo?"
    if (!fecha || Number.isNaN(fecha.getTime())) {
      await registrar('pendiente');
      return NextResponse.json({
        interpretacion,
        materiaId,
        materiaSugerida: interpretacion.materia ?? null,
        necesitaFecha: true,
      });
    }

    // Duplicados: el sistema compara y, si se parece, PREGUNTA (nunca descarta solo)
    if (!confirmarNueva) {
      const dup = await buscarDuplicada(user.id, {
        titulo,
        fechaLimite: fecha,
        materiaId,
        materiaNombre: interpretacion.materia,
      });
      if (dup.estado !== 'nuevo') {
        await registrar('duplicada');
        return NextResponse.json(
          {
            interpretacion,
            tipoDuplicado: dup.estado,
            similitud: dup.similitud,
            tarea: dup.tarea,
            pregunta: preguntaDuplicado(dup.tarea),
            sugerenciasDiferencia: DIFERENCIAS_POR_TIPO[tipo] ?? [],
          },
          { status: 409 },
        );
      }
    }

    const tarea = await prisma.tarea.create({
      data: {
        usuarioId: user.id,
        titulo,
        tipo,
        fechaLimite: fecha,
        prioridad: 'media',
        estado: 'pendiente',
        origen: 'texto',
        materiaId, // null si no hay materia
      },
      include: {
        materia: { select: { id: true, nombre: true, color: true } },
      },
    });

    await registrar('aplicada');
    return NextResponse.json({ interpretacion, tarea, creada: true }, { status: 201 });
  } catch (error) {
    console.error('Error en /api/ia:', error);
    return NextResponse.json({ error: 'Error al interpretar el texto' }, { status: 500 });
  }
}