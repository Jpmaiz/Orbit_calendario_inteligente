/**
 * Notas de una actividad, agrupadas por categoría (tarjeta del borrador → "Detalles").
 * Salen de lo que leyó la IA (temas, preparativos, referencias, duración, detalles) y de lo que el usuario
 * agrega con "Añade algo más" (POST /api/ia/notas las reparte). Se guardan en Tarea.notas y Evento.notas.
 */
import type { ItemExtraido } from '@/lib/ia/extraccion';

export const CATEGORIAS_NOTA = ['llevar', 'temas', 'bibliografia', 'duracion', 'otros'] as const;
export type CategoriaNota = (typeof CATEGORIAS_NOTA)[number];
export type Nota = { categoria: CategoriaNota; texto: string };

export const MAX_NOTAS = 30;
const MAX_TEXTO = 200;

const limpio = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO);
const clave = (n: Nota) => `${n.categoria}|${n.texto.toLowerCase()}`;

/** Quita vacías y repetidas, recorta textos y respeta el orden de categorías. */
function ordenar(notas: Nota[]): Nota[] {
  const vistas = new Set<string>();
  const salida: Nota[] = [];
  for (const n of notas) {
    const texto = limpio(n.texto);
    if (!texto) continue;
    const nota = { categoria: n.categoria, texto };
    if (vistas.has(clave(nota))) continue;
    vistas.add(clave(nota));
    salida.push(nota);
  }
  return salida
    .sort((a, b) => CATEGORIAS_NOTA.indexOf(a.categoria) - CATEGORIAS_NOTA.indexOf(b.categoria))
    .slice(0, MAX_NOTAS);
}

/** Notas de un ítem leído por la IA. Tolera interpretaciones guardadas antes de que existieran estos campos. */
export function notasDeItem(item: Partial<ItemExtraido>): Nota[] {
  const temas = item.estimacion?.temas ?? [] // los temas de un evento van en su tarea "Preparación";
  return ordenar([
    ...temas.map((t) => ({ categoria: 'temas' as const, texto: t.nombre })),
    ...(item.preparativos ?? []).map((t) => ({ categoria: 'llevar' as const, texto: t })),
    ...(item.referencias ?? []).map((t) => ({ categoria: 'bibliografia' as const, texto: t })),
    ...(item.duracion ? [{ categoria: 'duracion' as const, texto: item.duracion }] : []),
    ...(item.descripcion ? [{ categoria: 'otros' as const, texto: item.descripcion }] : []),
  ]);
}

/** Valida notas que llegan del front o de la IA. undefined = no vinieron; null = formato inválido. */
export function normalizarNotas(v: unknown): Nota[] | null | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > MAX_NOTAS * 2) return null;
  const notas: Nota[] = [];
  for (const x of v) {
    const r = (x ?? {}) as Record<string, unknown>;
    if (!(CATEGORIAS_NOTA as readonly string[]).includes(r.categoria as string) || typeof r.texto !== 'string') return null;
    notas.push({ categoria: r.categoria as CategoriaNota, texto: r.texto });
  }
  return ordenar(notas);
}

/** Igual que normalizarNotas, pero descarta lo inválido en vez de rechazar todo (respuesta de la IA). */
export function notasDeIA(v: unknown): Nota[] {
  if (!Array.isArray(v)) return [];
  return ordenar(v.flatMap((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    const ok = (CATEGORIAS_NOTA as readonly string[]).includes(r.categoria as string) && typeof r.texto === 'string';
    return ok ? [{ categoria: r.categoria as CategoriaNota, texto: r.texto as string }] : [];
  }));
}
