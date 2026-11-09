/**
 * Propuesta de plan para una actividad, con lo que hay en la base y lo aprendido del usuario.
 * La usan GET /api/plan (para mostrarla) y POST /api/plan (para comparar con lo que guardó el usuario).
 */
import { prisma } from '@/lib/prisma/cliente';
import { horasPorDefecto } from '@/lib/estimacion/rubrica';
import { franjaPreferida } from '@/lib/estimacion/personal';
import { cargarAprendizaje } from '@/lib/aprendizaje/senales';
import { cargarContextoPlan, type ContextoDeUsuario } from './cargar';
import { inicioDePlan, limiteDePlan, planificar, type Franja, type Plan } from './planificador';

export type TareaParaPlan = {
  id: string; titulo: string; tipo: string; materiaId: string | null; fechaLimite: Date; horaDefinida: boolean;
  duracionEstMin: number | null;
};

export type Propuesta = { plan: Plan | null; horas: number; limite: Date; ctx: ContextoDeUsuario; preferencia: Franja | null };

export async function proponerPlan(usuarioId: string, tarea: TareaParaPlan, horasPedidas: number | null, ahora: Date = new Date()): Promise<Propuesta> {
  const horas = horasPedidas ?? (tarea.duracionEstMin ? tarea.duracionEstMin / 60 : horasPorDefecto(tarea.tipo));
  const [usuario, aprendido] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { zonaHoraria: true } }),
    cargarAprendizaje(usuarioId, ahora),
  ]);
  const limite = limiteDePlan(tarea, usuario?.zonaHoraria ?? 'America/La_Paz');
  // Solo se cargan los días que se pueden planificar (últimos 28 antes del límite): así una fecha lejana
  // no queda fuera del rango de días. Los bloques propios se traen todos aparte (ver cargarContextoPlan).
  const desde = inicioDePlan(limite, ahora);
  const hasta = limite > desde ? limite : desde;
  const ctx = await cargarContextoPlan(usuarioId, desde, hasta, ahora, tarea.id, tarea.materiaId);
  const preferencia = franjaPreferida(aprendido.franjas, ahora);

  const plan = limite > ahora
    ? planificar({ ...tarea, horas }, {
        dias: ctx.dias
          .map((d) => ({ ...d, huecos: d.huecos.filter((h) => h.fin > desde && h.inicio < limite) }))
          .filter((d) => d.huecos.length),
        zona: ctx.zona, preferencia,
        minutosMateriaPorDia: ctx.minutosMateriaPorDia, minutosEstudioPorDia: ctx.minutosEstudioPorDia,
      }, ahora)
    : null;
  return { plan, horas, limite, ctx, preferencia };
}
