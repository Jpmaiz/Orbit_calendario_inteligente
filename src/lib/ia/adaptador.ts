// Lo que CUALQUIER proveedor de IA debe saber hacer.
// Si cambiamos de proveedor, solo creamos otro archivo que cumpla esto.
import type { ContextoExtraccion, ItemExtraido } from './extraccion';

/** Imagen ya validada (formato real comprobado por sus primeros bytes). */
export type ImagenEntrada = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string };

export interface AdaptadorIA {
  extraerItems(texto: string, ctx: ContextoExtraccion): Promise<ItemExtraido[]>;
  /** Manda un prompt + imágenes y devuelve el JSON crudo (lo valida quien lo pide). */
  jsonConImagenes(prompt: string, imagenes: ImagenEntrada[]): Promise<unknown>;
}

/** Algunos modelos envuelven el JSON en ```json ... ```: se limpia antes de leerlo. */
export function leerJson(respuesta: string): unknown {
  const limpio = respuesta.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    // Último recurso: el primer objeto { ... } que aparezca
    const a = limpio.indexOf('{'), b = limpio.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(limpio.slice(a, b + 1));
    throw new Error('La IA no devolvió un JSON válido');
  }
}
