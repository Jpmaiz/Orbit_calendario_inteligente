import { GoogleGenerativeAI } from '@google/generative-ai';
import { AdaptadorIA, TareaInterpretada } from './adaptador';

class AdaptadorGemini implements AdaptadorIA {
  private modelo;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.modelo = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async interpretarTexto(texto: string): Promise<TareaInterpretada> {
    const hoy = new Date().toISOString();

    const prompt = `Eres un asistente que extrae tareas académicas de texto en español.
Fecha y hora actual: ${hoy}
Zona horaria: America/La_Paz

Texto del usuario: "${texto}"

Devuelve SOLO un JSON válido con esta estructura, sin texto adicional:
{
  "titulo": "string",
  "tipo": "examen | tarea | entrega | proyecto | exposicion",
  "fechaLimite": "fecha ISO 8601",
  "materia": "string o null",
  "confianza": number entre 0 y 1
}`;

    const resultado = await this.modelo.generateContent(prompt);
    const respuesta = resultado.response.text();

    // Gemini a veces envuelve el JSON en ```json ... ```, lo limpiamos
    const jsonLimpio = respuesta.replace(/```json|```/g, '').trim();

    return JSON.parse(jsonLimpio) as TareaInterpretada;
  }
}

// Única instancia exportada. El resto del sistema importa ESTO, no Gemini.
export const ia: AdaptadorIA = new AdaptadorGemini();