/**
 * Quita datos personales del texto de un PDF ANTES de mandarlo a la IA.
 * Para leer un horario no hacen falta el carnet, el número de registro ni el nombre del estudiante.
 * (Las imágenes no se pueden limpiar así: el prompt le pide a la IA ignorarlos y nada de eso se guarda.)
 *
 * El nombre del docente se deja: sirve para el detalle de la clase.
 */
const OMITIDO = '[omitido]';

/** Etiquetas cuyo valor es un dato personal del estudiante. */
// Sin flag "i": el valor son palabras EN MAYÚSCULAS (así imprime el SIAAN) y la etiqueta acepta ambas formas
const ETIQUETAS_NOMBRE =
  /\b((?:[Pp]rimer|[Ss]egundo|PRIMER|SEGUNDO)\s+(?:[Aa]pellido|APELLIDO)|[Aa]pellidos?|APELLIDOS?|[Nn]ombres?|NOMBRES?|[Ee]studiante|ESTUDIANTE|[Uu]suario|USUARIO)\s*:[ \t]*(?:[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'.-]+[ \t]*)+/g;
const ETIQUETAS_NUMERO = /\b(n(?:ú|u)mero de registro|n[°º]\s*de registro|registro|doc(?:\.|umento)? de identidad|c\.\s?i\.|ci\b|carnet|celular|tel[ée]fono)\s*:?[ \t]*\d[\d. \t-]{5,}\d(?:[ \t]+(?:LP|CB|SC|OR|PT|CH|TJ|BE|PD|COCHABAMBA|LA PAZ|SANTA CRUZ|ORURO|POTOS[IÍ]|CHUQUISACA|TARIJA|BENI|PANDO))?/gi;
/** Números largos sueltos (carnet, registro, teléfono). Las siglas ("SIS-233") y las horas no llegan a 7 dígitos. */
const NUMERO_LARGO = /\b\d{7,}\b/g;
const CORREO = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

export function quitarDatosPersonales(texto: string): string {
  return texto
    .replace(ETIQUETAS_NOMBRE, (_m, etiqueta: string) => `${etiqueta}: ${OMITIDO} `)
    .replace(ETIQUETAS_NUMERO, (_m, etiqueta: string) => `${etiqueta}: ${OMITIDO}`)
    .replace(NUMERO_LARGO, OMITIDO)
    .replace(CORREO, OMITIDO);
}
