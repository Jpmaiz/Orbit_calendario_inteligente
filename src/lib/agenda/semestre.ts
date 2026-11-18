/**
 * "Tu semestre a la vista": lo que viene en las próximas 8 semanas, para anticiparse.
 * Semana más pesada, materia con más carga, horas que faltan planificar y próximo examen. Código puro.
 */
import { diaLocal, claveDia, sumarDias } from '@/lib/plan/huecos';

type TareaResumen = {
  id: string; titulo: string; tipo: string; estado: string; fechaLimite: Date | string;
  estimado: { horas: number } | null; plan: { minutos: number } | null;
  materia: { nombre: string; color?: string | null } | null;
};

const SEMANAS = 8;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const redondear = (h: number) => Math.round(h * 2) / 2;
const abierta = (t: TareaResumen) => t.estado === 'pendiente' || t.estado === 'en_proceso';

export function resumirSemestre(tareas: TareaResumen[], ahora: Date, zona: string) {
  const hoy = diaLocal(ahora, zona);
  const lunes = sumarDias(hoy, 1 - hoy.diaSemana);
  const fin = new Date(ahora.getTime() + SEMANAS * 7 * 86_400_000);
  const futuras = tareas.filter((t) => abierta(t) && new Date(t.fechaLimite) >= ahora && new Date(t.fechaLimite) <= fin);
  const horasDe = (t: TareaResumen) => t.estimado?.horas ?? 0;

  // Carga por semana (lunes a domingo), según cuándo vence cada actividad
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const desde = sumarDias(lunes, i * 7), hasta = sumarDias(desde, 6);
    const claveDesde = claveDia(desde), claveHasta = claveDia(hasta);
    const delas = futuras.filter((t) => { const k = claveDia(diaLocal(new Date(t.fechaLimite), zona)); return k >= claveDesde && k <= claveHasta; });
    return {
      desde: claveDesde, hasta: claveHasta,
      etiqueta: `${desde.d}${desde.m !== hasta.m ? ' ' + MESES[desde.m - 1] : ''} al ${hasta.d} ${MESES[hasta.m - 1]}`,
      horas: redondear(delas.reduce((s, t) => s + horasDe(t), 0)), actividades: delas.length,
    };
  });
  const pesada = semanas.reduce((a, b) => (b.horas > a.horas ? b : a), semanas[0]);
  const semanaPesada = pesada.horas >= 6 ? {
    ...pesada,
    mensaje: pesada.desde === semanas[0].desde
      ? `Esta semana es la más cargada: ~${pesada.horas} h en ${pesada.actividades} actividades.`
      : `La semana del ${pesada.etiqueta} es la más cargada: ~${pesada.horas} h en ${pesada.actividades} actividades. Conviene empezar antes.`,
  } : null;

  // Materia con más horas por delante
  const porMateria = new Map<string, { nombre: string; color: string | null; horas: number; actividades: number }>();
  for (const t of futuras) {
    if (!t.materia) continue;
    const m = porMateria.get(t.materia.nombre) ?? { nombre: t.materia.nombre, color: t.materia.color ?? null, horas: 0, actividades: 0 };
    m.horas += horasDe(t);
    m.actividades += 1;
    porMateria.set(m.nombre, m);
  }
  const materias = [...porMateria.values()].sort((a, b) => b.horas - a.horas).map((m) => ({ ...m, horas: redondear(m.horas) }));

  const porPlanificarHoras = redondear(futuras.reduce((s, t) => s + Math.max(0, horasDe(t) - (t.plan?.minutos ?? 0) / 60), 0));
  const examen = futuras.filter((t) => t.tipo === 'examen' || t.tipo === 'exposicion')
    .sort((a, b) => +new Date(a.fechaLimite) - +new Date(b.fechaLimite))[0];

  return {
    semanas, semanaPesada,
    materiaMasPesada: materias[0] ?? null, materias,
    porPlanificarHoras,
    proximoExamen: examen ? { id: examen.id, titulo: examen.titulo, tipo: examen.tipo, fecha: new Date(examen.fechaLimite).toISOString() } : null,
  };
}
