import { prisma } from '@/lib/prisma/cliente';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

/** "2026-12-11" → instante de ese día a las HH:mm en la zona del usuario. */
export function diaEnZona(fecha: string, hora: string, zona: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const dia = { y: +m[1], m: +m[2], d: +m[3] };
  const prueba = new Date(Date.UTC(dia.y, dia.m - 1, dia.d));
  if (prueba.getUTCMonth() !== dia.m - 1) return null; // 31 de febrero, etc.
  return instanteEnZona(dia, hora, zona);
}

/** Periodo que contiene la fecha (por defecto, hoy). null si no hay ninguno cargado. */
export function periodoVigente(usuarioId: string, fecha: Date = new Date()) {
  return prisma.periodoAcademico.findFirst({
    where: { usuarioId, eliminadoEn: null, inicio: { lte: fecha }, fin: { gte: fecha } },
    orderBy: { inicio: 'desc' },
  });
}