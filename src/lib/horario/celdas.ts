/**
 * Horario leído de una imagen (foto, captura o PDF).
 *
 * La IA solo copia las CELDAS de la grilla tal como están (una por fila ocupada).
 * Este código decide: une bloques seguidos de la misma materia, agrupa días con el mismo
 * horario y revisa que lo leído sea coherente. Nada de esto depende de que la IA "razone".
 */
import { normalizarCodigo, normalizarNombre } from '@/lib/borrador/enriquecer';

/** Una celda ocupada de la grilla. */
export type CeldaHorario = {
  dia: number;            // 1 = lunes … 7 = domingo
  inicio: string;         // "HH:mm"
  fin: string;            // "HH:mm"
  codigo: string | null;  // "SIS-233"
  materia: string | null; // nombre si la celda lo trae
  aula: string | null;
  paralelo: string | null;
};

/** Fila de la tabla de materias inscritas (si el documento la trae). */
export type MateriaLeida = { codigo: string | null; nombre: string; paralelo: string | null; docente: string | null };

/** Clase final: una por materia + horario, con los días en que se repite. */
export type ClaseLeida = {
  codigo: string | null;
  nombre: string;          // nombre formal (de la tabla de materias si existe)
  nombreConocido: boolean; // false = solo se vio la sigla: el nombre hay que preguntarlo
  aula: string | null;
  paralelo: string | null;
  docente: string | null;
  diasSemana: number[];
  hora: string;
  horaFin: string;
  celdas: number;          // cuántas celdas de la grilla la forman (para mostrar de dónde salió)
  dudosa: boolean;         // cambió entre la primera y la segunda lectura
};

export const CONFIG_CELDAS = {
  /** Recreo máximo entre dos bloques para que sigan siendo la misma clase (14:15–15:45 + 16:00–16:45). */
  huecoMaxMin: 15,
  /** Rango razonable de una clase. Fuera de esto, se avisa. */
  horaMinima: '06:00',
  horaMaxima: '23:00',
};

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const aMin = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const aHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Identifica la materia de una celda: por código si hay, si no por nombre. */
const claveMateria = (c: { codigo: string | null; materia: string | null }) =>
  c.codigo ? `c:${normalizarCodigo(c.codigo)}` : c.materia ? `n:${normalizarNombre(c.materia)}` : null;
const claveAula = (a: string | null) => (a ? a.toLowerCase().replace(/\s+/g, '') : '');

/** Clave estable de una celda para comparar dos lecturas: día + hora + materia. */
export const claveCelda = (c: CeldaHorario) => `${c.dia}|${c.inicio}|${c.fin}|${claveMateria(c) ?? '?'}`;

