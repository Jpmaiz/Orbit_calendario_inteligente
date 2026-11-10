/**
 * Extracción de ítems (Fase 2): contrato con la IA, prompt y validación.
 * La IA solo LEE y DESMENUZA. Fechas, materias y duplicados los decide el sistema.
 */
import type { FechaDicha } from '@/lib/fechas/resolverFecha';
import { normalizarLecturaEstimacion, type LecturaEstimacion } from '@/lib/estimacion/rubrica';

export type ClaseItem = 'tarea' | 'evento' | 'evento_fijo';
export const TIPOS_TAREA = ['examen', 'tarea', 'entrega', 'proyecto', 'exposicion'] as const;

/** Lo que devuelve la IA por cada cosa que encontró en el texto (ya validado). */
export type ItemExtraido = {
  clase: ClaseItem;
  titulo: string;
  tipo: (typeof TIPOS_TAREA)[number] | null; // solo tareas
  tipoSeguro: boolean;                       // el texto dice qué es (false = deducido: el front pregunta)
  fechaDicha: FechaDicha | null;             // tarea y evento
  fechaFinDicha: FechaDicha | null;          // evento de varios días ("del 20 al 29"): último día
  hora: string | null;                       // "HH:mm" (tarea: hora límite o del examen; evento: inicio)
  horaFin: string | null;                    // evento y evento_fijo
  diasSemana: number[];                      // evento_fijo: 1 = lunes … 7 = domingo
  materia: string | null;                    // nombre tal como aparece
  codigoMateria: string | null;              // ej. "SIS-311"
  descripcion: string | null;                // temas o detalles
  ubicacion: string | null;
  confianza: number;                         // 0–1
  evidencia: string;                         // fragmento del texto de donde salió
  fechaReferencia: string | null;            // AAAA-MM-DD: día en que se dijo (mensaje de una captura). null = hoy
  fechaInferida: boolean;                    // el texto no dice el día: se dedujo del contexto (se pide confirmar)
  venceCon: number | null;                   // vence cuando empieza otro ítem de la lista (índice): "entregar al ingresar al examen"
  materiaSugerida: string | null;            // materia deducida por el contenido (no nombrada): se pide confirmar
  estimacion: LecturaEstimacion | null;      // tareas: rúbrica para calcular horas y dificultad (lo calcula el sistema)
  preparacion: { titulo: string | null; estimacion: LecturaEstimacion | null } | null; // evento que hay que llevar estudiado
  preparativos: string[];                    // lo que hay que llevar o tener listo
  referencias: string[];                     // libros o fuentes
  duracion: string | null;                   // cuánto dura la actividad al hacerla ("15 min por grupo")
};

