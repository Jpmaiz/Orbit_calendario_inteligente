/**
 * Planificador de bloques de estudio (Fase 2). Código puro y determinista: la IA no decide horarios.
 *
 * Reparte las horas estimadas de UNA actividad en los huecos libres antes de su fecha:
 * 1. Bloques de 60 min (50 de estudio + 10 de pausa; Biwer et al., 2023). Media hora como mínimo.
 * 2. Máximo 2 h de la misma materia por día y 4 h de estudio en total por día.
 * 3. Examen: en al menos 3 días distintos (estudio espaciado; Cepeda et al., 2006). El último día antes del
 *    examen queda un repaso corto con preguntas. Nunca se estudia el mismo día del examen.
 * 4. Los días se eligen repartidos en el rango (no todo al final), y los días más cercanos a la fecha reciben más.
 * 5. Si no alcanza el tiempo, se arma lo que cabe y se dice cuánto falta.
 *
 * Se prueba con scripts/probar-plan.ts (simulacro del examen de Redes del miércoles).
 */
import { instanteEnZona } from '@/lib/fechas/resolverFecha';
import { diaLocal, type Hueco, type HuecosDelDia } from './huecos';

export const CONFIG_PLAN = {
  /** Duración normal de un bloque: 50 min de estudio + 10 de pausa. */
  bloqueMin: 60,
  /** Unidad mínima de reparto. */
  pasoMin: 30,
  maxMateriaDiaMin: 120,
  maxEstudioDiaMin: 240,
  /** Un examen se reparte en al menos estos días (incluido el repaso). */
  diasMinimosExamen: 3,
  /** Repaso del día anterior: 30 min, o 60 si el examen pide 4 h o más. */
  repasoCortoMin: 30,
  repasoLargoMin: 60,
  /** Solo se planifica dentro de los últimos N días antes de la fecha. */
  horizonteDias: 28,
  /** Una entrega con hora: el último bloque termina al menos esto antes. */
  margenAntesDeEntregaMin: 60,
};
export type ConfigPlan = typeof CONFIG_PLAN;

export type Franja = 'manana' | 'tarde' | 'noche';
const FRANJAS: Record<Franja, [string, string]> = { manana: ['07:00', '14:00'], tarde: ['14:00', '19:00'], noche: ['19:00', '22:30'] };
/** Sin datos del usuario (Fase 3 los aprende): tarde, luego noche, luego mañana. */
const ORDEN_POR_DEFECTO: Franja[] = ['tarde', 'noche', 'manana'];

export type TareaAPlanificar = {
  titulo: string;
  tipo: string;                // examen | tarea | entrega | proyecto | exposicion
  fechaLimite: Date;
  horaDefinida: boolean;
  horas: number;               // horas netas (estimación o lo que fijó el usuario)
};

export type ContextoPlan = {
  /** Huecos libres (sin clases, eventos ni bloques aceptados de OTRAS actividades), hasta el límite del plan. */
  dias: HuecosDelDia[];
  /** Minutos ya planificados por día ("2026-11-08") de la misma materia y de estudio en total (otras actividades). */
  minutosMateriaPorDia?: Map<string, number>;
  minutosEstudioPorDia?: Map<string, number>;
  zona: string;
  preferencia?: Franja | null;
};

export type BloquePlan = { inicio: Date; fin: Date; minutos: number; tipo: 'estudio' | 'repaso' };

export type Plan = {
  bloques: BloquePlan[];
  minutosNecesarios: number;
  minutosPlanificados: number;
  faltanMin: number;           // > 0 = no alcanzó el tiempo
  libresAntesMin: number;      // tiempo libre que había (con los topes por día)
  diasUsados: number;
  limite: string;              // ISO: ningún bloque termina después
  aviso: string | null;
};

const MIN_MS = 60_000;

/** Último instante en que puede terminar un bloque de esta actividad. */
export function limiteDePlan(t: Pick<TareaAPlanificar, 'tipo' | 'fechaLimite' | 'horaDefinida'>, zona: string, config: ConfigPlan = CONFIG_PLAN): Date {
  const dia = diaLocal(t.fechaLimite, zona);
  // Examen: nunca el mismo día (el repaso es el día anterior). Sin hora definida: se asume el inicio del día.
  if (t.tipo === 'examen' || !t.horaDefinida) return instanteEnZona(dia, '00:00', zona);
  return new Date(t.fechaLimite.getTime() - config.margenAntesDeEntregaMin * MIN_MS);
}

/** Desde cuándo vale la pena planificar (horizonte de 28 días antes del límite). */
export function inicioDePlan(limite: Date, ahora: Date, config: ConfigPlan = CONFIG_PLAN): Date {
  return new Date(Math.max(ahora.getTime(), limite.getTime() - config.horizonteDias * 86_400_000));
}

const minutosDe = (h: number, paso: number) => Math.max(paso, Math.ceil((h * 60) / paso) * paso);

