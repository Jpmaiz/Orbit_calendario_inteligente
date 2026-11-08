/**
 * Estimación de horas, dificultad e importancia de una actividad (Fase 1).
 *
 * La IA percibe: califica la actividad con una rúbrica (escala, temas, cantidades, nivel cognitivo,
 * componentes, formato, claridad, peso académico) y cita la frase del texto que respalda cada factor.
 * El sistema decide: este archivo convierte esos niveles en números con reglas fijas.
 * El mismo texto da siempre el mismo resultado, y cada número se puede explicar.
 *
 * Fundamento: docs/PROMPTS.md (sección 4) y el documento "Orbit: fundamento de la estimación".
 * Las tasas son parámetros iniciales: se calibran con las horas reales que reporten los usuarios.
 */

// ───────────────────────── Lo que lee la IA ─────────────────────────

export const ESCALAS = ['control', 'parcial', 'final'] as const;
export type Escala = (typeof ESCALAS)[number];
export const AMPLITUDES = ['estrecho', 'normal', 'amplio'] as const;
export type Amplitud = (typeof AMPLITUDES)[number];
export const VOLUMENES = ['bajo', 'medio', 'alto'] as const;
export type Volumen = (typeof VOLUMENES)[number];
export const FORMATOS = ['escrito', 'oral', 'practico', 'a_mano'] as const;
export type Formato = (typeof FORMATOS)[number];
export const CLARIDADES = ['alta', 'media', 'baja'] as const;
export type Claridad = (typeof CLARIDADES)[number];

export type TemaLeido = { nombre: string; amplitud: Amplitud };

export type Cantidades = {
  paginasLeer: number | null;
  paginasEscribir: number | null;
  ejercicios: number | null;
  diapositivas: number | null;
  minutosExposicion: number | null;
};

export type LecturaEstimacion = {
  escala: Escala | null;          // solo exámenes: control (quiz, oral de práctica), parcial o final
  temas: TemaLeido[];
  cantidades: Cantidades;
  volumen: Volumen | null;        // si no hay temas ni cantidades
  nivelCognitivo: 1 | 2 | 3 | 4;  // Webb DOK: recordar · aplicar · analizar · crear
  partes: boolean;                // varias partes o entregables
  grupal: boolean;
  formato: Formato | null;
  claridad: Claridad;
  impostergable: boolean;         // "entrega impostergable", "no se recibe tarde"
};

// ───────────────────────── Parámetros (docs/PROMPTS.md §4) ─────────────────────────

type Rango = readonly [number, number];

/** Horas de preparación fuera de clase. La estimación nunca sale de su rango. */
export const RANGOS = {
  control: [1, 2],
  parcial: [4, 8],
  final: [8, 14],
  tarea: [1, 3],
  entrega: [2, 5],
  exposicion: [3, 6],
  proyecto: [10, 30],
} as const satisfies Record<string, Rango>;

/** Tasas por cantidad (inspiradas en el estimador de Rice). Columna 0: nivel 1–2; columna 1: nivel 3–4. */
export const TASAS = {
  paginasLeerPorHora: [15, 6],
  horasPorPaginaEscrita: [1, 2],
  minutosPorEjercicio: [15, 35],
  minutosPorDiapositiva: [15, 15],
  minutosPrepPorMinutoExpuesto: [6, 6],
} as const;

export const CONFIG_ESTIMACION = {
  /** Posición en el rango = temas ÷ (temas + temasCentro): con 5 temas, el centro. */
  temasCentro: 5,
  /** Un tema "amplio" (un sistema completo, una unidad entera) cuenta como tantos temas. */
  pesoTemaAmplio: 3,
  /** Sin temas ni cantidades, el volumen ubica la estimación (nunca en el máximo). */
  posicionPorVolumen: { bajo: 0.25, medio: 0.5, alto: 0.65 } as Record<Volumen, number>,
  /** Nivel cognitivo 3 o 4: la posición sube estos puntos. */
  extraNivelAlto: 0.1,
  /** Tope de la posición: sumar temas acerca al máximo, pero no lo alcanza. */
  posicionMaxima: 0.95,
  /** Ajustes por coordinación (Wood): varias partes y grupal. Tope total. */
  extraPartes: 0.1,
  extraGrupal: 0.1,
  extraMaximo: 0.2,
  /** Redondeo a media hora. */
  paso: 0.5,
};

