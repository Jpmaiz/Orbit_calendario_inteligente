/**
 * Normalización de texto compartida (duplicados, materias).

 */
const ROMANOS: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };

/** Palabras que no distinguen una tarea de otra: artículos, preposiciones y verbos genéricos. */
const VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con',
  'sobre', 'y', 'o', 'mi', 'mis', 'su', 'sus', 'que',
  'entregar', 'hacer', 'realizar', 'terminar', 'presentar', 'subir', 'enviar', 'completar',
]);

export function tokens(texto: string): string[] {
  const palabras = texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => ROMANOS[p] ?? p) // II → 2
    .filter((p) => !VACIAS.has(p));
  return [...new Set(palabras)];
}