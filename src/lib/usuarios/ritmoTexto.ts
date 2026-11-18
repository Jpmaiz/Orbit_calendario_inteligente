/**
 * "Cuéntale a Orbit tu semana": el usuario escribe cómo es su semana en sus palabras y la IA la convierte en
 * "Mi ritmo" + compromisos fijos (trabajo, gimnasio, transporte). La IA solo lee; esto valida y resume.
 * Código puro (menos el prompt): scripts/probar-ritmo.ts.
 */
import { normalizarRitmo, type Franja, type Ritmo } from './ritmo';

export type Compromiso = { titulo: string; diasSemana: number[]; hora: string; horaFin: string };

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const NOMBRE_FRANJA: Record<Franja, string> = { manana: 'la mañana', tarde: 'la tarde', noche: 'la noche' };
const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function promptRitmo(texto: string): string {
  return `Un estudiante universitario cuenta cómo es su semana. Extrae SOLO lo que dice, sin inventar.
Devuelve SOLO un JSON:
{
  "ritmo": {
    "desde": "HH:mm" o null,        // desde qué hora puede estudiar ("me levanto a las 8" → "08:00")
    "hasta": "HH:mm" o null,        // hasta qué hora ("después de las 10 de la noche no rindo" → "22:00")
    "maxHorasDia": número o null,   // máximo de horas de estudio por día que dice que aguanta
    "diasLibres": [1-7] o null,     // días en que NO quiere estudiar (1 = lunes … 7 = domingo)
    "franja": "manana" | "tarde" | "noche" | null   // cuándo dice que rinde mejor
  },
  "compromisos": [ { "titulo": string, "diasSemana": [1-7], "hora": "HH:mm", "horaFin": "HH:mm" } ]
}
- "compromisos": actividades fijas que se repiten cada semana y NO son clases: trabajo, gimnasio, deporte, transporte,
  cuidar a alguien. Título corto con mayúscula inicial ("Trabajo", "Gimnasio"). Solo si dice días y horas.
- Lo que no dice, null (o [] en compromisos). No calcules nada más.

Texto del estudiante: """${texto}"""`;
}

/** Valida lo que devolvió la IA: aplica sobre el ritmo actual solo los campos válidos, y filtra compromisos. */
export function interpretarRespuesta(crudo: unknown, actual: Ritmo): { ritmo: Ritmo; cambios: (keyof Ritmo)[]; compromisos: Compromiso[] } {
  const c = (crudo ?? {}) as { ritmo?: Record<string, unknown>; compromisos?: unknown };
  let ritmo = actual;
  const cambios: (keyof Ritmo)[] = [];
  // Campo por campo: uno inválido no tira los demás
  for (const campo of ['desde', 'hasta', 'maxHorasDia', 'diasLibres', 'franja'] as const) {
    const valor = c.ritmo?.[campo];
    if (valor === null || valor === undefined) continue;
    if (campo === 'diasLibres' && Array.isArray(valor) && valor.length === 0) continue;
    const r = normalizarRitmo({ [campo]: valor }, ritmo);
    if (r.ok && JSON.stringify(r.ritmo[campo]) !== JSON.stringify(ritmo[campo])) {
      ritmo = r.ritmo;
      cambios.push(campo);
    }
  }
  const compromisos = (Array.isArray(c.compromisos) ? c.compromisos : []).flatMap((x): Compromiso[] => {
    const r = (x ?? {}) as Record<string, unknown>;
    const titulo = typeof r.titulo === 'string' ? r.titulo.trim().slice(0, 60) : '';
    const dias = Array.isArray(r.diasSemana) ? [...new Set(r.diasSemana.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : [];
    if (!titulo || !dias.length || !esHora(r.hora) || !esHora(r.horaFin) || r.horaFin <= r.hora) return [];
    return [{ titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), diasSemana: dias, hora: r.hora, horaFin: r.horaFin }];
  }).slice(0, 10);
  return { ritmo, cambios, compromisos };
}

/** Frases para mostrar antes de guardar: "Estudias de 08:00 a 21:00", "Trabajo: mar y jue, 18:00–21:00". */
export function resumirRitmo(ritmo: Ritmo, cambios: (keyof Ritmo)[], compromisos: Compromiso[]): string[] {
  const frases: string[] = [];
  if (cambios.includes('desde') || cambios.includes('hasta')) frases.push(`Estudias de ${ritmo.desde} a ${ritmo.hasta}`);
  if (cambios.includes('maxHorasDia')) frases.push(`Máximo ${String(ritmo.maxHorasDia).replace('.', ',')} h de estudio por día`);
  if (cambios.includes('diasLibres')) frases.push(`Sin estudio: ${ritmo.diasLibres.map((d) => DIAS[d - 1]).join(', ')}`);
  if (cambios.includes('franja') && ritmo.franja) frases.push(`Rindes mejor en ${NOMBRE_FRANJA[ritmo.franja]}`);
  for (const c of compromisos) {
    const dias = c.diasSemana.map((d) => CORTOS[d - 1]);
    const lista = dias.length > 1 ? `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}` : dias[0];
    frases.push(`${c.titulo}: ${lista}, ${c.hora}–${c.horaFin}`);
  }
  return frases;
}
