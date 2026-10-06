// Lo que CUALQUIER proveedor de IA debe saber hacer.
// Si cambiamos de Gemini a otro, solo creamos otro archivo que cumpla esto.

export interface TareaInterpretada {
  titulo: string;
  tipo: string;        // examen | tarea | entrega | proyecto | exposicion
  fechaLimite: string; // ISO 8601
  materia?: string;
  confianza: number;   // 0 a 1
}

export interface AdaptadorIA {
  interpretarTexto(texto: string): Promise<TareaInterpretada>;
}