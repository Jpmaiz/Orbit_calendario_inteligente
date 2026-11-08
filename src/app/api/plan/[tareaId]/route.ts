import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { textoHoras } from '@/lib/plan/planificador';
import { bloquesEnConflicto, cargarContextoPlan } from '@/lib/plan/cargar';
import { proponerPlan } from '@/lib/plan/proponer';
import { franjaDe } from '@/lib/estimacion/personal';
import { registrarFranjas, registrarHoras } from '@/lib/aprendizaje/senales';

type Contexto = { params: Promise<{ tareaId: string }> };

const MIN_MS = 60_000;
const MAX_BLOQUES = 40;

/** La actividad, si es del usuario y todavía se puede planificar. */
async function tareaPropia(id: string, usuarioId: string) {
  return prisma.tarea.findFirst({
    where: { id, usuarioId, eliminadoEn: null },
    select: {
      id: true, titulo: true, tipo: true, materiaId: true, fechaLimite: true, horaDefinida: true,
      duracionEstMin: true, estado: true, estimacion: true,
    },
  });
}

const abierta = (estado: string) => estado === 'pendiente' || estado === 'en_proceso';
const iso = (b: { inicio: Date; fin: Date }) => ({ inicio: b.inicio.toISOString(), fin: b.fin.toISOString() });

/**
 * GET /api/plan/[tareaId]?horas=6.5
 * Propone un plan de estudio para la actividad en los huecos libres hasta su fecha (Fase 2).
 * No guarda nada. `horas` (opcional) = el total que eligió el usuario con − / +; si no, la estimación.
 * 200 {
 *   tarea: { id, titulo, tipo, fechaLimite, horas },
 *   propuesta: { bloques: [{ inicio, fin, minutos, tipo: estudio|repaso }], minutosNecesarios, minutosPlanificados, faltanMin, aviso },
 *   guardado: [{ id, inicio, fin, tipo, estado }],   ← el plan que ya aceptó, si existe
 *   conflictos: [{ id, motivo }],                    ← bloques guardados que ahora pisan algo
 *   huecos: [{ dia, diaSemana, huecos: [{ inicio, fin, minutos }] }]   ← para tocar un hueco y agregar un bloque
 * }
 */
export async function GET(req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { tareaId } = await params;

  try {
    const tarea = await tareaPropia(tareaId, user.id);
    if (!tarea) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
    if (!abierta(tarea.estado)) return NextResponse.json({ error: 'La actividad ya está cerrada' }, { status: 409 });

    const pedidas = Number(new URL(req.url).searchParams.get('horas'));
    const { plan, horas, ctx } = await proponerPlan(
      user.id, tarea, Number.isFinite(pedidas) && pedidas > 0 ? Math.min(100, Math.round(pedidas * 2) / 2) : null,
    );

    return NextResponse.json({
      tarea: { id: tarea.id, titulo: tarea.titulo, tipo: tarea.tipo, fechaLimite: tarea.fechaLimite, horas },
      propuesta: plan
        ? {
            bloques: plan.bloques.map((b) => ({ ...iso(b), minutos: b.minutos, tipo: b.tipo })),
            minutosNecesarios: plan.minutosNecesarios,
            minutosPlanificados: plan.minutosPlanificados,
            faltanMin: plan.faltanMin,
            aviso: plan.aviso,
          }
        : { bloques: [], minutosNecesarios: Math.round(horas * 60), minutosPlanificados: 0, faltanMin: Math.round(horas * 60), aviso: 'Ya no queda tiempo antes de la fecha.' },
      guardado: ctx.propios.map((b) => ({ id: b.id, ...iso(b), tipo: b.tipo, estado: b.estado })),
      conflictos: bloquesEnConflicto(ctx.propios, ctx.ocupaciones, tarea.fechaLimite),
      huecos: ctx.dias
        .filter((d) => d.huecos.length)
        .map((d) => ({ dia: d.dia, diaSemana: d.diaSemana, huecos: d.huecos.map((h) => ({ ...iso(h), minutos: h.minutos })) })),
    });
  } catch (error) {
    console.error('Error GET /api/plan/[tareaId]:', error);
    return NextResponse.json({ error: 'Error al armar el plan' }, { status: 500 });
  }
}

