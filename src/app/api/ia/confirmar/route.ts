import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { periodoVigente, diaEnZona } from '@/lib/periodos/periodos';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { normalizarNombre, esMismaClase, nombreDia, type ClaseFija } from '@/lib/borrador/enriquecer';
import { validarItem, ItemConfirmado } from '@/lib/borrador/validarConfirmacion';

/** Otra petición ya confirmó esta interpretación (ganó la carrera). */
class YaConfirmada extends Error {}

type Resultado = {
  creados: { tareas: string[]; eventos: string[]; clases: string[]; materias: { id: string; nombre: string }[] };
  periodoCreado?: { id: string; nombre: string } | null; // semestre que traía el documento (horario del SIAAN)
  omitidos: { indice: number; titulo: string; motivo: string }[];
};

/**
 * POST /api/ia/confirmar
 * Body: { interpretacionId, fueCorregida?, items: [...] }  ← el borrador, tal como lo dejó el usuario
 * Guarda TODO en una transacción: si algo falla, no queda nada a medias.
 * IDEMPOTENTE: cada interpretacionId se confirma UNA sola vez. Si llega un reintento
 * (se perdió la respuesta, doble clic, red inestable), devuelve el mismo resultado sin crear nada.
 * - Crea cada materia nueva una sola vez (aunque la usen varios ítems).
 * - Aprende alias: si el usuario vinculó "BD" a "Base de Datos II", la próxima vez lo hace solo.
 * - Una clase de lunes y miércoles se guarda como dos EventoFijo.
 * - Si el borrador vino de un horario con semestre impreso, crea ese periodo (si no se cruza con otro).
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 20) {
    return NextResponse.json({ error: 'Envía entre 1 y 20 ítems' }, { status: 400 });
  }
  const items: ItemConfirmado[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const v = validarItem(body.items[i], i);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    items.push(v.valor);
  }

  const interpretacionId = typeof body.interpretacionId === 'string' ? body.interpretacionId : null;
  if (!interpretacionId) {
    return NextResponse.json({ error: 'Falta interpretacionId (viene en la respuesta de /api/ia/extraer)' }, { status: 400 });
  }

  try {
    // Idempotencia (1/2): si este borrador ya se confirmó, devolver el mismo resultado
    const interpretacion = await prisma.interpretacionIA.findFirst({
      where: { id: interpretacionId, usuarioId: user.id },
      select: { estado: true, resultado: true, respuestaIa: true, usuario: { select: { zonaHoraria: true } } },
    });
    if (!interpretacion) {
      return NextResponse.json({ error: 'Interpretación no encontrada' }, { status: 404 });
    }
    if (interpretacion.estado === 'aplicada') {
      return NextResponse.json({ ...(interpretacion.resultado as Resultado), repetido: true });
    }
    if (interpretacion.estado !== 'pendiente') {
      return NextResponse.json({ error: 'Esta interpretación ya no se puede confirmar' }, { status: 409 });
    }

    // Las materias a vincular tienen que ser del usuario
    const idsVincular = [...new Set(items.flatMap((i) => (i.materia.accion === 'vincular' ? [i.materia.materiaId] : [])))];
    const propias = await prisma.materia.findMany({
      where: { id: { in: idsVincular }, usuarioId: user.id, eliminadoEn: null },
      select: { id: true, nombre: true },
    });
    if (propias.length !== idsVincular.length) {
      return NextResponse.json({ error: 'Alguna materia no existe o no es tuya' }, { status: 400 });
    }

    // Duplicados seguros: se omiten salvo que el usuario haya dicho "es otra"
    const omitidos: { indice: number; titulo: string; motivo: string }[] = [];
    const aGuardar: { item: ItemConfirmado; indice: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.clase === 'tarea' && !it.confirmarNueva) {
        const dup = await buscarDuplicada(user.id, {
          titulo: it.titulo, fechaLimite: it.inicio,
          materiaId: it.materia.accion === 'vincular' ? it.materia.materiaId : null,
        });
        if (dup.estado === 'seguro') {
          omitidos.push({ indice: i, titulo: it.titulo, motivo: `Ya existe «${dup.tarea.titulo}»` });
          continue;
        }
      }
      aGuardar.push({ item: it, indice: i });
    }

    const periodo = await periodoVigente(user.id);

    // Semestre impreso en el documento (lo leyó /api/ia/extraer-imagen): solo si se guarda alguna clase
    const zona = interpretacion.usuario?.zonaHoraria ?? 'America/La_Paz';
    const leido = (interpretacion.respuestaIa as { periodo?: { nombre?: string | null; inicio?: string; fin?: string } | null })?.periodo;
    let periodoDocumento: { nombre: string; inicio: Date; fin: Date } | null = null;
    if (leido?.inicio && leido.fin && aGuardar.some(({ item }) => item.clase === 'evento_fijo')) {
      const inicio = diaEnZona(leido.inicio, '00:00', zona);
      const fin = diaEnZona(leido.fin, '23:59', zona);
      const dias = inicio && fin ? (fin.getTime() - inicio.getTime()) / 86_400_000 : 0;
      if (inicio && fin && dias >= 7 && dias <= 366) {
        periodoDocumento = { nombre: (leido.nombre ?? `${leido.inicio} a ${leido.fin}`).slice(0, 50), inicio, fin };
      }
    }

    const resultado: Resultado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 0) Idempotencia (2/2): "reservar" la interpretación. Solo UNA petición puede pasarla
      //    de 'pendiente' a 'aplicada'. Si otra llegó primero, Postgres hace esperar a esta y
      //    después el UPDATE no encuentra filas → no se crea nada.
      //    Si algo falla más abajo, la transacción se deshace y vuelve a quedar 'pendiente'.
      const reserva = await tx.interpretacionIA.updateMany({
        where: { id: interpretacionId, usuarioId: user.id, estado: 'pendiente' },
        data: { estado: 'aplicada', fueCorregida: body.fueCorregida === true },
      });
      if (reserva.count === 0) throw new YaConfirmada();

      // 0.5) Semestre del documento: se crea si no hay otro en esas fechas (dos semestres no se pisan)
      let periodoCreado: { id: string; nombre: string } | null = null;
      let semestre = periodo?.nombre ?? null;
      if (periodoDocumento) {
        const choca = await tx.periodoAcademico.findFirst({
          where: { usuarioId: user.id, eliminadoEn: null, inicio: { lte: periodoDocumento.fin }, fin: { gte: periodoDocumento.inicio } },
          select: { nombre: true },
        });
        if (choca) {
          semestre = choca.nombre;
        } else {
          periodoCreado = await tx.periodoAcademico.create({
            data: { usuarioId: user.id, ...periodoDocumento },
            select: { id: true, nombre: true },
          });
          semestre = periodoCreado.nombre;
        }
      }

      // 1) Materias nuevas: una sola vez por nombre normalizado (y reusar si ya existe con ese nombre)
      const idPorClave = new Map<string, string>();
      const materiasCreadas: { id: string; nombre: string }[] = [];
      const existentes = await tx.materia.findMany({
        where: { usuarioId: user.id, eliminadoEn: null }, select: { id: true, nombre: true },
      });
      for (const { item } of aGuardar) {
        if (item.materia.accion !== 'crear') continue;
        const clave = normalizarNombre(item.materia.nombre);
        if (idPorClave.has(clave)) continue;
        const ya = existentes.find((m: { nombre: string }) => normalizarNombre(m.nombre) === clave);
        if (ya) {
          idPorClave.set(clave, ya.id);
          continue;
        }
        const nueva = await tx.materia.create({
          data: {
            usuarioId: user.id,
            nombre: item.materia.nombre,
            // Se guarda como se lee ("SIS-233"); al comparar se normaliza
            codigo: item.materia.codigo ? item.materia.codigo.trim().toUpperCase().slice(0, 30) : null,
            semestre,
          },
          select: { id: true, nombre: true },
        });
        idPorClave.set(clave, nueva.id);
        materiasCreadas.push(nueva);
      }
      const materiaIdDe = (it: ItemConfirmado) =>
        it.materia.accion === 'vincular' ? it.materia.materiaId
        : it.materia.accion === 'crear' ? idPorClave.get(normalizarNombre(it.materia.nombre)) ?? null
        : null;

      // 2) Guardar cada ítem (sin duplicar clases ni eventos que ya existen)
      const tareas: string[] = [], eventos: string[] = [], clases: string[] = [];
      const clasesGuardadas: ClaseFija[] = await tx.eventoFijo.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        select: { id: true, titulo: true, materiaId: true, diaSemana: true, horaInicio: true, horaFin: true, vigenteDesde: true, vigenteHasta: true },
      });
      const ahora = new Date();
      for (const { item, indice } of aGuardar) {
        const materiaId = materiaIdDe(item);

        if (item.clase === 'tarea') {
          const t = await tx.tarea.create({
            data: {
              usuarioId: user.id, materiaId, titulo: item.titulo, tipo: item.tipo, fechaLimite: item.inicio,
              horaDefinida: item.horaDefinida, descripcion: item.descripcion,
              prioridad: 'media', estado: 'pendiente', origen: 'texto',
            },
            select: { id: true },
          });
          tareas.push(t.id);
        } else if (item.clase === 'evento') {
          // Mismo nombre y a menos de 1 h del inicio → ya existe
          const cercanos = await tx.evento.findMany({
            where: {
              usuarioId: user.id, eliminadoEn: null,
              inicio: { gte: new Date(item.inicio.getTime() - 3_600_000), lte: new Date(item.inicio.getTime() + 3_600_000) },
            },
            select: { titulo: true },
          });
          if (cercanos.some((e: { titulo: string }) => normalizarNombre(e.titulo) === normalizarNombre(item.titulo))) {
            omitidos.push({ indice, titulo: item.titulo, motivo: `Ya existe «${item.titulo}» a esa hora` });
            continue;
          }
          const e = await tx.evento.create({
            data: {
              usuarioId: user.id, materiaId, titulo: item.titulo, inicio: item.inicio, fin: item.fin,
              ubicacion: item.ubicacion, descripcion: item.descripcion, origen: 'texto',
            },
            select: { id: true },
          });
          eventos.push(e.id);
        } else {
          const repetidos: number[] = [];
          for (const dia of item.diasSemana) {
            const yaEsta = clasesGuardadas.some(
              (c) => (!c.vigenteHasta || c.vigenteHasta >= ahora) && esMismaClase(c, dia, item.hora, item.horaFin, item.titulo, materiaId),
            );
            if (yaEsta) {
              repetidos.push(dia);
              continue;
            }
            const c = await tx.eventoFijo.create({
              data: {
                usuarioId: user.id, materiaId, titulo: item.titulo, diaSemana: dia,
                horaInicio: item.hora, horaFin: item.horaFin, ubicacion: item.ubicacion, origen: 'texto',
                vigenteDesde: item.vigencia?.desde ?? periodo?.inicio ?? null,
                vigenteHasta: item.vigencia?.hasta ?? periodo?.fin ?? null,
              },
              select: { id: true },
            });
            clases.push(c.id);
          }
          if (repetidos.length > 0) {
            omitidos.push({
              indice, titulo: item.titulo,
              motivo: `Ya tienes esta clase los ${repetidos.map(nombreDia).join(' y ')} de ${item.hora} a ${item.horaFin}`,
            });
          }
        }

        // 3) Aprender alias: lo que escribió el usuario apunta a la materia que eligió
        if (item.materia.accion === 'vincular' && item.materiaDetectada) {
          const alias = normalizarNombre(item.materiaDetectada);
          const propia = propias.find((m: { id: string }) => m.id === materiaId);
          if (alias && propia && alias !== normalizarNombre(propia.nombre)) {
            await tx.aliasMateria.upsert({
              where: { usuarioId_alias: { usuarioId: user.id, alias } },
              update: { materiaId: materiaId! },
              create: { usuarioId: user.id, alias, materiaId: materiaId! },
            });
          }
        }
      }

      // 4) Guardar el resultado: un reintento devolverá exactamente esto
      const final: Resultado = { creados: { tareas, eventos, clases, materias: materiasCreadas }, omitidos, periodoCreado };
      await tx.interpretacionIA.update({ where: { id: interpretacionId }, data: { resultado: final as object } });
      return final;
    }, { timeout: 15_000 }); // varios ítems + la latencia a Supabase: más que los 5 s por defecto

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof YaConfirmada) {
      // Perdimos la carrera contra otra petición idéntica: devolver lo que guardó ella
      const previa = await prisma.interpretacionIA.findFirst({
        where: { id: interpretacionId, usuarioId: user.id },
        select: { resultado: true },
      });
      return NextResponse.json({ ...(previa?.resultado as Resultado), repetido: true });
    }
    console.error('Error en /api/ia/confirmar:', error);
    return NextResponse.json({ error: 'Error al guardar el borrador' }, { status: 500 });
  }
}