export function planificar(
  tarea: TareaAPlanificar,
  ctx: ContextoPlan,
  ahora: Date = new Date(),
  config: ConfigPlan = CONFIG_PLAN,
): Plan {
  const limite = limiteDePlan(tarea, ctx.zona, config);
  const necesarios = minutosDe(tarea.horas, config.pasoMin);
  const esExamen = tarea.tipo === 'examen';
  const materia = ctx.minutosMateriaPorDia ?? new Map<string, number>();
  const estudio = ctx.minutosEstudioPorDia ?? new Map<string, number>();
  const orden = ctx.preferencia ? [ctx.preferencia, ...ORDEN_POR_DEFECTO.filter((f) => f !== ctx.preferencia)] : ORDEN_POR_DEFECTO;

  // Días útiles: huecos recortados al límite y capacidad según los topes por día
  type DiaPlan = { dia: string; huecos: Hueco[]; cupo: number; asignado: number };
  const dias: DiaPlan[] = ctx.dias
    .map((d) => {
      const huecos = d.huecos
        .map((h) => recortar(h, ahora, limite, config.pasoMin))
        .filter((h): h is Hueco => h !== null && h.minutos >= config.pasoMin);
      const libres = huecos.reduce((s, h) => s + h.minutos, 0);
      const tope = Math.min(
        config.maxMateriaDiaMin - (materia.get(d.dia) ?? 0),
        config.maxEstudioDiaMin - (estudio.get(d.dia) ?? 0),
      );
      const cupo = Math.max(0, Math.floor(Math.min(libres, tope) / config.pasoMin) * config.pasoMin);
      return { dia: d.dia, huecos, cupo, asignado: 0 };
    })
    .filter((d) => d.cupo > 0);

  const libresAntesMin = dias.reduce((s, d) => s + d.cupo, 0);
  const bloques: BloquePlan[] = [];
  let pendiente = necesarios;

  if (dias.length) {
    // 1) Examen: repaso corto el último día útil antes del examen
    let principales = dias;
    // (con un solo día disponible no hay "día anterior": todo es estudio)
    if (esExamen && necesarios >= 3 * config.pasoMin && dias.length >= 2) {
      const repaso = Math.min(necesarios >= 240 ? config.repasoLargoMin : config.repasoCortoMin, pendiente);
      const ultimo = dias[dias.length - 1];
      const puesto = colocar(ultimo, repaso, 'repaso', orden, ctx.zona, config, bloques);
      pendiente -= puesto;
      ultimo.cupo -= puesto;
      if (puesto > 0 && dias.length > 1) principales = dias.slice(0, -1);
    }

    // 2) Elegir días repartidos en el rango
    const minDias = esExamen ? Math.max(1, config.diasMinimosExamen - 1) : 1;
    const k = Math.min(principales.length, Math.max(minDias, Math.ceil(pendiente / config.maxMateriaDiaMin)));
    const elegidos = elegirRepartidos(principales, k);

    // 3) Asignar en trozos de 60 min, empezando por el día más cercano a la fecha
    const ronda = [...elegidos].reverse();
    let avanza = true;
    while (pendiente > 0 && avanza) {
      avanza = false;
      for (const d of ronda) {
        if (pendiente <= 0) break;
        const trozo = Math.min(config.bloqueMin, pendiente, d.cupo - d.asignado);
        if (trozo >= config.pasoMin) {
          d.asignado += trozo;
          pendiente -= trozo;
          avanza = true;
        }
      }
    }
    // 4) Colocar en las horas del día; lo que no entra por huecos partidos vuelve a repartirse
    for (const d of elegidos) {
      const puesto = colocar(d, d.asignado, 'estudio', orden, ctx.zona, config, bloques);
      pendiente += d.asignado - puesto;
    }
    // 5) Si todavía falta, usar lo que quede en cualquier día útil (del más cercano a la fecha hacia atrás)
    for (const d of [...dias].reverse()) {
      if (pendiente <= 0) break;
      const usado = bloques
        .filter((b) => b.tipo === 'estudio' && claveDe(b.inicio, ctx.zona) === d.dia)
        .reduce((s, b) => s + b.minutos, 0);
      const libre = Math.min(d.cupo - usado, pendiente);
      if (libre >= config.pasoMin) pendiente -= colocar(d, libre - (libre % config.pasoMin), 'estudio', orden, ctx.zona, config, bloques);
    }
  }

  bloques.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const planificados = bloques.reduce((s, b) => s + b.minutos, 0);
  const faltan = Math.max(0, necesarios - planificados);
  return {
    bloques: unirSeguidos(bloques),
    minutosNecesarios: necesarios,
    minutosPlanificados: planificados,
    faltanMin: faltan,
    libresAntesMin,
    diasUsados: new Set(bloques.map((b) => claveDe(b.inicio, ctx.zona))).size,
    limite: limite.toISOString(),
    aviso: faltan > 0 ? avisoFalta(planificados, necesarios, tarea, ctx.zona) : null,
  };
}

// ───────────────────────── Ayudantes ─────────────────────────

