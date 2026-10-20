/**
 * Motor de prioridad de Orbit (determinista, sin IA).
 *
 * Idea central: "holgura" (Least Slack Time, de sistemas de tiempo real).
 *   holgura = días que faltan − días de trabajo que necesitas para llegar
 * Menos holgura = más urgente. Así un proyecto grande que vence en 2 semanas
 * puede ser más urgente que una lectura corta que vence en 2 días.
 *
 * La IA solo aporta DATOS de entrada (horas estimadas y dificultad).
 * El puntaje lo calcula esta fórmula, explicable paso a paso.
 */

export const CONFIG_PRIORIDAD = {
  /** Horas de estudio disponibles por día (fuera de clases). Fase 5: saldrá del horario real. */
  horasEstudioPorDia: 3,
  /**
   * Colchón por la "falacia de planificación" (Buehler et al., 1994): la gente subestima
   * cuánto tarda. Crece con la dificultad, porque lo difícil es más incierto.
   * dificultad 1 → ×1.25 · 3 → ×1.5 · 5 → ×1.75
   */
  colchonBase: 1.25,
  colchonPorNivelDificultad: 0.125,
  /** Cada vez que la holgura crece en estos días, la urgencia se reduce a la mitad. */
  mediaVidaHolguraDias: 3,
  /** Zona horaria para escribir fechas en los mensajes. */
  zonaHoraria: "America/La_Paz",
};

export type ConfigPrioridad = typeof CONFIG_PRIORIDAD;

/** Horas por defecto si nadie estimó la tarea (ni el usuario ni la IA). */
export const HORAS_POR_TIPO: Record<string, number> = {
  examen: 6,
  proyecto: 10,
  entrega: 4,
  exposicion: 3,
  tarea: 2,
};

const URGENCIA_MAX = 75;
const PESO_PRIORIDAD = { alta: 25, media: 15, baja: 5 } as const;

export type TareaParaPriorizar = {
  tipo: string;
  fechaLimite: Date | string;
  prioridad: "alta" | "media" | "baja" | string;
  estado: string;
  /** null = nadie la estimó: se usan las horas por tipo. */
  duracionEstMin: number | null;
  /** 1 (fácil) a 5 (muy difícil). La sugiere la IA y el usuario puede corregirla. */
  dificultad?: number | null;
};

export type NivelPrioridad = "vencida" | "critica" | "alta" | "media" | "baja" | "ninguna";

export type ResultadoPrioridad = {
  /** 0–100. Más alto = merece atención antes. */
  puntaje: number;
  nivel: NivelPrioridad;
  /** Horas de trabajo de esta tarea, con colchón incluido. */
  horasNecesarias: number;
  /** Días de margen antes de que "ya deberías estar trabajando". Negativo = atrasada. */
  holguraDias: number;
  /** Recomendación: horas por día para llegar a tiempo con esta tarea. */
  horasPorDia: number;
  /** Último día recomendado para empezar. */
  fechaInicioSugerida: string | null;
  /** Horas de trabajo que no caben antes de la fecha límite. 0 = alcanza el tiempo. */
  sobrecargaHoras: number;
  mensaje: string;
  /** De dónde sale el número, para mostrarlo o defenderlo. */
  desglose: {
    urgencia: number; // 0–75
    importancia: number; // 5–25
    horasBase: number; // estimación sin colchón
    origenHoras: "estimada" | "por_tipo";
    factorColchon: number;
    horasOtrasTareas: number; // trabajo de otras tareas que vencen antes o el mismo día
  };
};

const MS_POR_DIA = 1000 * 60 * 60 * 24;
const redondear = (n: number, paso = 0.5) => Math.round(n / paso) * paso;
const dificultadDe = (t: TareaParaPriorizar) =>
  Math.min(5, Math.max(1, Math.round(t.dificultad ?? 3)));

/** Factor de colchón según la dificultad (más difícil = más incierto). */
export function factorColchonDe(tarea: TareaParaPriorizar, config: ConfigPrioridad = CONFIG_PRIORIDAD) {
  return config.colchonBase + config.colchonPorNivelDificultad * (dificultadDe(tarea) - 1);
}

