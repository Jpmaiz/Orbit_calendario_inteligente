import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { periodoVigente } from '@/lib/periodos/periodos';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { normalizarCodigo, normalizarNombre, esMismaClase, nombreDia, type ClaseFija } from '@/lib/borrador/enriquecer';
import { validarItem, ItemConfirmado } from '@/lib/borrador/validarConfirmacion';

/**
 * POST /api/ia/confirmar
 * Body: { interpretacionId?, fueCorregida?, items: [...] }  ← el borrador, tal como lo dejó el usuario
 * Guarda TODO en una transacción: si algo falla, no queda nada a medias.
 * - Crea cada materia nueva una sola vez (aunque la usen varios ítems).
 * - Aprende alias: si el usuario vinculó "BD" a "Base de Datos II", la próxima vez lo hace solo.
 * - Una clase de lunes y miércoles se guarda como dos EventoFijo.
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

  try {
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

    const resultado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
            codigo: item.materia.codigo ? normalizarCodigo(item.materia.codigo) : null,
            semestre: periodo?.nombre ?? null,
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

      // 4) Trazabilidad: la interpretación se aplicó (y si el usuario la corrigió)
      if (typeof body.interpretacionId === 'string') {
        await tx.interpretacionIA.updateMany({
          where: { id: body.interpretacionId, usuarioId: user.id },
          data: { estado: 'aplicada', fueCorregida: body.fueCorregida === true },
        });
      }

      return { tareas, eventos, clases, materias: materiasCreadas };
    }, { timeout: 15_000 }); // varios ítems + la latencia a Supabase: más que los 5 s por defecto

    return NextResponse.json({ creados: resultado, omitidos }, { status: 201 });
  } catch (error) {
    console.error('Error en /api/ia/confirmar:', error);
    return NextResponse.json({ error: 'Error al guardar el borrador' }, { status: 500 });
  }
}