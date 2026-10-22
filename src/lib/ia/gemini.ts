import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdaptadorIA, TareaInterpretada } from './adaptador';
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

  async interpretarTexto(texto: string): Promise<TareaInterpretada> {
    const hoy = new Date().toISOString();
    const prompt = `Eres un asistente que extrae tareas académicas de texto en español.
Hoy es ${hoy} (zona horaria America/La_Paz).
Del siguiente texto, extrae UNA tarea y devuelve SOLO un JSON válido, sin explicaciones.

Reglas para "titulo": nombre formal y corto, SIN verbo al inicio (el tipo ya dice la acción),
con mayúscula inicial y abreviaturas expandidas. Ej.: "entregar inf de BD" → "Informe de Base de Datos".

Formato exacto:
{
  "titulo": "nombre formal según las reglas",
  "tipo": "examen | tarea | entrega | proyecto | exposicion",
  "fechaLimite": "fecha ISO 8601 completa o null si el texto no dice la fecha",
  "materia": "nombre de la materia o null",
  "confianza": 0.0 a 1.0
}

Texto: "${texto}"`;

    const respuesta = await this.generarConReintento(prompt);
    return this.leerJson(respuesta) as TareaInterpretada;
  }

  /** Fase 2: devuelve TODOS los ítems del texto (tareas, eventos y clases), ya validados. */
  async extraerItems(texto: string, ctx: ContextoExtraccion): Promise<ItemExtraido[]> {
    const respuesta = await this.generarConReintento(construirPromptExtraccion(texto, ctx));
    return normalizarItems(this.leerJson(respuesta));
  }
}

export const ia: AdaptadorIA = new AdaptadorGemini();