import OpenAI from 'openai';
import { AdaptadorIA, ImagenEntrada, leerJson } from './adaptador';
import { construirPromptExtraccion, normalizarItems, ContextoExtraccion, ItemExtraido } from './extraccion';

const MODELO = 'deepseek-flash'; // acepta texto e imágenes
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Contenido = OpenAI.Chat.ChatCompletionContentPart[] | string;

class AdaptadorDeepSeek implements AdaptadorIA {
  private cliente: OpenAI;

  constructor() {
    this.cliente = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 60_000, // leer una imagen tarda más que un texto
    });
  }

  /** Reintenta solo en errores temporales (429 / 5xx). Hasta 3 intentos: espera 1 s y 2 s. */
  private async pedirJson(contenido: Contenido, intentos = 3): Promise<string> {
    let forzarJson = true;
    for (let i = 0; i < intentos; i++) {
      try {
        const respuesta = await this.cliente.chat.completions.create({
          model: MODELO,
          messages: [{ role: 'user', content: contenido }],
          ...(forzarJson ? { response_format: { type: 'json_object' } } : {}), // fuerza JSON válido
          temperature: 0.2, // respuestas estables
          // Sin "modo pensamiento": para extraer datos solo agrega demora y costo
          thinking: { type: 'disabled' },
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
        return respuesta.choices[0]?.message?.content ?? '{}';
      } catch (error) {
        const status = (error as { status?: number })?.status ?? 0;
        // Si el modo JSON no se admite con imágenes, se repite sin él (el prompt ya pide solo JSON)
        if (status === 400 && forzarJson && typeof contenido !== 'string') {
          forzarJson = false;
          i--;
          continue;
        }
        const esTemporal = status === 429 || status >= 500;
        if (!esTemporal || i === intentos - 1) throw error;
        await espera(1000 * (i + 1));
      }
    }
    throw new Error('Inalcanzable');
  }

  /** Fase 2: devuelve TODOS los ítems del texto (tareas, eventos y clases), ya validados. */
  async extraerItems(texto: string, ctx: ContextoExtraccion): Promise<ItemExtraido[]> {
    const contenido = await this.pedirJson(construirPromptExtraccion(texto, ctx));
    return normalizarItems(leerJson(contenido));
  }

  async jsonConImagenes(prompt: string, imagenes: ImagenEntrada[]): Promise<unknown> {
    const partes: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'text', text: prompt },
      ...imagenes.map((img) => ({
        type: 'image_url' as const,
        image_url: { url: `data:${img.mime};base64,${img.base64}` },
      })),
    ];
    return leerJson(await this.pedirJson(partes));
  }
}

export const ia: AdaptadorIA = new AdaptadorDeepSeek();
