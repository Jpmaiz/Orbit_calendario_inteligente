/**
 * Planificador de bloques de estudio (Fase 2). Código puro y determinista: la IA no decide horarios.
 *
 * Reparte las horas estimadas de UNA actividad en los huecos libres antes de su fecha:
 * 1. Bloques de 60 min (50 de estudio + 10 de pausa; Biwer et al., 2023). Ningún bloque sugerido dura menos de 1 h
 *    ni empieza fuera de :00 o :30 (un bloque puede durar 90 o 120 min). A mano, el usuario puede usar huecos más cortos.
 * 2. Máximo 2 h de la misma materia por día y 4 h de estudio en total por día (o el tope de "Mi ritmo";
 *    la mitad en los días con "menos estudio").
 * 3. Examen: en al menos 3 días distintos (estudio espaciado; Cepeda et al., 2006). El último día antes del
 *    examen queda un repaso de 1 h con preguntas. Nunca se estudia el mismo día del examen.
 * 4. Los días se eligen repartidos en el rango (no todo al final), y los días más cercanos a la fecha reciben más.
 * 5. Si no alcanza el tiempo, se arma lo que cabe y se dice cuánto falta.
 * 6. Cada estudio a su momento (D23): el estudio profundo va donde el usuario tiene energía alta y nunca donde la
 *    tiene baja (salvo que no quede otro hueco antes de la fecha); el repaso, al final del día (dormir después
 *    consolida; Mazza et al., 2016). Con energía "normal" en todo el día se usa el orden de siempre: tarde, noche, mañana.
 *
 * Se prueba con scripts/probar-plan.ts (simulacro del examen de Redes) y scripts/probar-energia.ts.
 */
import { instanteEnZona } from '@/lib/fechas/resolverFecha';
import { ENERGIA_NORMAL, HORARIO_MOMENTO, MOMENTOS, aMinutos, momentoDeMinuto, type Energia, type Momento } from '@/lib/usuarios/ritmo';
import { diaLocal, type Hueco, type HuecosDelDia } from './huecos';

export const CONFIG_PLAN = {
  /** Duración normal de un bloque: 50 min de estudio + 10 de pausa. */
  bloqueMin: 60,
  /** Unidad de reparto: los bloques duran 60, 90, 120… y empiezan en :00 o :30. */
  pasoMin: 30,
  /** Ningún bloque sugerido dura menos que esto (ni se sugieren huecos más cortos). */
  bloqueMinimoMin: 60,
  maxMateriaDiaMin: 120,
  maxEstudioDiaMin: 240,
  /** Un examen se reparte en al menos estos días (incluido el repaso). */
  diasMinimosExamen: 3,
  /** Repaso del día anterior al examen. */
  repasoMin: 60,
  /** Solo se planifica dentro de los últimos N días antes de la fecha. */
  horizonteDias: 28,
  /** Una entrega con hora: el último bloque termina al menos esto antes. */
  margenAntesDeEntregaMin: 60,
};
export type ConfigPlan = typeof CONFIG_PLAN;

/** Qué pide un bloque: profundo (temas nuevos, ejercicios, proyecto), práctica (lo demás) o repaso. */
export type Demanda = 'profundo' | 'practica' | 'repaso';
/** Con la misma energía en todo el día, el orden de siempre: tarde, noche, mañana, mediodía. */
const DESEMPATE: Record<Momento, number> = { tarde: 0, noche: 1, manana: 2, mediodia: 3 };
/** El repaso, lo más tarde posible: noche, tarde, mediodía, mañana. */
const TARDANZA: Record<Momento, number> = { noche: 0, tarde: 1, mediodia: 2, manana: 3 };

/** Cuánto "cuesta" poner un bloque de esa demanda en un momento con ese nivel de energía (0 = ideal). */
export function costoMomento(demanda: Demanda, energia: Energia, m: Momento): number {
  const nivel = energia[m];
  if (demanda === 'repaso') return TARDANZA[m] + (nivel === 'baja' ? 4 : 0);
  if (demanda === 'profundo') return nivel === 'alta' ? 0 : nivel === 'normal' ? 1 : 4;
  return nivel === 'baja' ? 2 : 0;
}

/**
 * Qué pide el estudio de una actividad (D23): profundo si exige analizar, resolver o crear (nivel cognitivo 3–4)
 * o es un proyecto; si no, práctica. Sin lectura de la IA: la dificultad, o el tipo.
 */