// ───────────────────────── Resultado ─────────────────────────

export type Importancia = 'alta' | 'media' | 'baja';

export type Estimacion = {
  horas: number;               // horas netas (sin colchón: el colchón lo aplica el motor de prioridad)
  minutos: number;             // = horas × 60, para Tarea.duracionEstMin
  dificultad: number | null;   // 1–5; null si no hubo lectura de la IA
  importancia: Importancia;
  origen: 'ia' | 'general';    // general = la IA no pudo leer: centro del rango
  escala: Escala | null;
  rango: Rango;
  razones: string[];           // para "¿Por qué?"
  supuestos: string[];         // lo que el usuario debería confirmar
};

const redondear = (n: number, paso = CONFIG_ESTIMACION.paso) => Math.round(n / paso) * paso;
const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function rangoDe(tipo: string, escala: Escala | null): Rango {
  if (tipo === 'examen') return RANGOS[escala ?? 'parcial'];
  return (RANGOS as Record<string, Rango>)[tipo] ?? RANGOS.tarea;
}

/**
 * Importancia por tipo. Solo la sube "impostergable".
 * La calificación ("sobre 20 puntos") NO se toma en cuenta: no cambia horas, dificultad ni importancia.
 */
function importanciaDe(tipo: string, escala: Escala | null, lectura: LecturaEstimacion | null): Importancia {
  let base: Importancia =
    tipo === 'proyecto' || tipo === 'exposicion' || (tipo === 'examen' && escala === 'final') ? 'alta'
      : tipo === 'entrega' || (tipo === 'examen' && escala !== 'control') ? 'media'
        : 'baja';
  if (lectura?.impostergable) base = 'alta';
  return base;
}

/** Temas equivalentes: un tema amplio cuenta como varios. */
export function temasEquivalentes(temas: TemaLeido[]): number {
  return temas.reduce((s, t) => s + (t.amplitud === 'amplio' ? CONFIG_ESTIMACION.pesoTemaAmplio : 1), 0);
}

/** Horas por cantidades explícitas. null si el texto no trae ninguna. */
export function horasPorCantidades(c: Cantidades, nivel: number): number | null {
  const col = nivel >= 3 ? 1 : 0;
  const partes = [
    c.paginasLeer ? c.paginasLeer / TASAS.paginasLeerPorHora[col] : 0,
    c.paginasEscribir ? c.paginasEscribir * TASAS.horasPorPaginaEscrita[col] : 0,
    c.ejercicios ? (c.ejercicios * TASAS.minutosPorEjercicio[col]) / 60 : 0,
    c.diapositivas ? (c.diapositivas * TASAS.minutosPorDiapositiva[col]) / 60 : 0,
    c.minutosExposicion ? (c.minutosExposicion * TASAS.minutosPrepPorMinutoExpuesto[col]) / 60 : 0,
  ];
  const total = partes.reduce((s, x) => s + x, 0);
  return total > 0 ? total : null;
}

/**
 * Calcula la estimación de una tarea.
 * @param tipo examen | tarea | entrega | proyecto | exposicion (el que quedó en el borrador)
 * @param lectura lo que calificó la IA; null = la IA no pudo leer → estimación general
 */
