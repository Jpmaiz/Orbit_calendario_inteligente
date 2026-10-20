/**
 * Detección de duplicados: la decide el SISTEMA, no la IA.
 * Lógica pura (sin base de datos) para poder probarla y defenderla.
 */
import { tokens } from '../texto';

export const CONFIG_DUPLICADOS = {
  /** Dos fechas límite a menos de estas horas cuentan como "la misma fecha". */
  ventanaHoras: 24,
  /** Desde esta similitud (0–1) se pregunta "¿es la misma?". 1 = mismas palabras. */
  similitudProbable: 0.5,
};

export type TareaComparable = {
  id?: string;
  titulo: string;
  tipo?: string;
  fechaLimite: Date | string;
  materiaId?: string | null;
  materiaNombre?: string | null;
};

export type ResultadoDuplicado<T> =
  | { estado: 'nuevo' }
  | { estado: 'seguro' | 'probable'; tarea: T; similitud: number };

const numeros = (ts: string[]) => ts.filter((t) => /^\d+$/.test(t)).sort().join(',');

/** Jaccard: palabras en común ÷ palabras en total. */
function similitud(a: string[], b: string[]): number {
  const sa = new Set(a), sb = new Set(b);
  const comunes = [...sa].filter((x) => sb.has(x)).length;
  const total = new Set([...sa, ...sb]).size;
  return total === 0 ? 0 : comunes / total;
}

export function compararConCandidatos<T extends TareaComparable>(
  nueva: TareaComparable,
  candidatos: T[],
  config = CONFIG_DUPLICADOS,
): ResultadoDuplicado<T> {
  const fechaNueva = new Date(nueva.fechaLimite).getTime();
  // El nombre de la materia cuenta como parte del título ("Informe" + materia Redes = "Informe de redes")
  const tNueva = tokens(`${nueva.titulo} ${nueva.materiaNombre ?? ''}`);

  let mejor: { tarea: T; similitud: number } | null = null;

  for (const c of candidatos) {
    // 1) Fechas a más de 24 h → son distintas
    const distanciaHoras = Math.abs(new Date(c.fechaLimite).getTime() - fechaNueva) / 3_600_000;
    if (distanciaHoras > config.ventanaHoras) continue;

    // 2) Materias distintas (las dos conocidas) → son distintas
    if (nueva.materiaId && c.materiaId && nueva.materiaId !== c.materiaId) continue;

    const tC = tokens(`${c.titulo} ${c.materiaNombre ?? ''}`);

    // 3) Números distintos → son distintas ("Laboratorio 3" ≠ "Laboratorio 4")
    const nA = numeros(tNueva), nB = numeros(tC);
    if (nA && nB && nA !== nB) continue;

    const s = similitud(tNueva, tC);
    if (!mejor || s > mejor.similitud) mejor = { tarea: c, similitud: s };
  }

  if (!mejor || mejor.similitud < config.similitudProbable) return { estado: 'nuevo' };
  return {
    estado: mejor.similitud === 1 ? 'seguro' : 'probable',
    tarea: mejor.tarea,
    similitud: Math.round(mejor.similitud * 100) / 100,
  };
}

/** Opciones rápidas para diferenciar dos tareas que se llaman igual. */
export const DIFERENCIAS_POR_TIPO: Record<string, string[]> = {
  examen: ['Práctico', 'Teórico'],
  exposicion: ['Grupal', 'Individual'],
  entrega: ['Avance', 'Final'],
  proyecto: ['Avance', 'Final'],
  tarea: ['Parte 1', 'Parte 2'],
};

/** Tipo → [sustantivo, artículo, género] para armar la pregunta en buen español. */
const TIPOS: Record<string, { nombre: string; un: string; masculino: boolean }> = {
  examen: { nombre: 'examen', un: 'un examen', masculino: true },
  entrega: { nombre: 'entrega', un: 'una entrega', masculino: false },
  proyecto: { nombre: 'proyecto', un: 'un proyecto', masculino: true },
  exposicion: { nombre: 'exposición', un: 'una exposición', masculino: false },
  tarea: { nombre: 'tarea', un: 'una tarea', masculino: false },
};

const VERBO_INICIAL = /^(entregar|hacer|realizar|terminar|presentar|subir|enviar|completar|estudiar para)\s+(el |la |los |las |un |una )?/i;

/** "entregar informe de base de datos" → "Informe de base de datos" */
export function nombreFormal(titulo: string): string {
  const limpio = titulo.trim().replace(VERBO_INICIAL, '');
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/**
 * "Ya tienes una entrega «Informe de base de datos» para el viernes, 23 de octubre. ¿Es la misma o es otra?"
 * "Ya tienes «Examen de Redes» para el miércoles, 28 de octubre. ¿Es el mismo o es otro?"
 */
export function preguntaDuplicado(
  existente: { titulo: string; tipo?: string; fechaLimite: Date | string },
  zonaHoraria = 'America/La_Paz',
): string {
  const t = TIPOS[existente.tipo ?? ''] ?? TIPOS.tarea;
  const nombre = nombreFormal(existente.titulo);
  // Si el nombre ya empieza con el tipo ("Examen de Redes"), no se repite ("un examen «Examen...»")
  const sinTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const yaLoDice = sinTildes(nombre).startsWith(sinTildes(t.nombre));
  const que = yaLoDice ? `«${nombre}»` : `${t.un} «${nombre}»`;
  const dia = new Date(existente.fechaLimite).toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: zonaHoraria,
  });
  const mismo = t.masculino ? '¿Es el mismo o es otro?' : '¿Es la misma o es otra?';
  return `Ya tienes ${que} para el ${dia}. ${mismo}`;
}