export function demandaDe(t: { tipo: string; estimacion?: unknown; dificultad?: number | null }): Demanda {
  const nivel = (t.estimacion as { lectura?: { nivelCognitivo?: unknown } } | null | undefined)?.lectura?.nivelCognitivo;
  if (typeof nivel === 'number') return nivel >= 3 || t.tipo === 'proyecto' ? 'profundo' : 'practica';
  if (typeof t.dificultad === 'number') return t.dificultad >= 4 || t.tipo === 'proyecto' ? 'profundo' : 'practica';
  return t.tipo === 'examen' || t.tipo === 'proyecto' || t.tipo === 'exposicion' ? 'profundo' : 'practica';
}

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
  /** Energía por momento (la elegida + lo aprendido). Sin dato: normal todo el día. */
  energia?: Energia;
  /** Qué pide el estudio de esta actividad (el repaso del examen siempre es "repaso"). Por defecto: práctica. */
  demanda?: Demanda;
  /** Días de la semana (1–7) con la mitad del tope de estudio. */
  diasMenosEstudio?: number[];
};

export type BloquePlan = {
  inicio: Date; fin: Date; minutos: number; tipo: 'estudio' | 'repaso';
  demanda: Demanda;
  momento: Momento;
  /** Por qué está ahí, en pocas palabras ("Tu mejor momento"); null = nada que contar. */
  razon: string | null;
};

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

/** Tope de estudio de un día de la semana: la mitad en los días con "menos estudio", nunca menos de 1 h. */
export function topeEstudio(diaSemana: number, maxMin: number, diasMenos: number[] = []): number {
  return diasMenos.includes(diaSemana) ? Math.max(60, Math.floor(maxMin / 2 / 30) * 30) : maxMin;
}

const minutosDe = (h: number, paso: number) => Math.max(paso, Math.ceil((h * 60) / paso) * paso);

