import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdaptadorIA, TareaInterpretada } from './adaptador';

class AdaptadorGemini implements AdaptadorIA {
  private modelo;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.modelo = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  }

  async interpretarTexto(texto: string): Promise<TareaInterpretada> {
    const hoy = new Date().toISOString();
    const prompt = `Eres un asistente que extrae tareas académicas de texto en español.
Hoy es ${hoy} (zona horaria America/La_Paz).
Del siguiente texto, extrae UNA tarea y devuelve SOLO un JSON válido, sin explicaciones.

Formato exacto:
{
  "titulo": "string corto",
  "tipo": "examen | tarea | entrega | proyecto | exposicion",
  "fechaLimite": "fecha ISO 8601 completa",
  "materia": "nombre de la materia o null",
  "confianza": 0.0 a 1.0
}

Texto: "${texto}"`;

    const resultado = await this.modelo.generateContent(prompt);
    const respuesta = resultado.response.text();
    const jsonLimpio = respuesta.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonLimpio) as TareaInterpretada;
  }
}

export const ia: AdaptadorIA = new AdaptadorGemini();