export function estimar(tipo: string, lectura: LecturaEstimacion | null): Estimacion {
  const cfg = CONFIG_ESTIMACION;
  const escala = tipo === 'examen' ? lectura?.escala ?? null : null;
  const rango = rangoDe(tipo, escala);
  const [min, max] = rango;
  const razones: string[] = [];
  const supuestos: string[] = [];
  const nombreTipo = tipo === 'examen' ? `examen ${escala ?? 'parcial'}` : tipo === 'exposicion' ? 'exposición o defensa' : tipo;
  razones.push(`Es ${tipo === 'examen' || tipo === 'proyecto' ? 'un' : 'una'} ${nombreTipo} (${min}–${max} h)`);
  if (tipo === 'examen' && !escala) supuestos.push('Supuse que es un parcial: si es un control o quiz, son menos horas');

  if (!lectura) {
    const horas = redondear((min + max) / 2);
    return {
      horas, minutos: Math.round(horas * 60), dificultad: null, importancia: importanciaDe(tipo, escala, null),
      origen: 'general', escala, rango, razones: [...razones, 'Estimación general: centro del rango'], supuestos,
    };
  }

  const nivelAlto = lectura.nivelCognitivo >= 3;
  let horasBase: number;

  const porCantidades = horasPorCantidades(lectura.cantidades, lectura.nivelCognitivo);
  if (porCantidades !== null) {
    horasBase = porCantidades;
    const c = lectura.cantidades;
    const detalle = [
      c.paginasLeer ? plural(c.paginasLeer, 'página a leer', 'páginas a leer') : null,
      c.paginasEscribir ? plural(c.paginasEscribir, 'página a escribir', 'páginas a escribir') : null,
      c.ejercicios ? plural(c.ejercicios, 'ejercicio', 'ejercicios') : null,
      c.diapositivas ? plural(c.diapositivas, 'diapositiva', 'diapositivas') : null,
      c.minutosExposicion ? `${c.minutosExposicion} min de exposición` : null,
    ].filter(Boolean);
    razones.push(`Calculado por cantidad: ${detalle.join(', ')}`);
  } else {
    let posicion: number;
    if (lectura.temas.length > 0) {
      const eq = temasEquivalentes(lectura.temas);
      posicion = eq / (eq + cfg.temasCentro);
      const amplios = lectura.temas.filter((t) => t.amplitud === 'amplio').length;
      razones.push(`Cubre ${plural(lectura.temas.length, 'tema', 'temas')}${amplios ? ` (${amplios} amplio${amplios > 1 ? 's' : ''})` : ''}: ${lectura.temas.map((t) => t.nombre).join(', ')}`);
    } else if (lectura.volumen) {
      posicion = cfg.posicionPorVolumen[lectura.volumen];
      razones.push(`Volumen ${lectura.volumen}`);
    } else {
      posicion = 0.5;
      razones.push('No dice temas: estimación general');
    }
    if (nivelAlto) {
      posicion += cfg.extraNivelAlto;
      razones.push(lectura.nivelCognitivo === 4 ? 'Pide crear o diseñar' : 'Pide aplicar, comparar o analizar');
    }
    posicion = entre(posicion, 0, cfg.posicionMaxima);
    horasBase = min + (max - min) * posicion;
  }

  const extra = Math.min(cfg.extraMaximo, (lectura.partes ? cfg.extraPartes : 0) + (lectura.grupal ? cfg.extraGrupal : 0));
  if (lectura.partes) razones.push('Tiene varias partes');
  if (lectura.grupal) razones.push('Es grupal (coordinar toma tiempo)');

  const horas = entre(redondear(horasBase * (1 + extra)), min, max);

  // Dificultad: nivel cognitivo + 0,5 por cada factor alto (docs/PROMPTS.md §4).
  // Componentes (Wood): varias partes, grupal, muchos temas (5 o más equivalentes) o un examen final, que integra todo.
  const muchosTemas = temasEquivalentes(lectura.temas) >= cfg.temasCentro;
  const componentesAltos = lectura.partes || lectura.grupal || muchosTemas || escala === 'final';
  const ajustes =
    (componentesAltos ? 0.5 : 0) +
    (lectura.formato === 'practico' || lectura.formato === 'oral' ? 0.5 : 0) +
    (lectura.claridad === 'baja' ? 0.5 : 0);
  const dificultad = entre(Math.round(lectura.nivelCognitivo + ajustes), 1, 5);
  if (escala === 'final') razones.push('Integra los temas de todo el semestre');
  if (lectura.formato === 'oral') razones.push('Es oral');
  if (lectura.formato === 'practico') razones.push('Es práctico');
  if (lectura.claridad === 'baja') razones.push('Las instrucciones no son claras');

  const importancia = importanciaDe(tipo, escala, lectura);
  if (lectura.impostergable) razones.push('Es impostergable');

  return { horas, minutos: Math.round(horas * 60), dificultad, importancia, origen: 'ia', escala, rango, razones, supuestos };
}

