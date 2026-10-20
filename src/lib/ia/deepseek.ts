import OpenAI from 'openai';
import { AdaptadorIA, TareaInterpretada } from './adaptador';

const MODELO = 'deepseek-flash';
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

class AdaptadorDeepSeek implements AdaptadorIA {
  private cliente: OpenAI;

  constructor() {
    this.cliente = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 30_000,
    });
  }

  /** Reintenta solo en errores temporales (429 / 5xx). Hasta 3 intentos: espera 1 s y 2 s. */
  private async pedirJson(prompt: string, intentos = 3): Promise<string> {
    for (let i = 0; i < intentos; i++) {
      try {
        const respuesta = await this.cliente.chat.completions.create({
          model: MODELO,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }, // fuerza JSON válido
          temperature: 0.2, // respuestas estables
          // Sin "modo pensamiento": para extraer datos solo agrega demora y costo
          thinking: { type: 'disabled' },
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
        return respuesta.choices[0]?.message?.content ?? '{}';
      } catch (error) {
        const status = (error as { status?: number })?.status ?? 0;
        const esTemporal = status === 429 || status >= 500;
        if (!esTemporal || i === intentos - 1) throw error;
        await espera(1000 * (i + 1));
      }
    }
    throw new Error('Inalcanzable');
  }

  async interpretarTexto(texto: string): Promise<TareaInterpretada> {
    const hoy = new Date().toISOString();
    const prompt = `Eres un asistente que extrae tareas académicas de texto en español.
Hoy es ${hoy} (zona horaria America/La_Paz).
Del siguiente texto, extrae UNA tarea y devuelve SOLO un JSON válido, sin explicaciones.

Reglas para "titulo":
- Nombre formal y corto de la actividad, SIN verbo al inicio (el tipo ya dice la acción).
- Mayúscula inicial y nombres de materia con mayúsculas. Expande abreviaturas comunes.
- Ejemplos: "entregar inf de BD el viernes" → titulo "Informe de Base de Datos", tipo "entrega".
  "parcial de calculo el lunes" → titulo "Parcial de Cálculo", tipo "examen".
  "hacer el proyecto de facturación" → titulo "Proyecto de Facturación", tipo "proyecto".

Formato exacto:
{
  "titulo": "nombre formal según las reglas",
  "tipo": "examen | tarea | entrega | proyecto | exposicion",
  "fechaLimite": "fecha ISO 8601 completa o null si el texto no dice la fecha",
  "materia": "nombre de la materia o null",
  "confianza": 0.0 a 1.0
}

Texto: "${texto}"`;

    const contenido = await this.pedirJson(prompt);
    return JSON.parse(contenido) as TareaInterpretada;
  }
}

export const ia: AdaptadorIA = new AdaptadorDeepSeek();