export function planificar(
  tarea: TareaAPlanificar,
  ctx: ContextoPlan,
  ahora: Date = new Date(),
  config: ConfigPlan = CONFIG_PLAN,
): Plan {
  const limite = limiteDePlan(tarea, ctx.zona, config);
  // Lo que se informa es exacto (misma base que el chip "~5 h 15"); lo que se reparte, en medias horas y al menos 1 bloque
  const necesariosExactos = Math.max(1, Math.round(tarea.horas * 60));
  const necesarios = Math.max(config.bloqueMinimoMin, minutosDe(tarea.horas, config.pasoMin));
  const esExamen = tarea.tipo === 'examen';
  const materia = ctx.minutosMateriaPorDia ?? new Map<string, number>();
  const estudio = ctx.minutosEstudioPorDia ?? new Map<string, number>();
  const energia = ctx.energia ?? ENERGIA_NORMAL;
  const demanda: Demanda = ctx.demanda ?? 'practica';
  // El estudio profundo no va donde el usuario tiene poca energía (salvo que no quede otra: paso 6)
  const evitar = demanda === 'profundo' ? MOMENTOS.filter((m) => energia[m] === 'baja') : [];
  const lugar: Lugar = { energia, zona: ctx.zona, paso: config.pasoMin, minimo: config.bloqueMinimoMin };

  // Días útiles: huecos recortados al límite y capacidad según los topes por día
  type DiaPlan = { dia: string; huecos: Hueco[]; todos: Hueco[]; tope: number; cupo: number; cupoTotal: number; asignado: number };
  const dias: DiaPlan[] = ctx.dias
    .map((d) => {
      const todos = d.huecos
        .map((h) => recortar(h, ahora, limite, config.pasoMin))
        .filter((h): h is Hueco => h !== null && h.minutos >= config.bloqueMinimoMin);
      const huecos = evitar.length
        ? todos.flatMap((h) => quitarMomentos(h, evitar, ctx.zona)).filter((h) => h.minutos >= config.bloqueMinimoMin)
        : [...todos];
      const libres = huecos.reduce((s, h) => s + h.minutos, 0);
      const tope = Math.min(
        config.maxMateriaDiaMin - (materia.get(d.dia) ?? 0),
        topeEstudio(d.diaSemana, config.maxEstudioDiaMin, ctx.diasMenosEstudio) - (estudio.get(d.dia) ?? 0),
      );
      const enPasos = (min: number) => Math.max(0, Math.floor(Math.min(min, tope) / config.pasoMin) * config.pasoMin);
      const cupo = enPasos(libres);
      const cupoTotal = enPasos(todos.reduce((s, h) => s + h.minutos, 0));
      return { dia: d.dia, huecos, todos, tope, cupo, cupoTotal, asignado: 0 };
    })
    .filter((d) => d.cupoTotal > 0);

  const libresAntesMin = dias.reduce((s, d) => s + d.cupoTotal, 0);
  const bloques: BloquePlan[] = [];
  let pendiente = necesarios;
  const conCupo = dias.filter((d) => d.cupo > 0);

  if (conCupo.length) {
    // 1) Examen: repaso corto el último día útil antes del examen
    let principales = conCupo;
    // (con un solo día disponible no hay "día anterior": todo es estudio)
    if (esExamen && necesarios >= config.repasoMin + config.bloqueMinimoMin && conCupo.length >= 2) {
      const repaso = Math.min(config.repasoMin, pendiente);
      const ultimo = conCupo[conCupo.length - 1];
      // El repaso es liviano: puede ir en cualquier hueco del día, de preferencia al final
      const puesto = colocar(ultimo, repaso, 'repaso', 'repaso', lugar, config, bloques, ultimo.todos);
      pendiente -= puesto;
      ultimo.cupo -= puesto;
      if (puesto > 0 && conCupo.length > 1) principales = conCupo.slice(0, -1);
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
        // Un día recibe al menos 1 h: media hora suelta solo se suma a un día que ya tiene su bloque
        if (trozo >= config.pasoMin && d.asignado + trozo >= config.bloqueMinimoMin) {
          d.asignado += trozo;
          pendiente -= trozo;
          avanza = true;
        }
      }
    }
    // 4) Colocar en las horas del día; lo que no entra por huecos partidos vuelve a repartirse
    for (const d of elegidos) {
      const puesto = colocar(d, d.asignado, 'estudio', demanda, lugar, config, bloques, d.todos);
      pendiente += d.asignado - puesto;
    }
    // 5) Si todavía falta, usar lo que quede en cualquier día útil (del más cercano a la fecha hacia atrás)
    for (const d of [...conCupo].reverse()) {
      if (pendiente <= 0) break;
      const usado = minutosDelDia(bloques, d.dia, ctx.zona, 'estudio');
      const libre = Math.min(d.cupo - usado, pendiente);
      if (libre >= config.bloqueMinimoMin) {
        pendiente -= colocar(d, libre - (libre % config.pasoMin), 'estudio', demanda, lugar, config, bloques, d.todos);
      }
    }
  }
  // 6) Estudio profundo que no cupo fuera de los momentos de poca energía: va ahí, antes que quedarse sin plan
  if (pendiente > 0 && evitar.length) {
    for (const d of [...dias].reverse()) {
      if (pendiente <= 0) break;
      const usado = minutosDelDia(bloques, d.dia, ctx.zona);
      const libre = Math.min(d.tope - usado, pendiente);
      if (libre < config.bloqueMinimoMin) continue;
      const resto = { huecos: d.todos };
      pendiente -= colocar(resto, libre - (libre % config.pasoMin), 'estudio', demanda, lugar, config, bloques);
    }
  }

  bloques.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const planificados = bloques.reduce((s, b) => s + b.minutos, 0);
  const faltan = Math.max(0, necesariosExactos - planificados);
  return {
    bloques: unirSeguidos(bloques),
    minutosNecesarios: necesariosExactos,
    minutosPlanificados: planificados,
    faltanMin: faltan,
    libresAntesMin,
    diasUsados: new Set(bloques.map((b) => claveDe(b.inicio, ctx.zona))).size,
    limite: limite.toISOString(),
    aviso: faltan > 0 ? avisoFalta(planificados, necesariosExactos, tarea, ctx.zona) : null,
  };
}

/**
 * Un lugar para UN bloque de `minutos` (sin partirlo), del primer día al último: lo usa "¿Cómo estás hoy?"
 * para mover un bloque de hoy a otro día ("cansado") o traer uno a hoy ("con energía").
 * Respeta el tope de estudio por día y, si es estudio profundo, primero evita los momentos de poca energía.
 * Si encuentra lugar, lo descuenta de `dias` y de `usadoPorDia` (para mover varios bloques seguidos).
 */