type BloqueValido = { inicio: Date; fin: Date; tipo: 'estudio' | 'repaso' };

function validarBloques(body: unknown, fechaLimite: Date, ahora: Date): { ok: true; bloques: BloqueValido[] } | { ok: false; error: string } {
  const lista = (body as { bloques?: unknown })?.bloques;
  if (!Array.isArray(lista)) return { ok: false, error: 'Falta "bloques" (lista)' };
  if (lista.length > MAX_BLOQUES) return { ok: false, error: `Máximo ${MAX_BLOQUES} bloques` };
  const bloques: BloqueValido[] = [];
  for (const [i, x] of lista.entries()) {
    const r = (x ?? {}) as Record<string, unknown>;
    const inicio = typeof r.inicio === 'string' ? new Date(r.inicio) : null;
    const fin = typeof r.fin === 'string' ? new Date(r.fin) : null;
    if (!inicio || !fin || isNaN(+inicio) || isNaN(+fin)) return { ok: false, error: `Bloque ${i + 1}: fechas inválidas` };
    const minutos = (fin.getTime() - inicio.getTime()) / MIN_MS;
    if (minutos < 15 || minutos > 240) return { ok: false, error: `Bloque ${i + 1}: debe durar de 15 min a 4 h` };
    if (fin > fechaLimite) return { ok: false, error: `Bloque ${i + 1}: termina después de la fecha de la actividad` };
    if (fin.getTime() < ahora.getTime() - 5 * MIN_MS) return { ok: false, error: `Bloque ${i + 1}: ya pasó` };
    bloques.push({ inicio, fin, tipo: r.tipo === 'repaso' ? 'repaso' : 'estudio' });
  }
  bloques.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  for (let i = 1; i < bloques.length; i++) {
    if (bloques[i].inicio < bloques[i - 1].fin) return { ok: false, error: 'Dos bloques se cruzan entre sí' };
  }
  return { ok: true, bloques };
}

/**
 * POST /api/plan/[tareaId]  Body: { bloques: [{ inicio, fin, tipo? }] }
 * Guarda el plan que eligió el usuario ("Guardar plan"): reemplaza sus bloques futuros de esta actividad.
 * Los cruces con clases, eventos u otros bloques se avisan (no bloquean).
 * 200 { bloques: [{ id, inicio, fin, tipo, estado }], minutosPlanificados, choques: [{ inicio, titulo }] }
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { tareaId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const tarea = await tareaPropia(tareaId, user.id);
    if (!tarea) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
    if (!abierta(tarea.estado)) return NextResponse.json({ error: 'La actividad ya está cerrada' }, { status: 409 });

    const ahora = new Date();
    const v = validarBloques(body, tarea.fechaLimite, ahora);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const creados = await prisma.$transaction(async (tx) => {
      // Reemplaza el plan futuro de esta actividad; lo que ya pasó (cumplido u omitido) se conserva
      await tx.sugerencia.deleteMany({ where: { usuarioId: user.id, tareaId: tarea.id, estado: 'aceptada', fechaFin: { gt: ahora } } });
      if (v.bloques.length) {
        await tx.sugerencia.createMany({
          data: v.bloques.map((b) => ({
            usuarioId: user.id, tareaId: tarea.id, fechaInicio: b.inicio, fechaFin: b.fin,
            motivo: b.tipo, estado: 'aceptada', respondidaEn: ahora,
          })),
        });
      }
      return tx.sugerencia.findMany({
        where: { usuarioId: user.id, tareaId: tarea.id, estado: 'aceptada', fechaFin: { gt: ahora } },
        orderBy: { fechaInicio: 'asc' },
        select: { id: true, fechaInicio: true, fechaFin: true, motivo: true, estado: true },
      });
    });

    // Avisar cruces (otra clase, evento o el plan de otra actividad)
    let choques: { inicio: string; titulo: string }[] = [];
    if (v.bloques.length) {
      const desde = v.bloques[0].inicio;
      const hasta = v.bloques[v.bloques.length - 1].fin;
      const ctx = await cargarContextoPlan(user.id, desde, hasta, desde, tarea.id, tarea.materiaId);
      choques = v.bloques.flatMap((b) => {
        const o = ctx.ocupaciones.find((x) => b.inicio < x.fin && x.inicio < b.fin);
        return o ? [{ inicio: b.inicio.toISOString(), titulo: o.titulo }] : [];
      });
    }

    const minutos = creados.reduce((s, b) => s + Math.round((b.fechaFin.getTime() - b.fechaInicio.getTime()) / MIN_MS), 0);

    // Aprendizaje (Fase 3), sin pedir nada: lo que el usuario cambió respecto de lo que Orbit propuso
    try {
      await aprenderDelPlan(user.id, tarea, v.bloques, ahora);
    } catch (error) {
      console.error('Aprendizaje del plan (no bloquea):', error);
    }

    return NextResponse.json({
      bloques: creados.map((b) => ({ id: b.id, inicio: b.fechaInicio, fin: b.fechaFin, tipo: b.motivo, estado: b.estado })),
      minutosPlanificados: minutos,
      resumen: minutos ? `Plan guardado: ${textoHoras(minutos)} de estudio` : 'Plan quitado',
      choques,
    });
  } catch (error) {
    console.error('Error POST /api/plan/[tareaId]:', error);
    return NextResponse.json({ error: 'Error al guardar el plan' }, { status: 500 });
  }
}

/**
 * Señales que deja guardar un plan:
 * - Horas: si el total guardado (con los bloques que ya pasaron) se aleja 30 min o más de lo estimado,
 *   ese total es una pista de lo que realmente necesita (peso 0,5).
 * - Franja: los bloques que puso donde Orbit no propuso votan por esa franja; los que sacó, en contra.
 */
