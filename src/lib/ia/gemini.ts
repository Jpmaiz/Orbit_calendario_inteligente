import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdaptadorIA } from './adaptador';
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
  private async generarConReintento(prompt: string, intentos = 3): Promise<string> {
    for (let i = 0; i < intentos; i++) {
      try {
        const resultado = await this.modelo.generateContent(prompt);
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

  /** Gemini a veces envuelve el JSON en ```json ... ```: se limpia antes de leerlo. */
  private leerJson(respuesta: string): unknown {
    return JSON.parse(respuesta.replace(/```json|```/g, '').trim());
  }

  /** Fase 2: devuelve TODOS los ítems del texto (tareas, eventos y clases), ya validados. */
  async extraerItems(texto: string, ctx: ContextoExtraccion): Promise<ItemExtraido[]> {
    const respuesta = await this.generarConReintento(construirPromptExtraccion(texto, ctx));
    return normalizarItems(this.leerJson(respuesta));
  }
}

export const ia: AdaptadorIA = new AdaptadorGemini();