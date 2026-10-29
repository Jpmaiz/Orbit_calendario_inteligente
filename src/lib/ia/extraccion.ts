/**
 * Extracción de ítems (Fase 2): contrato con la IA, prompt y validación.
 * La IA solo LEE y DESMENUZA. Fechas, materias y duplicados los decide el sistema.
 */
import type { FechaDicha } from '@/lib/fechas/resolverFecha';

export type ClaseItem = 'tarea' | 'evento' | 'evento_fijo';
export const TIPOS_TAREA = ['examen', 'tarea', 'entrega', 'proyecto', 'exposicion'] as const;

/** Lo que devuelve la IA por cada cosa que encontró en el texto (ya validado). */
export type ItemExtraido = {
  clase: ClaseItem;
  titulo: string;
  tipo: (typeof TIPOS_TAREA)[number] | null; // solo tareas
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
  "fechaDicha": FECHA o null,
  "fechaFinDicha": FECHA o null,
  "hora": "HH:mm" o null,
  "horaFin": "HH:mm" o null,
  "diasSemana": [números],
  "materia": string o null,
  "codigoMateria": string o null,
  "descripcion": string o null,
  "ubicacion": string o null,
  "confianza": número de 0 a 1,
  "evidencia": "fragmento exacto del texto de donde salió este ítem"
}

CLASE:
- "tarea": hay que preparar o entregar algo para una fecha (examen, entrega, proyecto, exposición, tarea). Lleva "tipo".
- "evento": ocurre una vez en un horario (reunión de grupo, charla, feria). "tipo" = null.
    Si dura varios días ("del 20 al 29 de noviembre"), "fechaDicha" = primer día y "fechaFinDicha" = último día.
    Si es un solo día, "fechaFinDicha" = null.
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
- Si el texto no dice cuándo: null. NUNCA inventes una fecha ni una hora.

MATERIA: si corresponde a una de las materias del estudiante, usa ese nombre exacto. Si no, escríbela como aparece.
Si solo aparece un código (ej. "SIS-311"), ponlo en "codigoMateria" y deja "materia" en null.
DESCRIPCION: temas o detalles útiles ("subnetting, VLANs"). Si no hay, null.
`;

export function construirPromptExtraccion(texto: string, ctx: ContextoExtraccion): string {
  const hoy = hoyComoTexto(ctx);
  const materias = materiasComoTexto(ctx);

  return `Eres un asistente que lee mensajes de estudiantes universitarios en Bolivia y los desmenuza en actividades.
Hoy es ${hoy}. Materias del estudiante: ${materias}.

Devuelve SOLO un JSON con esta forma: { "items": [ ... ] }. Un ítem por cada actividad del texto (máximo 10).

${REGLAS_ITEMS}

Texto del estudiante: """${texto}"""`;
}

const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

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

  for (const x of lista.slice(0, 10)) {
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
    });
  }
  return items;
}

export const NOMBRE_DIA = (d: number) => DIAS[d - 1] ?? '';