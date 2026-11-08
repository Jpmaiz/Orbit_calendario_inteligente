import { prisma } from '@/lib/prisma/cliente';

const HORA_MS = 3_600_000;

/**
 * Cierre automático (Fase 3): un examen o una entrega ocurren en su fecha igual, así que al pasar la fecha
 * (más 1 h de gracia) la actividad se da por hecha. El usuario nunca tiene que marcarla.
 * Si la reabre, `cerradaSolaEn` queda puesto y no se vuelve a cerrar sola.
 * Se llama al leer tareas o agenda (barato: un updateMany).
 */
export async function cerrarVencidas(usuarioId: string, ahora: Date = new Date()) {
  return prisma.tarea.updateMany({
    where: {
      usuarioId, eliminadoEn: null, cerradaSolaEn: null,
      estado: { in: ['pendiente', 'en_proceso'] },
      fechaLimite: { lt: new Date(ahora.getTime() - HORA_MS) },
    },
    data: { estado: 'completada', completadaEn: ahora, cerradaSolaEn: ahora },
  });
}