export type ContextoExtraccion = {
  ahora: Date;
  zonaHoraria: string;
  materias: string[]; // nombres de las materias del usuario, para que la IA use el mismo nombre
};

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** "miércoles, 28 de octubre de 2026" en la zona del usuario. */
export const hoyComoTexto = (ctx: ContextoExtraccion) =>
  new Intl.DateTimeFormat('es-BO', {
    timeZone: ctx.zonaHoraria, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(ctx.ahora);

export const materiasComoTexto = (ctx: ContextoExtraccion) =>
  ctx.materias.length ? ctx.materias.map((m) => `"${m}"`).join(', ') : '(ninguna todavía)';

/** Formato y reglas de cada ítem. Lo comparten el prompt de texto y el de imágenes. */
export const REGLAS_ITEMS = `Cada ítem:
{
  "clase": "tarea" | "evento" | "evento_fijo",
  "titulo": string,
  "tipo": "examen" | "tarea" | "entrega" | "proyecto" | "exposicion" | null,
  "tipoSeguro": true | false,
  "fechaDicha": FECHA o null,
  "fechaFinDicha": FECHA o null,
  "fechaInferida": true | false,
  "venceCon": número o null,
  "hora": "HH:mm" o null,
  "horaFin": "HH:mm" o null,
  "diasSemana": [números],
  "materia": string o null,
  "codigoMateria": string o null,
  "materiaSugerida": string o null,
  "descripcion": string o null,
  "ubicacion": string o null,
  "estimacion": ESTIMACION o null,
  "preparacion": { "titulo": string, "estimacion": ESTIMACION } o null,
  "preparativos": [string],
  "referencias": [string],
  "duracion": string o null,
  "confianza": número de 0 a 1,
  "evidencia": "fragmento exacto del texto de donde salió este ítem"
}

ACTIVIDADES: extrae TODAS, también las que se mencionan de paso ("para el día del examen de la 4.ª unidad"
también anuncia un examen: es otro ítem). Ignora saludos y frases sin actividad ("buenos días", "cualquier duda inbox").

CLASE:
- "tarea": hay que preparar o entregar algo para una fecha (examen, entrega, proyecto, exposición, tarea). Lleva "tipo".
- "evento": ocurre una vez en un horario (reunión de grupo, charla, feria, cirugía, práctica en hospital). "tipo" = null.
    Si dura varios días ("del 20 al 29 de noviembre"), "fechaDicha" = primer día y "fechaFinDicha" = último día.
    Si es un solo día, "fechaFinDicha" = null.
    Si para el evento hay que llevar estudiado algo ("estudiar semiología de apéndice y nudos"), ponlo en "preparacion"
    con su ESTIMACION (los temas a estudiar). No crees otro ítem para eso: el sistema lo crea.
- "tipoSeguro": true si el texto dice qué es ("examen", "entrega", "exposición", "proyecto"); false si lo dedujiste.
- "evento_fijo": se repite cada semana (una clase). Usa "diasSemana" (1 = lunes … 7 = domingo), "hora" de inicio y "horaFin". "fechaDicha" = null.

TITULO: nombre formal y corto, SIN verbo al inicio (el tipo ya dice la acción), con mayúscula inicial y abreviaturas expandidas.
Conserva los detalles que distinguen (teórico, práctico, final, parte 2).
Ej.: "entregar inf de BD" → "Informe de Base de Datos"; "examen de redes 2 teorico" → "Examen Teórico de Redes 2".

FECHA (NO calcules fechas; describe lo que dijo el texto):
- Día de la semana: { "tipo": "diaSemana", "dia": 1-7, "semana": S }
    S = "esta" si dice "este lunes"; "siguiente" si dice "el lunes de la siguiente/próxima semana";
        "ambigua" si dice "el próximo lunes" o "el siguiente lunes"; "sin_especificar" si solo dice "el lunes".
- Relativa: { "tipo": "relativa", "dias": N }  (hoy = 0, mañana = 1, pasado mañana = 2, "en 3 días" = 3)
- Fecha con número: { "tipo": "exacta", "fecha": "AAAA-MM-DD" }  (si no dice el año, usa el año actual)
- Si el ítem no dice el día pero el contexto lo deja claro (va en el mismo párrafo que otras actividades de ese día),
  usa esa fecha y pon "fechaInferida": true. Si no hay forma de saberlo: null. NUNCA inventes una fecha ni una hora.
- "venceCon": si se entrega cuando empieza otro ítem de esta lista ("entregar al ingresar a rendir el examen"),
  pon el número de ese ítem (0 = el primero) y usa su misma fecha. Si no, null.

MATERIA: si corresponde a una de las materias del estudiante, usa ese nombre exacto. Si no, escríbela como aparece.
Si solo aparece un código (ej. "SIS-311"), ponlo en "codigoMateria" y deja "materia" en null.
Si el texto NO nombra la materia pero el contenido apunta claramente a una de las materias del estudiante
(patologías e inmunohistoquímica → Anatomía Patológica), deja "materia" en null y pon ese nombre exacto en "materiaSugerida".
Si no estás seguro, "materiaSugerida" = null.
DESCRIPCION: detalles útiles que no van en otro campo. Si no hay, null.
PREPARATIVOS: cosas físicas que hay que llevar o entregar ("entregar en físico" → "Llevar el trabajo impreso", "llevar bata").
Una parte del trabajo ("preparar la demo") NO es un preparativo: es parte de la tarea (ver "partes"). Si no hay, [].
REFERENCIAS: libros o fuentes que nombra ("Argente-Álvarez, última edición"). Si no hay, [].
DURACION: cuánto dura la actividad cuando se hace, si el texto lo dice ("15 min por grupo", "2 horas de examen").
No es el tiempo de preparación. Si no lo dice, null.
DESCRIPCION no repite lo que ya va en temas, preparativos, referencias o duracion.

ESTIMACION (solo tareas y "preparacion"). Califica la actividad para un estudiante promedio que asistió a clases.
NO calcules horas: el sistema las calcula con lo que califiques.
{
  "escala": "control" | "parcial" | "final" | null,
  "temas": [ { "nombre": string, "amplitud": "estrecho" | "normal" | "amplio" } ],
  "cantidades": { "paginasLeer": n o null, "paginasEscribir": n o null, "ejercicios": n o null, "diapositivas": n o null, "minutosExposicion": n o null },
  "volumen": "bajo" | "medio" | "alto" | null,
  "nivelCognitivo": 1 | 2 | 3 | 4,
  "partes": true | false,
  "grupal": true | false,
  "formato": "escrito" | "oral" | "practico" | "a_mano" | null,
  "claridad": "alta" | "media" | "baja",
  "impostergable": true | false,
  "evidencia": { "nivel": string, "volumen": string, "partes": string, "grupal": string, "formato": string, "peso": string }
}
- escala (solo exámenes): "control" = quiz, control, oral o evaluación de una práctica; "parcial" = parcial o examen de unidad;
  "final" = examen final. Si el texto no lo deja claro: null (no adivines).
- temas: los contenidos que hay que estudiar o cubrir, solo si el texto los nombra.
  "amplio" = un sistema, unidad o competencia completa ("cardio", "digestivo", "toda la unidad 3", "la 4.ª competencia");
  "estrecho" = un subtema puntual; si no, "normal" (un capítulo es "normal").
  Las subdivisiones de un tema ("primaria, secundaria y terciaria") son UN tema.
  En una comparación, CADA cosa comparada es un tema ("nefríticos vs nefróticos" = 2 temas).
  El nombre del propio trabajo NO es un tema ("historia clínica de litiasis renal" → temas [], usa "volumen").
- cantidades: solo números que el texto dice sobre el trabajo (páginas, ejercicios, diapositivas, minutos de exposición).
  "20 pts" o "nota sobre 20 puntos" es la calificación: NO es una cantidad. Ignórala.
- volumen: solo si no hay temas ni cantidades. Si no se sabe, null.
- nivelCognitivo: 1 = recordar o definir; 2 = comprender, resolver ejercicios conocidos, aplicar un procedimiento;
  3 = analizar, comparar, justificar, integrar un caso (cuadro comparativo, historia clínica), exponer o defender un trabajo;
  4 = crear, diseñar, investigar.
- partes: varias partes o entregables distintos (diapositivas + demo, informe + código). grupal: se hace en grupo.
- formato: "oral" (oral, defensa); "practico" (con las manos o en laboratorio: maniobras, nudos, Packet Tracer);
  "a_mano" (pide hacerlo a mano); "escrito" (escrito normal). Si no se sabe, null.
- claridad: "baja" si las instrucciones son vagas o no dicen qué entra; "alta" si dicen exactamente qué hacer.
- impostergable: true si dice "impostergable", "no se recibe tarde" o similar. Nunca suma horas.
- La calificación ("vale 20 puntos", "nota sobre 20") no se califica en ningún campo: ignórala.
- evidencia: la frase EXACTA del texto que justifica nivel 3 o 4, volumen alto, partes, grupal, formato oral o práctico,
  e impostergable. Sin frase que lo respalde, deja "" y usa el valor medio (nivel 2, volumen medio, false, null). No supongas.
`;

export function construirPromptExtraccion(texto: string, ctx: ContextoExtraccion): string {
  const hoy = hoyComoTexto(ctx);
  const materias = materiasComoTexto(ctx);

  return `Eres un asistente que lee mensajes de estudiantes universitarios en Bolivia y los desmenuza en actividades.
Hoy es ${hoy}. Materias del estudiante: ${materias}.

Devuelve SOLO un JSON con esta forma: { "items": [ ... ] }. Un ítem por cada actividad del texto (máximo 12).

${REGLAS_ITEMS}

Texto del estudiante: """${texto}"""`;
}

const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const textos = (v: unknown, cantidad: number, max: number) =>
  Array.isArray(v) ? [...new Set(v.map((x) => texto(x, max)).filter((x): x is string => !!x))].slice(0, cantidad) : [];

export function normalizarFecha(v: unknown): FechaDicha | null {
  const f = (v ?? null) as Record<string, unknown> | null;
  if (!f || typeof f !== 'object') return null;
  if (f.tipo === 'exacta' && typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) {
    return { tipo: 'exacta', fecha: f.fecha };
  }
  if (f.tipo === 'relativa' && Number.isInteger(f.dias) && (f.dias as number) >= 0 && (f.dias as number) <= 365) {
    return { tipo: 'relativa', dias: f.dias as number };
  }
  const semanas = ['esta', 'siguiente', 'ambigua', 'sin_especificar'] as const;
  if (f.tipo === 'diaSemana' && Number.isInteger(f.dia) && (f.dia as number) >= 1 && (f.dia as number) <= 7) {
    const semana = semanas.includes(f.semana as never) ? (f.semana as (typeof semanas)[number]) : 'sin_especificar';
    return { tipo: 'diaSemana', dia: f.dia as number, semana };
  }
  return null;
}

/** Valida y limpia la respuesta de la IA. Descarta lo que no sirve; nunca confía a ciegas. */
export function normalizarItems(crudo: unknown): ItemExtraido[] {
  const lista = Array.isArray((crudo as { items?: unknown })?.items) ? (crudo as { items: unknown[] }).items : [];
  const items: ItemExtraido[] = [];

  for (const x of lista.slice(0, 12)) {
    const r = (x ?? {}) as Record<string, unknown>;
    const titulo = texto(r.titulo, 200);
    if (!titulo) continue;

    const clase: ClaseItem = r.clase === 'evento' || r.clase === 'evento_fijo' ? r.clase : 'tarea';
    const tipo =
      clase === 'tarea'
        ? (TIPOS_TAREA as readonly string[]).includes(r.tipo as string) ? (r.tipo as ItemExtraido['tipo']) : 'tarea'
        : null;
    const diasSemana =
      clase === 'evento_fijo' && Array.isArray(r.diasSemana)
        ? [...new Set(r.diasSemana.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
        : [];

    items.push({
      clase,
      titulo,
      tipo,
      // Tipo inválido o ausente (se usó "tarea" por defecto) = no es seguro
      tipoSeguro: clase !== 'tarea' || ((TIPOS_TAREA as readonly string[]).includes(r.tipo as string) && r.tipoSeguro !== false),
      fechaDicha: clase === 'evento_fijo' ? null : normalizarFecha(r.fechaDicha),
      fechaFinDicha: clase === 'evento' ? normalizarFecha(r.fechaFinDicha) : null,
      hora: esHora(r.hora) ? r.hora : null,
      horaFin: esHora(r.horaFin) ? r.horaFin : null,
      diasSemana,
      materia: texto(r.materia, 100),
      codigoMateria: texto(r.codigoMateria, 30),
      descripcion: texto(r.descripcion, 1000),
      ubicacion: texto(r.ubicacion, 100),
      confianza: Math.min(1, Math.max(0, Number(r.confianza) || 0.5)),
      evidencia: texto(r.evidencia, 300) ?? '',
      fechaReferencia: typeof r.fechaReferencia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.fechaReferencia) ? r.fechaReferencia : null,
      fechaInferida: clase !== 'evento_fijo' && r.fechaInferida === true,
      venceCon: clase === 'tarea' && Number.isInteger(r.venceCon) && (r.venceCon as number) >= 0 ? (r.venceCon as number) : null,
      materiaSugerida: texto(r.materiaSugerida, 100),
      estimacion: clase === 'tarea' ? normalizarLecturaEstimacion(r.estimacion) : null,
      preparacion: clase === 'evento' ? normalizarPreparacion(r.preparacion) : null,
      preparativos: textos(r.preparativos, 5, 120),
      referencias: textos(r.referencias, 5, 120),
      duracion: texto(r.duracion, 80),
    });
  }
  // "venceCon" tiene que apuntar a OTRO ítem que exista
  return items.map((it, i) => (it.venceCon !== null && (it.venceCon === i || it.venceCon >= items.length) ? { ...it, venceCon: null } : it));
}

function normalizarPreparacion(v: unknown): ItemExtraido['preparacion'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  const estimacion = normalizarLecturaEstimacion(p.estimacion);
  // Sin temas ni cantidades no hay nada concreto que preparar
  if (!estimacion || (estimacion.temas.length === 0 && !Object.values(estimacion.cantidades).some(Boolean))) return null;
  return { titulo: texto(p.titulo, 150), estimacion };
}

/** Campos nuevos con su valor vacío: para ítems que arma el sistema (clases de un horario). */
export const CAMPOS_VACIOS = {
  fechaInferida: false, venceCon: null, materiaSugerida: null, estimacion: null,
  preparacion: null, preparativos: [], referencias: [], tipoSeguro: true, duracion: null,
} satisfies Partial<ItemExtraido>;

export const NOMBRE_DIA = (d: number) => DIAS[d - 1] ?? '';
