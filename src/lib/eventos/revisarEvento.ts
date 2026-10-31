import { prisma } from '@/lib/prisma/cliente';
import { choquesDeEvento, normalizarNombre, type ClaseFija, type EventoPuntual, type Choque } from '@/lib/borrador/enriquecer';

const HORA_MS = 3_600_000;

/**
 * Revisa un evento de una vez contra lo que el usuario ya tiene:
 * - choques con clases vigentes y otros eventos (aviso, no bloquea)
 * - duplicado: otro evento con el mismo nombre a menos de 1 h (mismo criterio que /api/ia/confirmar)
 * @param excluirId al editar, el propio evento no cuenta como choque ni duplicado
 */
export async function revisarEvento(
  usuarioId: string,
  titulo: string,
  inicio: Date,
  fin: Date | null,
  excluirId?: string,
): Promise<{ choques: Choque[]; duplicado: { id: string; titulo: string; inicio: Date } | null }> {
  const finReal = fin ?? new Date(inicio.getTime() + HORA_MS);
  const [usuario, clases, eventos] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { zonaHoraria: true } }),
    prisma.eventoFijo.findMany({
      where: { usuarioId, eliminadoEn: null },
      select: { id: true, titulo: true, materiaId: true, diaSemana: true, horaInicio: true, horaFin: true, vigenteDesde: true, vigenteHasta: true },
    }),
    prisma.evento.findMany({
      where: {
        usuarioId,
        eliminadoEn: null,
        ...(excluirId ? { id: { not: excluirId } } : {}),
        // solo los que pueden cruzarse o estar cerca (±1 día)
        inicio: { gte: new Date(inicio.getTime() - 24 * HORA_MS), lte: new Date(finReal.getTime() + 24 * HORA_MS) },
      },
      select: { id: true, titulo: true, inicio: true, fin: true },
    }),
  ]);
  const zona: string = usuario?.zonaHoraria ?? 'America/La_Paz';

  const nombre = normalizarNombre(titulo);
  const dup = (eventos as EventoPuntual[]).find(
    (e) => Math.abs(e.inicio.getTime() - inicio.getTime()) < HORA_MS && normalizarNombre(e.titulo) === nombre,
  );

  return {
    choques: choquesDeEvento(inicio, fin, zona, clases as ClaseFija[], eventos as EventoPuntual[]),
    duplicado: dup ? { id: dup.id, titulo: dup.titulo, inicio: dup.inicio } : null,
  };
}
