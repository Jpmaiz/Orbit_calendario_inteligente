/**
 * Enriquecer el borrador (Fase 2): cruza lo que leyó la IA con los datos del usuario.
 * Todo es código determinista: la IA no decide nada de lo que pasa aquí.
 */
import { tokens } from '@/lib/texto';

// ───────────────────────── Tipos de datos del usuario ─────────────────────────

export type MateriaUsuario = { id: string; nombre: string; codigo: string | null };
export type AliasUsuario = { alias: string; materiaId: string };
export type ClaseFija = {
  id: string; titulo: string; materiaId: string | null;
  diaSemana: number; horaInicio: string; horaFin: string;
  vigenteDesde: Date | null; vigenteHasta: Date | null;
};
export type EventoPuntual = { id: string; titulo: string; inicio: Date; fin: Date | null };
export type Periodo = { nombre: string; inicio: Date; fin: Date };

// ───────────────────────── 1. Materia propuesta ─────────────────────────

export type PropuestaMateria =
  | { accion: 'vincular'; materiaId: string; nombre: string; seguro: boolean; alternativas: { id: string; nombre: string }[] }
  | { accion: 'crear'; nombre: string; codigo: string | null; clave: string } // clave: para crear UNA sola vez
  | { accion: 'preguntar_nombre'; codigo: string }                            // solo hay código: hay que preguntar
  | { accion: 'ninguna' };

/** "SIS-311", "sis 311" y "SIS311" → "sis311" */
export const normalizarCodigo = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');
/** "Redes II" → "redes 2" (misma normalización que duplicados) */
export const normalizarNombre = (n: string) => tokens(n).join(' ');

export function proponerMateria(
  nombre: string | null,
  codigo: string | null,
  materias: MateriaUsuario[],
  alias: AliasUsuario[],
): PropuestaMateria {
  const vincular = (m: MateriaUsuario, seguro = true, alternativas: MateriaUsuario[] = []): PropuestaMateria => ({
    accion: 'vincular', materiaId: m.id, nombre: m.nombre, seguro,
    alternativas: alternativas.map(({ id, nombre }) => ({ id, nombre })),
  });

  // a) Código exacto
  if (codigo) {
    const c = normalizarCodigo(codigo);
    const m = materias.find((x) => x.codigo && normalizarCodigo(x.codigo) === c);
    if (m) return vincular(m);
  }

  if (nombre) {
    const n = normalizarNombre(nombre);
    // b) Alias aprendido (el usuario corrigió antes: "bd" → Base de Datos II)
    const a = alias.find((x) => x.alias === n);
    const porAlias = a && materias.find((m) => m.id === a.materiaId);
    if (porAlias) return vincular(porAlias);

    // c) Nombre por palabras: todas las palabras dichas están en el nombre de la materia
    const dichas = tokens(nombre);
    const candidatas = materias
      .map((m) => {
        const t = tokens(m.nombre);
        const contiene = dichas.length > 0 && dichas.every((p) => t.includes(p));
        return { m, puntaje: contiene ? dichas.length / t.length : 0 }; // 1 = mismo nombre
      })
      .filter((c) => c.puntaje > 0)
      .sort((x, y) => y.puntaje - x.puntaje);

    if (candidatas.length > 0) {
      const [mejor, segunda] = candidatas;
      // Seguro solo si hay una candidata, o si el nombre coincide exacto y ninguna otra lo hace
      const seguro = !segunda || (mejor.puntaje === 1 && segunda.puntaje < 1);
      return vincular(mejor.m, seguro, candidatas.slice(1).map((c) => c.m));
    }
    // d) No existe: proponer crearla (un toque)
    return { accion: 'crear', nombre: nombre.trim(), codigo, clave: n };
  }

  // e) Solo código y no existe: el nombre no se puede inventar
  if (codigo) return { accion: 'preguntar_nombre', codigo };
  return { accion: 'ninguna' };
}

// ───────────────────────── Utilidades de hora ─────────────────────────

/** Día de la semana (1 = lunes) y hora "HH:mm" de un instante, en la zona del usuario. */
export function partesEnZona(fecha: Date, zona: string): { diaSemana: number; hhmm: string } {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    diaSemana: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(v('weekday')) + 1,
    hhmm: `${v('hour')}:${v('minute')}`,
  };
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const seCruzan = (a1: string, a2: string, b1: string, b2: string) =>
  minutos(a1) < minutos(b2) && minutos(b1) < minutos(a2);
const vigenteEn = (c: ClaseFija, fecha: Date) =>
  (!c.vigenteDesde || c.vigenteDesde <= fecha) && (!c.vigenteHasta || c.vigenteHasta >= fecha);

// ───────────────────────── 2. Hora del examen desde el horario ─────────────────────────

