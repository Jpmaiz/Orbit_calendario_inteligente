import { prisma } from '@/lib/prisma/cliente';

/**
 * "Vence con": una entrega que se hace al empezar un examen o evento ("entregar al ingresar al examen").
 * Cuando ese examen o evento cambia de fecha u hora, las entregas pendientes atadas a él se mueven con él.
 */
export async function moverVinculadas(
  usuarioId: string, id: string, clase: 'tarea' | 'evento', nuevaFecha: Date, horaDefinida = true,
) {
  return prisma.tarea.updateMany({
    where: { usuarioId, venceConId: id, venceConClase: clase, eliminadoEn: null, estado: { in: ['pendiente', 'en_proceso'] } },
    data: { fechaLimite: nuevaFecha, horaDefinida },
  });
}
