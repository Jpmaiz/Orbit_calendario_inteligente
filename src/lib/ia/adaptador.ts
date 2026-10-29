// Lo que CUALQUIER proveedor de IA debe saber hacer.
// Si cambiamos de Gemini a otro, solo creamos otro archivo que cumpla esto.
import type { ContextoExtraccion, ItemExtraido } from './extraccion';

export interface AdaptadorIA {
  extraerItems(texto: string, ctx: ContextoExtraccion): Promise<ItemExtraido[]>;
}