export function ubicarBloque(
  dias: HuecosDelDia[],
  minutos: number,
  demanda: Demanda,
  opciones: {
    zona: string; ahora: Date; limite: Date; energia?: Energia;
    topeDia: (d: HuecosDelDia) => number; usadoPorDia: Map<string, number>;
  },
  config: ConfigPlan = CONFIG_PLAN,
): BloquePlan | null {
  const energia = opciones.energia ?? ENERGIA_NORMAL;
  const lugar: Lugar = { energia, zona: opciones.zona, paso: config.pasoMin, minimo: Math.min(minutos, config.bloqueMinimoMin) };
  const evitar = demanda === 'profundo' ? MOMENTOS.filter((m) => energia[m] === 'baja') : [];
  for (const pasada of evitar.length ? [evitar, []] : [[]]) {
    for (const d of dias) {
      if (opciones.topeDia(d) - (opciones.usadoPorDia.get(d.dia) ?? 0) < minutos) continue;
      const recortados = d.huecos
        .map((h) => recortar(h, opciones.ahora, opciones.limite, config.pasoMin))
        .filter((h): h is Hueco => h !== null && h.minutos >= minutos);
      const huecos = pasada.length ? recortados.flatMap((h) => quitarMomentos(h, pasada, opciones.zona)) : recortados;
      const opcion = mejorLugar(huecos.filter((h) => h.minutos >= minutos), minutos, demanda, lugar);
      if (!opcion || opcion.largo < minutos) continue;
      const fin = new Date(opcion.inicio.getTime() + minutos * MIN_MS);
      const bloque = armarBloque(opcion.inicio, fin, demanda === 'repaso' ? 'repaso' : 'estudio', demanda, lugar);
      d.huecos = restar(d.huecos, [bloque], config.pasoMin);
      opciones.usadoPorDia.set(d.dia, (opciones.usadoPorDia.get(d.dia) ?? 0) + minutos);
      return bloque;
    }
  }
  return null;
}

// ───────────────────────── Ayudantes ─────────────────────────

type Lugar = { energia: Energia; zona: string; paso: number; minimo: number };

function recortar(h: Hueco, ahora: Date, limite: Date, paso: number): Hueco | null {
  const pasoMs = paso * MIN_MS;
  // La sugerencia empieza siempre en :00 o :30 (los huecos vienen en cuartos de hora)
  const ini = Math.ceil(Math.max(h.inicio.getTime(), ahora.getTime()) / pasoMs) * pasoMs;
  const fin = Math.min(h.fin.getTime(), limite.getTime());
  const minutos = Math.floor((fin - ini) / pasoMs) * paso;
  return minutos > 0 ? { inicio: new Date(ini), fin: new Date(ini + minutos * MIN_MS), minutos } : null;
}

/** Un hueco sin los tramos de esos momentos del día (puede quedar partido). */
function quitarMomentos(h: Hueco, momentos: Momento[], zona: string): Hueco[] {
  const hIni = aMinutos(hhmm(h.inicio, zona));
  let tramos: [number, number][] = [[hIni, hIni + h.minutos]];
  for (const m of momentos) {
    const [a, b] = HORARIO_MOMENTO[m].map(aMinutos);
    tramos = tramos.flatMap(([x, y]): [number, number][] => {
      if (b <= x || a >= y) return [[x, y]];
      return [[x, Math.max(x, a)], [Math.min(y, b), y]].filter(([p, q]) => q > p) as [number, number][];
    });
  }
  return tramos.map(([x, y]) => ({
    inicio: new Date(h.inicio.getTime() + (x - hIni) * MIN_MS), fin: new Date(h.inicio.getTime() + (y - hIni) * MIN_MS), minutos: y - x,
  }));
}

