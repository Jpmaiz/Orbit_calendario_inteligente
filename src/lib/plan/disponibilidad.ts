/**
 * Tiempo libre real del usuario para el motor de prioridad (GET /api/tareas):
 * - horas de estudio por día (promedio de los huecos de las próximas 2 semanas, tope 4 h);
 * - horas libres entre ahora y una fecha (para "Hasta mañana a las 09:00 te queda ~1 h libre");
 * - horas ya planificadas de cada actividad (bloques de estudio guardados).
 * En caché 10 min por usuario. Guardar o borrar un plan, o confirmar un horario, la limpia (olvidarDisponibilidad).
 */
import { cargarContextoPlan } from './cargar';
import { horasLibresPorDia, type HuecosDelDia } from './huecos';
import { CONFIG_PLAN } from './planificador';

const DIA_MS = 86_400_000;
const HORIZONTE_DIAS = 14;
const TTL_MS = 10 * 60_000;

export type Disponibilidad = {
  horasPorDia: number;
  /** Horas libres de estudio entre `ahora` y `fin` (tope diario de estudio). Más allá de 2 semanas, promedio por día. */
  libresHasta: (fin: Date, ahora?: Date) => number;
  /** Horas de bloques guardados de esa actividad que quedan entre ahora y su fecha. */
  planificadas: (tareaId: string, fin: Date, ahora?: Date) => number;
};

type Datos = { dias: HuecosDelDia[]; bloques: { tareaId: string; inicio: Date; fin: Date }[]; horasPorDia: number; horizonte: number };
const cache = new Map<string, { datos: Datos; hasta: number }>();

export function olvidarDisponibilidad(usuarioId: string) {
  cache.delete(usuarioId);
}

/** Puro: arma las funciones a partir de los huecos y bloques (se prueba sin base de datos). */
export function disponibilidadDe(datos: Datos): Disponibilidad {
  const topeMin = CONFIG_PLAN.maxEstudioDiaMin;
  return {
    horasPorDia: datos.horasPorDia,
    libresHasta(fin, ahora = new Date()) {
      if (fin <= ahora) return 0;
      let min = 0;
      for (const d of datos.dias) {
        let delDia = 0;
        for (const h of d.huecos) {
          const a = Math.max(h.inicio.getTime(), ahora.getTime());
          const b = Math.min(h.fin.getTime(), fin.getTime());
          if (b > a) delDia += (b - a) / 60_000;
        }
        min += Math.min(topeMin, delDia);
      }
      // Lo que queda después del horizonte cargado: promedio por día
      const despues = Math.max(0, fin.getTime() - Math.max(datos.horizonte, ahora.getTime()));
      return min / 60 + (despues / DIA_MS) * datos.horasPorDia;
    },
    planificadas(tareaId, fin, ahora = new Date()) {
      let min = 0;
      for (const b of datos.bloques) {
        if (b.tareaId !== tareaId || b.fin <= ahora || b.inicio >= fin) continue;
        min += (Math.min(b.fin.getTime(), fin.getTime()) - Math.max(b.inicio.getTime(), ahora.getTime())) / 60_000;
      }
      return min / 60;
    },
  };
}

export async function cargarDisponibilidad(usuarioId: string, ahora: Date = new Date()): Promise<Disponibilidad> {
  const c = cache.get(usuarioId);
  if (c && c.hasta > Date.now()) return disponibilidadDe(c.datos);
  const horizonte = ahora.getTime() + HORIZONTE_DIAS * DIA_MS;
  const ctx = await cargarContextoPlan(usuarioId, ahora, new Date(horizonte), ahora);
  const datos: Datos = {
    dias: ctx.dias,
    bloques: ctx.bloquesAceptados ?? [],
    horasPorDia: Math.max(0.5, horasLibresPorDia(ctx.dias, CONFIG_PLAN.maxEstudioDiaMin / 60)),
    horizonte,
  };
  cache.set(usuarioId, { datos, hasta: Date.now() + TTL_MS });
  return disponibilidadDe(datos);
}