function recortar(h: Hueco, ahora: Date, limite: Date, paso: number): Hueco | null {
  const pasoMs = paso * MIN_MS;
  const ini = Math.max(h.inicio.getTime(), Math.ceil(ahora.getTime() / (15 * MIN_MS)) * 15 * MIN_MS);
  const fin = Math.min(h.fin.getTime(), limite.getTime());
  const minutos = Math.floor((fin - ini) / pasoMs) * paso;
  return minutos > 0 ? { inicio: new Date(ini), fin: new Date(ini + minutos * MIN_MS), minutos } : null;
}

/** k días repartidos en el rango (incluye el primero y el último cuando k ≥ 2). */
function elegirRepartidos<T>(dias: T[], k: number): T[] {
  if (k <= 0) return [];
  if (k >= dias.length) return [...dias];
  if (k === 1) return [dias[0]]; // empezar antes reduce el riesgo de quedarse corto
  const idx = new Set<number>();
  for (let i = 0; i < k; i++) idx.add(Math.round((i * (dias.length - 1)) / (k - 1)));
  return dias.filter((_, i) => idx.has(i));
}

const claveDe = (f: Date, zona: string) => {
  const d = diaLocal(f, zona);
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
};

/** Hora "HH:mm" de un instante en la zona. */
function hhmm(f: Date, zona: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
}
const aMin = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);

/**
 * Coloca `minutos` de estudio en los huecos del día, de una sola vez si cabe, en la franja preferida.
 * Los huecos usados se descuentan. Devuelve los minutos que pudo colocar.
 */
function colocar(
  d: { huecos: Hueco[] }, minutos: number, tipo: BloquePlan['tipo'], orden: Franja[], zona: string,
  config: ConfigPlan, salida: BloquePlan[],
): number {
  let resto = minutos;
  while (resto >= config.pasoMin) {
    const opcion = mejorLugar(d.huecos, resto, orden, zona, config.pasoMin);
    if (!opcion) break;
    const { hueco, inicio, largo } = opcion;
    const fin = new Date(inicio.getTime() + largo * MIN_MS);
    salida.push({ inicio, fin, minutos: largo, tipo });
    resto -= largo;
    // Descontar del hueco (puede partirse en dos)
    const i = d.huecos.indexOf(hueco);
    const partes: Hueco[] = [];
    const antes = (inicio.getTime() - hueco.inicio.getTime()) / MIN_MS;
    const despues = (hueco.fin.getTime() - fin.getTime()) / MIN_MS;
    if (antes >= config.pasoMin) partes.push({ inicio: hueco.inicio, fin: inicio, minutos: antes });
    if (despues >= config.pasoMin) partes.push({ inicio: fin, fin: hueco.fin, minutos: despues });
    d.huecos.splice(i, 1, ...partes);
  }
  return minutos - resto;
}

/** El mejor lugar: un hueco donde quepa todo (si no, el más grande), empezando en la franja preferida. */
function mejorLugar(huecos: Hueco[], minutos: number, orden: Franja[], zona: string, paso: number) {
  let mejor: { hueco: Hueco; inicio: Date; largo: number; puntaje: number } | null = null;
  for (const h of huecos) {
    const largo = Math.min(minutos, Math.floor(h.minutos / paso) * paso);
    if (largo < paso) continue;
    // Intentar empezar al inicio de cada franja, en orden de preferencia
    for (let r = 0; r < orden.length; r++) {
      const [fi, ff] = FRANJAS[orden[r]];
      const hIni = aMin(hhmm(h.inicio, zona));
      const hFin = hIni + h.minutos;
      const desde = Math.max(hIni, aMin(fi));
      if (desde >= Math.min(hFin, aMin(ff))) continue; // el hueco no toca esta franja
      const inicioMin = Math.min(desde, hFin - largo);
      const inicio = new Date(h.inicio.getTime() + (inicioMin - hIni) * MIN_MS);
      // Primero: que entre completo; luego la franja preferida; luego más temprano
      const puntaje = (largo === minutos ? 0 : 1000 - largo) + r * 100 + inicioMin / 1440;
      if (!mejor || puntaje < mejor.puntaje) mejor = { hueco: h, inicio, largo, puntaje };
      break;
    }
  }
  return mejor;
}

/** Bloques pegados del mismo tipo se muestran como uno solo. */
function unirSeguidos(bloques: BloquePlan[]): BloquePlan[] {
  const salida: BloquePlan[] = [];
  for (const b of bloques) {
    const prev = salida[salida.length - 1];
    if (prev && prev.tipo === b.tipo && prev.fin.getTime() === b.inicio.getTime()) {
      prev.fin = b.fin;
      prev.minutos += b.minutos;
    } else salida.push({ ...b });
  }
  return salida;
}

export function textoHoras(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h} h ${m}` : h ? `${h} h` : `${m} min`;
}

function avisoFalta(planificados: number, necesarios: number, tarea: TareaAPlanificar, zona: string) {
  const dia = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'long' }).format(tarea.fechaLimite);
  if (planificados === 0) return `No quedan horas libres antes del ${dia}.`;
  return `Solo caben ${textoHoras(planificados)} de ~${textoHoras(necesarios)} antes del ${dia}. Puedes sumar un bloque en otro momento.`;
}