/** Huecos menos los bloques ya puestos. */
function restar(huecos: Hueco[], bloques: { inicio: Date; fin: Date }[], paso: number): Hueco[] {
  let salida = huecos;
  for (const b of bloques) {
    salida = salida.flatMap((h) => {
      if (b.fin <= h.inicio || b.inicio >= h.fin) return [h];
      const partes: Hueco[] = [];
      const antes = (b.inicio.getTime() - h.inicio.getTime()) / MIN_MS;
      const despues = (h.fin.getTime() - b.fin.getTime()) / MIN_MS;
      if (antes >= paso) partes.push({ inicio: h.inicio, fin: b.inicio, minutos: antes });
      if (despues >= paso) partes.push({ inicio: b.fin, fin: h.fin, minutos: despues });
      return partes;
    });
  }
  return salida;
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

const minutosDelDia = (bloques: BloquePlan[], dia: string, zona: string, tipo?: BloquePlan['tipo']) =>
  bloques.filter((b) => (!tipo || b.tipo === tipo) && claveDe(b.inicio, zona) === dia).reduce((s, b) => s + b.minutos, 0);

/** Hora "HH:mm" de un instante en la zona. */
function hhmm(f: Date, zona: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
}

/** El momento de un bloque es el de su mitad (un bloque de 18:00 a 20:00 es de la noche si la mayor parte cae ahí). */
function momentoDelBloque(inicio: Date, minutos: number, zona: string): Momento {
  return momentoDeMinuto(aMinutos(hhmm(inicio, zona)) + Math.floor(minutos / 2));
}

function armarBloque(inicio: Date, fin: Date, tipo: BloquePlan['tipo'], demanda: Demanda, lugar: Lugar): BloquePlan {
  const minutos = Math.round((fin.getTime() - inicio.getTime()) / MIN_MS);
  const momento = momentoDelBloque(inicio, minutos, lugar.zona);
  const nivel = lugar.energia[momento];
  const razon =
    demanda === 'repaso' ? (momento === 'noche' ? 'Repaso al final del día' : null)
      : nivel === 'alta' ? 'Tu mejor momento'
        : nivel === 'baja' && demanda === 'profundo' ? 'Único hueco libre antes de la fecha'
          : null;
  return { inicio, fin, minutos, tipo, demanda, momento, razon };
}

/**
 * Coloca `minutos` de estudio en los huecos del día, de una sola vez si cabe, en el mejor momento para su demanda.
 * Los huecos usados se descuentan (también de `espejo`, la lista completa del día). Devuelve los minutos que pudo colocar.
 */
function colocar(
  d: { huecos: Hueco[] }, minutos: number, tipo: BloquePlan['tipo'], demanda: Demanda, lugar: Lugar,
  config: ConfigPlan, salida: BloquePlan[], espejo?: Hueco[],
): number {
  const minimo = config.bloqueMinimoMin;
  let resto = minutos;
  while (resto >= minimo) {
    const opcion = mejorLugar(d.huecos, resto, demanda, lugar);
    if (!opcion) break;
    const { inicio } = opcion;
    let largo = opcion.largo;
    // Si sobraría menos de 1 h para otro bloque, se deja 1 h entera para el siguiente (o no se parte)
    const queda = resto - largo;
    if (queda > 0 && queda < minimo) {
      largo = resto - minimo;
      if (largo < minimo) break;
    }
    const fin = new Date(inicio.getTime() + largo * MIN_MS);
    salida.push(armarBloque(inicio, fin, tipo, demanda, lugar));
    resto -= largo;
    d.huecos = restar(d.huecos, [{ inicio, fin }], config.pasoMin);
    if (espejo && espejo !== d.huecos) espejo.splice(0, espejo.length, ...restar(espejo, [{ inicio, fin }], config.pasoMin));
  }
  return minutos - resto;
}

/**
 * El mejor lugar: un hueco donde quepa todo (si no, el más grande), en el momento que mejor le va a su demanda.
 * Estudio: empieza al inicio del momento. Repaso: termina al final del momento (lo más tarde posible).
 */
function mejorLugar(huecos: Hueco[], minutos: number, demanda: Demanda, lugar: Lugar) {
  const { paso, minimo, zona, energia } = lugar;
  let mejor: { hueco: Hueco; inicio: Date; largo: number; puntaje: number } | null = null;
  for (const h of huecos) {
    const largo = Math.min(minutos, Math.floor(h.minutos / paso) * paso);
    if (largo < minimo) continue;
    const hIni = aMinutos(hhmm(h.inicio, zona));
    const hFin = hIni + h.minutos;
    for (const m of MOMENTOS) {
      const [mi, mf] = HORARIO_MOMENTO[m].map(aMinutos);
      if (Math.max(hIni, mi) >= Math.min(hFin, mf)) continue; // el hueco no toca este momento
      const inicioMin = demanda === 'repaso'
        ? Math.max(hIni, Math.min(hFin, mf) - largo)
        : Math.min(Math.max(hIni, mi), hFin - largo);
      const real = momentoDeMinuto(inicioMin + Math.floor(largo / 2));
      const orden = demanda === 'repaso' ? (1440 - inicioMin) / 1440 : DESEMPATE[real] * 10 + inicioMin / 1440;
      // Primero: que entre completo; luego el momento que mejor le va; luego el orden de siempre
      const puntaje = (largo === minutos ? 0 : 1000 - largo) + costoMomento(demanda, energia, real) * 100 + orden;
      if (!mejor || puntaje < mejor.puntaje) {
        mejor = { hueco: h, inicio: new Date(h.inicio.getTime() + (inicioMin - hIni) * MIN_MS), largo, puntaje };
      }
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