export type HoraPropuesta = { inicio: string; fin: string; motivo: string } | null;

/**
 * Examen o exposición sin hora: si ese día hay clase de la misma materia, se propone ese horario.
 * Busca en las clases guardadas y en las clases que vienen en el mismo texto.
 */
export function proponerHoraDesdeHorario(
  fecha: Date,
  zona: string,
  materia: PropuestaMateria,
  clasesGuardadas: ClaseFija[],
  clasesDelTexto: { materiaClave: string | null; diasSemana: number[]; hora: string | null; horaFin: string | null; titulo: string }[],
  materiaClaveDelItem: string | null,
): HoraPropuesta {
  const { diaSemana } = partesEnZona(fecha, zona);

  if (materia.accion === 'vincular') {
    const clase = clasesGuardadas
      .filter((c) => c.materiaId === materia.materiaId && c.diaSemana === diaSemana && vigenteEn(c, fecha))
      .sort((a, b) => minutos(a.horaInicio) - minutos(b.horaInicio))[0];
    if (clase) return { inicio: clase.horaInicio, fin: clase.horaFin, motivo: `Ese día tienes ${clase.titulo}` };
  }

  if (materiaClaveDelItem) {
    const delTexto = clasesDelTexto.find(
      (c) => c.materiaClave === materiaClaveDelItem && c.diasSemana.includes(diaSemana) && c.hora && c.horaFin,
    );
    if (delTexto) return { inicio: delTexto.hora!, fin: delTexto.horaFin!, motivo: `Ese día tienes ${delTexto.titulo}` };
  }
  return null;
}

// ───────────────────────── 3. Choques de horario ─────────────────────────

export type Choque = { titulo: string; cuando: string };
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** Evento de una vez (inicio–fin) contra clases fijas vigentes ese día y otros eventos. */
export function choquesDeEvento(
  inicio: Date, fin: Date | null, zona: string, clases: ClaseFija[], eventos: EventoPuntual[],
): Choque[] {
  const finReal = fin ?? new Date(inicio.getTime() + 60 * 60_000); // sin fin: se asume 1 h
  const a = partesEnZona(inicio, zona), b = partesEnZona(finReal, zona);
  const choques: Choque[] = [];

  for (const c of clases) {
    if (c.diaSemana === a.diaSemana && vigenteEn(c, inicio) && seCruzan(a.hhmm, b.hhmm, c.horaInicio, c.horaFin)) {
      choques.push({ titulo: c.titulo, cuando: `${DIAS[c.diaSemana - 1]} ${c.horaInicio}–${c.horaFin}` });
    }
  }
  for (const e of eventos) {
    const eFin = e.fin ?? new Date(e.inicio.getTime() + 60 * 60_000);
    if (inicio < eFin && e.inicio < finReal) {
      const p = partesEnZona(e.inicio, zona);
      choques.push({ titulo: e.titulo, cuando: `${DIAS[p.diaSemana - 1]} ${p.hhmm}` });
    }
  }
  return choques;
}

/** ¿Esta clase guardada es la misma que la nueva? (mismo día y horario, y misma materia o mismo nombre) */
export function esMismaClase(
  c: ClaseFija, dia: number, hora: string, horaFin: string, titulo: string, materiaId: string | null,
): boolean {
  if (c.diaSemana !== dia || c.horaInicio !== hora || c.horaFin !== horaFin) return false;
  return (materiaId !== null && c.materiaId === materiaId) || normalizarNombre(c.titulo) === normalizarNombre(titulo);
}

/**
 * Clase fija nueva contra clases guardadas vigentes.
 * - "existentes": días donde ESA clase ya está guardada (no es choque, es duplicado).
 * - "choques": otra clase que se cruza en horario.
 */
export function revisarClase(
  diasSemana: number[], hora: string, horaFin: string, titulo: string, materiaId: string | null,
  clases: ClaseFija[], hoy: Date,
): { existentes: number[]; choques: Choque[] } {
  const vigentes = clases.filter((c) => !c.vigenteHasta || c.vigenteHasta >= hoy);
  const existentes = diasSemana.filter((d) => vigentes.some((c) => esMismaClase(c, d, hora, horaFin, titulo, materiaId)));
  const choques = vigentes
    .filter((c) => diasSemana.includes(c.diaSemana) && !existentes.includes(c.diaSemana)
      && seCruzan(hora, horaFin, c.horaInicio, c.horaFin))
    .map((c) => ({ titulo: c.titulo, cuando: `${DIAS[c.diaSemana - 1]} ${c.horaInicio}–${c.horaFin}` }));
  return { existentes, choques };
}

export const nombreDia = (d: number) => DIAS[d - 1] ?? '';