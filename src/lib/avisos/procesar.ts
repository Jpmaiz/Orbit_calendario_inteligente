/**
 * Lo que hace cada pasada del envío de avisos (D25). La llama POST /api/avisos/enviar, que Supabase Cron dispara cada 5 min.
 * 1. Bloques de estudio que empiezan en 2–20 min → "En 15 min: …" (una vez por bloque).
 * 2. A las 20:00 de cada usuario → lo que vence mañana (una vez por día; si no vence nada, no se manda nada).
 * Cada aviso queda en recordatorios con una clave única: aunque dos pasadas se crucen, nadie recibe dos veces lo mismo.
 */
import { prisma } from '@/lib/prisma/cliente';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';
import { diaLocal, sumarDias } from '@/lib/plan/huecos';
import { leerPreferencias } from './preferencias';
import { avisoBloque, avisoManana, claveBloque, claveManana, esHoraDelResumen, ventanaBloques } from './mensajes';
import { enviarAUsuario } from './enviar';

const ABIERTA = { in: ['pendiente', 'en_proceso'] };
const DIA_MS = 86_400_000;
const yaExiste = (e: unknown) => (e as { code?: string })?.code === 'P2002';

/** Reserva la clave del aviso; false = otra pasada ya lo mandó. */
async function reservar(usuarioId: string, clave: string, mensaje: string, ahora: Date, ids: { tareaId?: string; sugerenciaId?: string } = {}) {
  try {
    const r = await prisma.recordatorio.create({
      data: { usuarioId, clave, mensaje, fechaEnvio: ahora, estado: 'pendiente', ...ids },
      select: { id: true },
    });
    return r.id;
  } catch (e) {
    if (yaExiste(e)) return null;
    throw e;
  }
}

export async function procesarAvisos(ahora: Date = new Date()) {
  const usuarios = await prisma.usuario.findMany({
    where: { eliminadoEn: null, suscripcionesPush: { some: {} } },
    select: { id: true, zonaHoraria: true, avisos: true },
  });
  const resultado = { usuarios: usuarios.length, bloques: 0, resumenes: 0 };
  if (!usuarios.length) return resultado;
  const datos = new Map(usuarios.map((u) => [u.id, { zona: u.zonaHoraria, prefs: leerPreferencias(u.avisos) }]));

  // 1) Bloques que están por empezar
  const conBloques = usuarios.filter((u) => datos.get(u.id)!.prefs.bloques).map((u) => u.id);
  if (conBloques.length) {
    const { desde, hasta } = ventanaBloques(ahora);
    const proximos = await prisma.sugerencia.findMany({
      where: {
        usuarioId: { in: conBloques }, estado: 'aceptada', fechaInicio: { gt: desde, lte: hasta },
        tarea: { eliminadoEn: null, estado: ABIERTA },
      },
      select: { id: true, usuarioId: true, tareaId: true, fechaInicio: true, fechaFin: true, motivo: true, tarea: { select: { titulo: true } } },
    });
    for (const b of proximos) {
      const zona = datos.get(b.usuarioId)!.zona;
      const aviso = avisoBloque({ id: b.id, titulo: b.tarea.titulo, tipo: b.motivo, inicio: b.fechaInicio, fin: b.fechaFin }, ahora, zona);
      const id = await reservar(b.usuarioId, claveBloque(b.id), aviso.titulo, ahora, { tareaId: b.tareaId, sugerenciaId: b.id });
      if (!id) continue;
      const ttl = Math.max(60, Math.round((b.fechaInicio.getTime() - ahora.getTime()) / 1000));
      const llegaron = await enviarAUsuario(b.usuarioId, aviso, ttl);
      await prisma.recordatorio.update({ where: { id }, data: { estado: llegaron ? 'enviado' : 'fallido' } });
      if (llegaron) resultado.bloques++;
    }
  }

  // 2) A las 20:00 de cada uno: lo que vence mañana
  for (const u of usuarios) {
    const { zona, prefs } = datos.get(u.id)!;
    if (!prefs.manana || !esHoraDelResumen(ahora, zona)) continue;
    const id = await reservar(u.id, claveManana(ahora, zona), 'Resumen de mañana', ahora);
    if (!id) continue;
    const manana = sumarDias(diaLocal(ahora, zona), 1);
    const inicio = instanteEnZona(manana, '00:00', zona);
    const tareas = await prisma.tarea.findMany({
      where: { usuarioId: u.id, eliminadoEn: null, estado: ABIERTA, fechaLimite: { gte: inicio, lt: new Date(inicio.getTime() + DIA_MS) } },
      select: { titulo: true, fechaLimite: true, horaDefinida: true },
    });
    const aviso = avisoManana(tareas, zona);
    if (!aviso) {
      await prisma.recordatorio.update({ where: { id }, data: { estado: 'sin_nada' } });
      continue;
    }
    const llegaron = await enviarAUsuario(u.id, aviso, 3 * 3600);
    await prisma.recordatorio.update({ where: { id }, data: { estado: llegaron ? 'enviado' : 'fallido', mensaje: aviso.titulo } });
    if (llegaron) resultado.resumenes++;
  }

  // 3) Limpieza: las claves de más de 30 días ya no sirven para evitar repetidos
  await prisma.recordatorio.deleteMany({ where: { clave: { not: null }, creadoEn: { lt: new Date(ahora.getTime() - 30 * DIA_MS) } } });
  return resultado;
}