/** Horas de trabajo (con colchón) que necesita una tarea. */
export function horasNecesariasDe(tarea: TareaParaPriorizar, config: ConfigPrioridad = CONFIG_PRIORIDAD): number {
  const estimada = tarea.duracionEstMin != null && tarea.duracionEstMin > 0;
  const horasBase = estimada ? tarea.duracionEstMin! / 60 : HORAS_POR_TIPO[tarea.tipo] ?? 3;
  return horasBase * factorColchonDe(tarea, config);
}

const estaCerrada = (t: TareaParaPriorizar) => t.estado === "completada" || t.estado === "no_realizada";

/**
 * Calcula la prioridad de UNA tarea.
 * @param horasOtrasTareas horas de otras tareas activas que vencen antes o el mismo día
 *                         (compiten por tu tiempo). `priorizarTareas` lo calcula solo.
 */
export function calcularPrioridad(
  tarea: TareaParaPriorizar,
  ahora: Date = new Date(),
  config: ConfigPrioridad = CONFIG_PRIORIDAD,
  horasOtrasTareas = 0,
): ResultadoPrioridad {
  const estimada = tarea.duracionEstMin != null && tarea.duracionEstMin > 0;
  const horasBase = estimada ? tarea.duracionEstMin! / 60 : HORAS_POR_TIPO[tarea.tipo] ?? 3;
  const factorColchon = factorColchonDe(tarea, config);
  const horasNecesarias = horasBase * factorColchon;

  const desgloseBase = {
    horasBase: redondear(horasBase),
    origenHoras: (estimada ? "estimada" : "por_tipo") as "estimada" | "por_tipo",
    factorColchon,
    horasOtrasTareas: redondear(horasOtrasTareas),
  };

  const sinPuntaje = (nivel: NivelPrioridad, mensaje: string): ResultadoPrioridad => ({
    puntaje: 0,
    nivel,
    horasNecesarias: redondear(horasNecesarias),
    holguraDias: 0,
    horasPorDia: 0,
    fechaInicioSugerida: null,
    sobrecargaHoras: 0,
    mensaje,
    desglose: { ...desgloseBase, urgencia: 0, importancia: 0 },
  });

  if (tarea.estado === "completada") return sinPuntaje("ninguna", "Completada.");
  if (tarea.estado === "no_realizada") return sinPuntaje("ninguna", "Marcada como no realizada.");

  const fechaLimite = new Date(tarea.fechaLimite);
  const diasRestantes = (fechaLimite.getTime() - ahora.getTime()) / MS_POR_DIA;

  // Una tarea vencida ya no compite por tu tiempo: hay que decidir qué hacer con ella.
  if (diasRestantes < 0) {
    return sinPuntaje("vencida", "Esta tarea venció. ¿Quieres reprogramarla o marcarla como no realizada?");
  }

  // 1) Holgura: días que quedan menos días de trabajo (esta tarea + las que vencen antes o igual)
  const diasOcupados = (horasNecesarias + horasOtrasTareas) / config.horasEstudioPorDia;
  const holguraDias = diasRestantes - diasOcupados;

  // 2) Urgencia: máxima sin holgura; se reduce a la mitad por cada "media vida" de margen
  const urgencia =
    holguraDias <= 0 ? URGENCIA_MAX : URGENCIA_MAX * Math.pow(0.5, holguraDias / config.mediaVidaHolguraDias);

  // 3) Importancia: la que marcó el usuario
  const importancia = PESO_PRIORIDAD[tarea.prioridad as keyof typeof PESO_PRIORIDAD] ?? PESO_PRIORIDAD.media;

  const puntaje = Math.round(Math.min(100, urgencia + importancia));

  // 4) Recomendación concreta
  const diasUtiles = Math.max(1, Math.floor(diasRestantes));
  const horasPorDia = diasRestantes < 1 ? horasNecesarias : horasNecesarias / diasUtiles;
  const inicio = new Date(Math.max(ahora.getTime(), fechaLimite.getTime() - diasOcupados * MS_POR_DIA));

  // Sobrecarga: trabajo que no cabe en las horas libres hasta la fecha límite
  const horasDisponibles = diasRestantes * config.horasEstudioPorDia;
  const horasDemanda = horasNecesarias + horasOtrasTareas;
  const sobrecargaHoras = Math.max(0, horasDemanda - horasDisponibles);

  // Tono de sugerencia: la app propone, el usuario decide.
  let mensaje: string;
  if (holguraDias <= -1) {
    mensaje =
      `Parece que el tiempo no alcanza: hasta esta entrega hay ~${redondear(horasDemanda)} h de trabajo ` +
      `y ~${redondear(horasDisponibles)} h libres. Podrías pedir una prórroga o reducir el alcance de algo.`;
  } else if (holguraDias < 2) {
    // Si compite con otras tareas, el ritmo real es el de toda la carga, no el de esta sola
    const conOtras = horasOtrasTareas > 0;
    const ritmo = redondear(conOtras ? horasDemanda / diasUtiles : horasPorDia);
    const contando = conOtras ? "Contando lo que vence antes o el mismo día, " : "";
    mensaje =
      holguraDias <= 0
        ? `Te sugiero empezar pronto. ${contando}con ~${ritmo} h por día llegarías a tiempo.`
        : `Te sugiero empezar hoy o mañana. ${contando}~${ritmo} h por día serían suficientes.`;
  } else {
    const dia = inicio.toLocaleDateString("es-BO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: config.zonaHoraria,
    });
    mensaje = `Tienes margen. Te sugiero empezar a más tardar el ${dia} (~${redondear(horasNecesarias)} h en total).`;
  }

  const nivel: NivelPrioridad =
    puntaje >= 80 ? "critica" : puntaje >= 60 ? "alta" : puntaje >= 35 ? "media" : "baja";

  return {
    puntaje,
    nivel,
    horasNecesarias: redondear(horasNecesarias),
    holguraDias: Math.round(holguraDias * 10) / 10,
    horasPorDia: redondear(horasPorDia),
    fechaInicioSugerida: inicio.toISOString(),
    sobrecargaHoras: redondear(sobrecargaHoras),
    mensaje,
    desglose: {
      ...desgloseBase,
      urgencia: Math.round(urgencia),
      importancia,
    },
  };
}