async function aprenderDelPlan(
  usuarioId: string,
  tarea: NonNullable<Awaited<ReturnType<typeof tareaPropia>>>,
  guardados: BloqueValido[],
  ahora: Date,
) {
  const pasados = await prisma.sugerencia.findMany({
    where: { usuarioId, tareaId: tarea.id, estado: { in: ['aceptada', 'cumplida'] }, fechaFin: { lte: ahora } },
    select: { fechaInicio: true, fechaFin: true },
  });
  const minutosDe = (b: { inicio: Date; fin: Date }) => (b.fin.getTime() - b.inicio.getTime()) / MIN_MS;
  const total = guardados.reduce((s, b) => s + minutosDe(b), 0)
    + pasados.reduce((s, b) => s + minutosDe({ inicio: b.fechaInicio, fin: b.fechaFin }), 0);
  const estimadoMin = tarea.duracionEstMin ?? 0;
  if (estimadoMin > 0 && total > 0 && Math.abs(total - estimadoMin) >= 30) {
    await registrarHoras(usuarioId, tarea, total / 60, 'plan');
  }

  const { plan, ctx } = await proponerPlan(usuarioId, tarea, total > 0 ? total / 60 : null, ahora);
  if (!plan || !guardados.length) return;
  const cruza = (a: { inicio: Date; fin: Date }, b: { inicio: Date; fin: Date }) => a.inicio < b.fin && b.inicio < a.fin;
  const puestos = guardados.filter((g) => !plan.bloques.some((p) => cruza(g, p)));
  const sacados = plan.bloques.filter((p) => !guardados.some((g) => cruza(g, p)));
  await registrarFranjas(usuarioId, tarea.id, [
    ...puestos.map((b) => ({ franja: franjaDe(b.inicio, ctx.zona), voto: 1 })),
    ...sacados.map((b) => ({ franja: franjaDe(b.inicio, ctx.zona), voto: -1 })),
  ]);
}

/** DELETE /api/plan/[tareaId] → quita el plan futuro de la actividad. 200 { eliminados } */
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { tareaId } = await params;
  try {
    const tarea = await tareaPropia(tareaId, user.id);
    if (!tarea) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
    const r = await prisma.sugerencia.deleteMany({
      where: { usuarioId: user.id, tareaId: tarea.id, estado: 'aceptada', fechaFin: { gt: new Date() } },
    });
    return NextResponse.json({ eliminados: r.count });
  } catch (error) {
    console.error('Error DELETE /api/plan/[tareaId]:', error);
    return NextResponse.json({ error: 'Error al quitar el plan' }, { status: 500 });
  }
}
