import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { AdaptadorIA, ImagenEntrada, leerJson } from './adaptador';
import { construirPromptExtraccion, normalizarItems, ContextoExtraccion, ItemExtraido } from './extraccion';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gemini queda como respaldo de DeepSeek (se elige con IA_PROVEEDOR en .env). */
class AdaptadorGemini implements AdaptadorIA {
  private modelo;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
    this.modelo = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
  }

  /** Reintenta solo en errores temporales (429 / 503). Hasta 3 intentos: espera 1 s y 2 s. */
  private async generarConReintento(contenido: string | Part[], intentos = 3): Promise<string> {
    for (let i = 0; i < intentos; i++) {
      try {
        const resultado = await this.modelo.generateContent(contenido);
        return resultado.response.text();
      } catch (error) {
        const status = (error as { status?: number })?.status;
        const esTemporal = status === 503 || status === 429;
        if (!esTemporal || i === intentos - 1) throw error;
        await espera(1000 * (i + 1));
      }
    }
    throw new Error('Inalcanzable');
  }

  /** Fase 2: devuelve TODOS los ítems del texto (tareas, eventos y clases), ya validados. */
  async extraerItems(texto: string, ctx: ContextoExtraccion): Promise<ItemExtraido[]> {
    const respuesta = await this.generarConReintento(construirPromptExtraccion(texto, ctx));
    return normalizarItems(leerJson(respuesta));
  }

  async jsonConImagenes(prompt: string, imagenes: ImagenEntrada[]): Promise<unknown> {
    const partes: Part[] = [
      { text: prompt },
      ...imagenes.map((img) => ({ inlineData: { mimeType: img.mime, data: img.base64 } })),
    ];
    return leerJson(await this.generarConReintento(partes));
  }
}

export const ia: AdaptadorIA = new AdaptadorGemini();