/**
 * Prioriza la lista completa del usuario.
 *
 * Carga acumulada (criterio de demanda de EDF): para cada tarea suma el trabajo de todas
 * las tareas activas que vencen ANTES o EL MISMO DÍA. Todo ese trabajo tiene que caber
 * antes de su fecha, así que reduce su margen real.
 *
 * Orden: activas por puntaje (empate → la que vence antes), luego vencidas, luego cerradas.
 */
export function priorizarTareas<T extends TareaParaPriorizar>(
  tareas: T[],
  ahora: Date = new Date(),
  config: ConfigPrioridad = CONFIG_PRIORIDAD,
): (T & { prioridadCalculada: ResultadoPrioridad })[] {
  const activas = tareas
    .filter((t) => !estaCerrada(t) && new Date(t.fechaLimite).getTime() >= ahora.getTime())
    // Fecha límite al minuto: "23:59:00" y "23:59:59" cuentan como la misma
    .map((t) => ({ t, fin: Math.floor(new Date(t.fechaLimite).getTime() / 60000), horas: horasNecesariasDe(t, config) }));

  const horasOtrasDe = new Map<T, number>();
  for (const a of activas) {
    const carga = activas.reduce((suma, b) => (b !== a && b.fin <= a.fin ? suma + b.horas : suma), 0);
    horasOtrasDe.set(a.t, carga);
  }

  const grupo = (r: ResultadoPrioridad) => (r.nivel === "vencida" ? 1 : r.nivel === "ninguna" ? 2 : 0);

  return tareas
    .map((t) => ({
      ...t,
      prioridadCalculada: calcularPrioridad(t, ahora, config, horasOtrasDe.get(t) ?? 0),
    }))
    .sort(
      (a, b) =>
        grupo(a.prioridadCalculada) - grupo(b.prioridadCalculada) ||
        b.prioridadCalculada.puntaje - a.prioridadCalculada.puntaje ||
        new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime(),
    );
}