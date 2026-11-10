import { prisma } from '@/lib/prisma/cliente';
import { zonaDeUsuario } from '@/lib/usuarios/zona';
import { diaLocal } from '@/lib/plan/huecos';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

const HORA_MS = 3_600_000;

/**
 * Cierre automático (Fase 3): un examen o una entrega ocurren en su fecha igual, así que al pasar la fecha
 * la actividad se da por hecha. El usuario nunca tiene que marcarla.
 *
 * - Con hora definida: se cierra 1 h después de esa hora.
 * - Sin hora definida ("hora por definir"): la hora guardada es solo interna (08:00, 23:59), así que NO cuenta;
 *   se cierra recién cuando terminó ese día en la zona del usuario.
 * - `cerradaSolaEn` puesto = el cierre automático ya no actúa sobre ella: ya la cerró una vez, o el usuario la
 *   reabrió (aunque la hubiera completado a mano). Si el usuario cambia la fecha, se limpia y vuelve a aplicar.
 *
 * Se llama al leer tareas o agenda (barato: dos updateMany).
 */
/** Último cierre por usuario en este proceso: agenda y tareas lo piden en cada carga; basta cada 5 min. */
const ultimoCierre = new Map<string, number>();
const CADA_MS = 5 * 60_000;

export async function cerrarVencidas(usuarioId: string, ahora: Date = new Date()) {
  const ultimo = ultimoCierre.get(usuarioId);
  if (ultimo && ahora.getTime() - ultimo < CADA_MS) return { count: 0 };
  ultimoCierre.set(usuarioId, ahora.getTime());
  const zona = await zonaDeUsuario(usuarioId);
  const inicioDeHoy = instanteEnZona(diaLocal(ahora, zona), '00:00', zona);
  const abiertas = {
    usuarioId, eliminadoEn: null, cerradaSolaEn: null,
    estado: { in: ['pendiente', 'en_proceso'] },
  };
  const data = { estado: 'completada', completadaEn: ahora, cerradaSolaEn: ahora };
  const [conHora, sinHora] = await Promise.all([
    prisma.tarea.updateMany({ where: { ...abiertas, horaDefinida: true, fechaLimite: { lt: new Date(ahora.getTime() - HORA_MS) } }, data }),
    prisma.tarea.updateMany({ where: { ...abiertas, horaDefinida: false, fechaLimite: { lt: inicioDeHoy } }, data }),
  ]);
  return { count: conHora.count + sinHora.count };
}