/** Horas por defecto de un tipo cuando nadie estimó la tarea (centro del rango). Lo usa el motor de prioridad. */
export function horasPorDefecto(tipo: string): number {
  const [min, max] = rangoDe(tipo, null);
  return redondear((min + max) / 2);
}

// ───────────────────────── Validación de lo que devuelve la IA ─────────────────────────

const enLista = <T extends string>(lista: readonly T[], v: unknown): T | null =>
  (lista as readonly string[]).includes(v as string) ? (v as T) : null;
const numeroPositivo = (v: unknown, max: number) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(max, Math.round(n)) : null;
};
const tieneEvidencia = (ev: Record<string, unknown>, clave: string) =>
  typeof ev[clave] === 'string' && (ev[clave] as string).trim().length >= 3;

/**
 * Valida y limpia la lectura de la IA.
 * Regla de justicia: un factor "alto" sin una frase del texto que lo respalde baja a su nivel medio.
 * Así la IA no puede inflar las horas ni la dificultad por suposición.
 */
export function normalizarLecturaEstimacion(v: unknown): LecturaEstimacion | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const ev = (r.evidencia && typeof r.evidencia === 'object' ? r.evidencia : {}) as Record<string, unknown>;
  const c = (r.cantidades && typeof r.cantidades === 'object' ? r.cantidades : {}) as Record<string, unknown>;

  const temas: TemaLeido[] = [];
  const vistos = new Set<string>();
  for (const x of Array.isArray(r.temas) ? r.temas.slice(0, 30) : []) {
    const t = (typeof x === 'string' ? { nombre: x } : x ?? {}) as Record<string, unknown>;
    const nombre = typeof t.nombre === 'string' ? t.nombre.trim().slice(0, 80) : '';
    const clave = nombre.toLowerCase();
    if (!nombre || vistos.has(clave)) continue;
    vistos.add(clave);
    temas.push({ nombre, amplitud: enLista(AMPLITUDES, t.amplitud) ?? 'normal' });
  }

  let nivel = Number(r.nivelCognitivo);
  nivel = Number.isInteger(nivel) && nivel >= 1 && nivel <= 4 ? nivel : 2;
  if (nivel >= 3 && !tieneEvidencia(ev, 'nivel')) nivel = 2;

  let volumen = enLista(VOLUMENES, r.volumen);
  if (volumen === 'alto' && !tieneEvidencia(ev, 'volumen')) volumen = 'medio';

  let formato = enLista(FORMATOS, r.formato);
  if ((formato === 'practico' || formato === 'oral') && !tieneEvidencia(ev, 'formato')) formato = null;

  return {
    escala: enLista(ESCALAS, r.escala),
    temas,
    cantidades: {
      paginasLeer: numeroPositivo(c.paginasLeer, 2000),
      paginasEscribir: numeroPositivo(c.paginasEscribir, 200),
      ejercicios: numeroPositivo(c.ejercicios, 500),
      diapositivas: numeroPositivo(c.diapositivas, 300),
      minutosExposicion: numeroPositivo(c.minutosExposicion, 240),
    },
    volumen,
    nivelCognitivo: nivel as LecturaEstimacion['nivelCognitivo'],
    partes: r.partes === true && tieneEvidencia(ev, 'partes'),
    grupal: r.grupal === true && tieneEvidencia(ev, 'grupal'),
    formato,
    claridad: enLista(CLARIDADES, r.claridad) ?? 'media',
    impostergable: r.impostergable === true && tieneEvidencia(ev, 'peso'),
  };
}
