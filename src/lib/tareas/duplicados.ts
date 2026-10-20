import { prisma } from '@/lib/prisma/cliente';
import { CONFIG_DUPLICADOS, compararConCandidatos, TareaComparable } from './comparar';

/**
 * Busca si la tarea nueva ya existe para este usuario.
 * Trae solo las tareas activas cercanas en fecha (usa el índice usuarioId+fechaLimite)
 * y las compara en memoria.
 */
export async function buscarDuplicada(usuarioId: string, nueva: TareaComparable) {
  const fecha = new Date(nueva.fechaLimite);
  const ventanaMs = CONFIG_DUPLICADOS.ventanaHoras * 3_600_000;

  const candidatas = await prisma.tarea.findMany({
    where: {
      usuarioId,
      eliminadoEn: null,
      estado: 'pendiente',
      fechaLimite: { gte: new Date(fecha.getTime() - ventanaMs), lte: new Date(fecha.getTime() + ventanaMs) },
    },
    include: { materia: { select: { nombre: true } } },
  });

  return compararConCandidatos(
    nueva,
    candidatas.map((t: (typeof candidatas)[number]) => ({ ...t, materiaNombre: t.materia?.nombre ?? null })),
  );
}