/** "ANALISIS DE ALGORITMOS" → "Analisis de Algoritmos" (respaldo si la IA no dio el nombre formal). */
export function nombreFormal(nombre: string): string {
  if (nombre !== nombre.toUpperCase()) return nombre.trim();
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'al', 'para', 'por', 'con']);
  return nombre
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => {
      if (/^(i{1,3}|iv|v|vi{0,3}|ix|x)$/.test(p)) return p.toUpperCase(); // Redes II
      if (i > 0 && menores.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}

/**
 * 1) Une bloques seguidos de la misma materia, el mismo día y en la misma aula.
 *    09:00–09:45 + 09:45–10:30 → 09:00–10:30.  14:15–15:45 + (recreo) 16:00–16:45 → 14:15–16:45.
 */
export function unirCeldas(celdas: CeldaHorario[]) {
  const grupos = new Map<string, CeldaHorario[]>();
  for (const c of celdas) {
    const m = claveMateria(c);
    if (!m) continue;
    const k = `${c.dia}|${m}|${claveAula(c.aula)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }

  const bloques: (CeldaHorario & { celdas: CeldaHorario[] })[] = [];
  for (const lista of grupos.values()) {
    lista.sort((a, b) => aMin(a.inicio) - aMin(b.inicio));
    let actual = { ...lista[0], celdas: [lista[0]] };
    for (const c of lista.slice(1)) {
      const hueco = aMin(c.inicio) - aMin(actual.fin);
      if (hueco <= CONFIG_CELDAS.huecoMaxMin) {
        // Seguido, con recreo corto o repetido (la IA copió la misma celda dos veces)
        actual.fin = aHora(Math.max(aMin(actual.fin), aMin(c.fin)));
        actual.celdas.push(c);
      } else {
        bloques.push(actual);
        actual = { ...c, celdas: [c] };
      }
    }
    bloques.push(actual);
  }
  return bloques;
}

/**
 * 2) Agrupa los días que tienen la misma materia, el mismo horario y la misma aula:
 *    Lun 09:00–10:30 y Mié 09:00–10:30 → una clase con diasSemana [1, 3].
 */
export function agruparClases(
  celdas: CeldaHorario[],
  materias: MateriaLeida[],
  dudosas: Set<string> = new Set(),
): ClaseLeida[] {
  const porCodigo = new Map(materias.filter((m) => m.codigo).map((m) => [normalizarCodigo(m.codigo!), m]));
  const grupos = new Map<string, ClaseLeida>();

  for (const b of unirCeldas(celdas)) {
    const tabla = b.codigo ? porCodigo.get(normalizarCodigo(b.codigo)) : undefined;
    const nombreLeido = tabla?.nombre ?? b.materia;
    const nombre = nombreLeido ? nombreFormal(nombreLeido) : b.codigo ?? 'Clase'; // la sigla se deja tal cual
    const k = `${claveMateria(b)}|${claveAula(b.aula)}|${b.inicio}|${b.fin}`;
    const dudosa = b.celdas.some((c) => dudosas.has(claveCelda(c)));
    const existente = grupos.get(k);
    if (existente) {
      existente.diasSemana = [...new Set([...existente.diasSemana, b.dia])].sort();
      existente.celdas += b.celdas.length;
      existente.dudosa ||= dudosa;
    } else {
      grupos.set(k, {
        codigo: b.codigo,
        nombre,
        nombreConocido: !!nombreLeido,
        aula: b.aula,
        paralelo: b.paralelo ?? tabla?.paralelo ?? null,
        docente: tabla?.docente ?? null,
        diasSemana: [b.dia],
        hora: b.inicio,
        horaFin: b.fin,
        celdas: b.celdas.length,
        dudosa,
      });
    }
  }

  // Orden de lectura: por el primer día y la hora
  return [...grupos.values()].sort(
    (a, b) => a.diasSemana[0] - b.diasSemana[0] || aMin(a.hora) - aMin(b.hora),
  );
}

/**
 * 3) Revisión del sistema: lo que no cuadra se avisa (no se descarta en silencio).
 *    - Una sigla de la grilla que no está en la tabla de materias (posible mala lectura).
 *    - Una materia inscrita sin ninguna clase en la grilla (¿faltó leer una celda?).
 *    - Dos materias distintas a la misma hora el mismo día (¿una celda en la columna equivocada?).
 *    - Horas fuera de lo normal.
 */
export function revisarHorario(clases: ClaseLeida[], materias: MateriaLeida[]): string[] {
  const avisos: string[] = [];
  const codigosTabla = new Set(materias.filter((m) => m.codigo).map((m) => normalizarCodigo(m.codigo!)));

  if (codigosTabla.size > 0) {
    for (const c of clases) {
      if (c.codigo && !codigosTabla.has(normalizarCodigo(c.codigo))) {
        avisos.push(`La sigla ${c.codigo} aparece en la grilla pero no en la lista de materias. Revisa si se leyó bien.`);
      }
    }
    const codigosGrilla = new Set(clases.filter((c) => c.codigo).map((c) => normalizarCodigo(c.codigo!)));
    for (const m of materias) {
      if (m.codigo && !codigosGrilla.has(normalizarCodigo(m.codigo))) {
        avisos.push(`No encontré clases de ${nombreFormal(m.nombre)} (${m.codigo}) en la grilla.`);
      }
    }
  }

  // Choques entre clases leídas
  for (let i = 0; i < clases.length; i++) {
    for (let j = i + 1; j < clases.length; j++) {
      const a = clases[i], b = clases[j];
      const dias = a.diasSemana.filter((d) => b.diasSemana.includes(d));
      const seCruzan = aMin(a.hora) < aMin(b.horaFin) && aMin(b.hora) < aMin(a.horaFin);
      if (dias.length && seCruzan) {
        avisos.push(
          `${a.nombre} y ${b.nombre} se cruzan el ${dias.map((d) => DIAS[d - 1]).join(' y ')}. Revisa la columna de esas celdas.`,
        );
      }
    }
  }

  for (const c of clases) {
    if (c.hora < CONFIG_CELDAS.horaMinima || c.horaFin > CONFIG_CELDAS.horaMaxima) {
      avisos.push(`${c.nombre}: el horario ${c.hora}–${c.horaFin} es poco común. Revisa la hora.`);
    }
  }
  return avisos;
}

/** Una casilla de la grilla: día + hora de inicio. */
export const claveCasilla = (c: { dia: number; inicio: string }) => `${c.dia}|${c.inicio}`;
const mismaMateria = (a: CeldaHorario, b: CeldaHorario) => claveMateria(a) === claveMateria(b);

export type Conflicto = { dia: number; inicio: string; fin: string; a: CeldaHorario | null; b: CeldaHorario | null };

/**
 * Compara dos lecturas INDEPENDIENTES de la misma grilla, casilla por casilla.
 * Donde coinciden (misma materia en la misma casilla, o las dos vacías) es confiable.
 * Donde no, es un conflicto que se resuelve aparte.
 */
export function compararPorCasilla(a: CeldaHorario[], b: CeldaHorario[]) {
  const mapaA = new Map(a.map((c) => [claveCasilla(c), c]));
  const mapaB = new Map(b.map((c) => [claveCasilla(c), c]));
  const acuerdo: CeldaHorario[] = [];
  const conflictos: Conflicto[] = [];
  for (const k of new Set([...mapaA.keys(), ...mapaB.keys()])) {
    const x = mapaA.get(k) ?? null, y = mapaB.get(k) ?? null;
    if (x && y && mismaMateria(x, y)) {
      acuerdo.push({ ...x, aula: x.aula ?? y.aula, paralelo: x.paralelo ?? y.paralelo });
    } else {
      const ref = (x ?? y)!;
      conflictos.push({ dia: ref.dia, inicio: ref.inicio, fin: ref.fin, a: x, b: y });
    }
  }
  return { acuerdo, conflictos };
}

export const describirCelda = (c: CeldaHorario | null) => (c ? c.codigo ?? c.materia ?? '?' : 'vacía');
export const DIA_CORTO = (d: number) => DIAS_CORTOS[d - 1] ?? '?';

/** "Lun y Mié 09:00–10:30" */
export const describirClase = (c: ClaseLeida) =>
  `${c.diasSemana.map((d) => DIAS_CORTOS[d - 1]).join(', ')} ${c.hora}–${c.horaFin}`;
