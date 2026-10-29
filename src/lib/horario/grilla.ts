/**
 * Convierte la grilla que copió la IA (texto tal cual de cada casilla) en celdas con día y hora.
 *
 * Por qué la IA copia la grilla COMPLETA, con casillas vacías incluidas: en una foto chueca o en
 * perspectiva, el error típico es correr una celda a la columna de al lado. Si la IA tiene que escribir
 * cada casilla en orden (también las vacías), la posición en la lista fija el día. Y separar sigla,
 * paralelo y aula lo hace este código, no la IA.
 */
import type { CeldaHorario } from './celdas';

export type GrillaLeida = { dias: string[]; filas: { horario: string; celdas: string[] }[] };
export type ColumnaLeida = { dia: string; ocupadas: { horario: string; texto: string }[] };

const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** "MIÉRCOLES", "Mie", "MI", "X" → 3 */
export function diaDesdeEncabezado(t: string): number | null {
  const s = sinTildes(t).replace(/[^a-z]/g, '');
  const tabla: [RegExp, number][] = [
    [/^(lunes|lun|lu|l)$/, 1], [/^(martes|mar|ma)$/, 2], [/^(miercoles|mie|mi|x)$/, 3],
    [/^(jueves|jue|ju|j)$/, 4], [/^(viernes|vie|vi|v)$/, 5], [/^(sabado|sab|sa|s)$/, 6], [/^(domingo|dom|do|d)$/, 7],
  ];
  return tabla.find(([r]) => r.test(s))?.[1] ?? null;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** "07:15 - 08:00", "7:15-8:00", "07.15 a 08.00", "7h15" → { inicio: "07:15", fin: "08:00" } */
export function horasDeFila(t: string): { inicio: string; fin: string | null } | null {
  const horas = [...t.matchAll(/(\d{1,2})\s*[:.h]\s*(\d{2})/g)]
    .map((m) => ({ h: +m[1], m: +m[2] }))
    .filter((x) => x.h <= 23 && x.m <= 59)
    .map((x) => `${dosDigitos(x.h)}:${dosDigitos(x.m)}`);
  if (horas.length === 0) return null;
  return { inicio: horas[0], fin: horas[1] && horas[1] > horas[0] ? horas[1] : null };
}

const VACIA = /^(-+|—|vac[ií]a|libre|x|\.|n\/a)?$/i;

/** "SIS-233 [1] Aula: LRED/A1-3" → { codigo: "SIS-233", paralelo: "1", aula: "LRED/A1-3", materia: null } */
export function leerCasilla(texto: string): Omit<CeldaHorario, 'dia' | 'inicio' | 'fin'> | null {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (VACIA.test(t)) return null;

  let resto = t;
  // Aula: lo que sigue a "Aula", "Amb." o "Ambiente"
  let aula: string | null = null;
  const mAula = /\b(?:aula\b|amb\.|ambiente\b)\s*:?\s*(.+)$/i.exec(resto);
  if (mAula) {
    aula = mAula[1].trim() || null;
    resto = resto.slice(0, mAula.index).trim();
  }
  // Paralelo: "[1]", "(2)", "P1", "Par. 2", "Paralelo 2"
  let paralelo: string | null = null;
  const mPar = /\[(\w{1,3})\]|\((\d{1,2})\)|\bP(?:ar(?:alelo)?)?\.?\s?(\d{1,2})\b/i.exec(resto);
  if (mPar) {
    paralelo = mPar[1] ?? mPar[2] ?? mPar[3];
    resto = (resto.slice(0, mPar.index) + resto.slice(mPar.index + mPar[0].length)).trim();
  }
  // Sigla: letras + números ("SIS-233", "MAT 361", "INF110")
  let codigo: string | null = null;
  const mCod = /\b([A-ZÁÉÍÓÚÑ]{2,5})\s?-?\s?(\d{2,4}[A-Z]?)\b/.exec(resto);
  if (mCod) {
    codigo = `${mCod[1]}-${mCod[2]}`;
    resto = (resto.slice(0, mCod.index) + resto.slice(mCod.index + mCod[0].length)).trim();
  }
  const materia = resto.replace(/^[-–·:,\s]+|[-–·:,\s]+$/g, '') || null;
  if (!codigo && !materia) return null;
  return { codigo, materia: materia && materia.length > 1 ? materia : null, aula, paralelo };
}

/**
 * Si una fila solo dice la hora de inicio, termina cuando empieza la siguiente fila (o 45 min después).
 * @param sonContiguas true si `filas` son TODAS las filas de la grilla (no solo las ocupadas)
 */
function completarFines(filas: { inicio: string; fin: string | null }[], sonContiguas = true) {
  return filas.map((f, i) => {
    if (f.fin) return f as { inicio: string; fin: string };
    const siguiente = sonContiguas ? filas[i + 1]?.inicio : undefined;
    if (siguiente && siguiente > f.inicio) return { inicio: f.inicio, fin: siguiente };
    const [h, m] = f.inicio.split(':').map(Number);
    const fin = Math.min(h * 60 + m + 45, 23 * 60 + 59);
    return { inicio: f.inicio, fin: `${dosDigitos(Math.floor(fin / 60))}:${dosDigitos(fin % 60)}` };
  });
}

/** Día de cada columna. Si un encabezado no se entiende, se deduce del vecino (lunes, martes, …). */
function diasDeColumnas(encabezados: string[]): number[] {
  const leidos = encabezados.map(diaDesdeEncabezado);
  const primero = leidos.findIndex((d) => d !== null);
  if (primero === -1) return encabezados.map((_, i) => i + 1); // sin encabezados: lunes en adelante
  return leidos.map((d, i) => d ?? Math.min(7, Math.max(1, leidos[primero]! + (i - primero))));
}

/** Lectura 1 (fila por fila, con casillas vacías) → celdas. */
export function grillaACeldas(g: GrillaLeida): { celdas: CeldaHorario[]; avisos: string[] } {
  const avisos: string[] = [];
  const dias = diasDeColumnas(g.dias);
  const horas = g.filas.map((f) => horasDeFila(f.horario));
  const validas = g.filas.map((f, i) => ({ f, h: horas[i] })).filter((x) => x.h !== null);
  const tiempos = completarFines(validas.map((x) => x.h!));

  const celdas: CeldaHorario[] = [];
  let filasDescuadradas = 0;
  validas.forEach(({ f }, i) => {
    if (f.celdas.length !== dias.length) filasDescuadradas++;
    f.celdas.slice(0, dias.length).forEach((texto, col) => {
      const c = leerCasilla(texto);
      if (c) celdas.push({ dia: dias[col], ...tiempos[i], ...c });
    });
  });
  if (filasDescuadradas > 0) {
    avisos.push(`En ${filasDescuadradas} fila(s) la cantidad de casillas no coincide con los días. Revisa esas clases.`);
  }
  return { celdas, avisos };
}

/** Lectura 2 (columna por columna, independiente) → celdas. */
export function columnasACeldas(cols: ColumnaLeida[]): CeldaHorario[] {
  const dias = diasDeColumnas(cols.map((c) => c.dia));
  const celdas: CeldaHorario[] = [];
  cols.forEach((col, i) => {
    const filas = col.ocupadas
      .map((o) => ({ o, h: horasDeFila(o.horario) }))
      .filter((x) => x.h !== null)
      .sort((a, b) => a.h!.inicio.localeCompare(b.h!.inicio));
    const tiempos = completarFines(filas.map((x) => x.h!), false);
    filas.forEach(({ o }, j) => {
      const c = leerCasilla(o.texto);
      if (c) celdas.push({ dia: dias[i], ...tiempos[j], ...c });
    });
  });
  return celdas;
}
