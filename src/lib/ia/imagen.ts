/**
 * Lectura de imágenes (horario, afiche, captura de chat, pizarra) y PDF convertido a imágenes.
 *
 * La IA percibe: dice qué tipo de documento es y copia lo que ve.
 * El sistema decide: separa sigla/aula/paralelo, une celdas, calcula fechas, propone materias.
 *
 * Horarios (lo más fácil de leer mal en una foto chueca): se leen de dos formas INDEPENDIENTES
 *   1) fila por fila, copiando TODAS las casillas (también las vacías): la posición fija el día;
 *   2) columna por columna, sin ver la lectura 1.
 * Donde coinciden, es confiable. Donde no, una 3.ª consulta mira SOLO esas casillas (árbitro),
 * y esas clases quedan marcadas como dudosas para que el usuario las revise.
 */
import type { AdaptadorIA, ImagenEntrada } from './adaptador';
import {
  REGLAS_ITEMS, hoyComoTexto, materiasComoTexto, normalizarItems,
  type ContextoExtraccion, type ItemExtraido,
} from './extraccion';
import {
  agruparClases, claveCelda, compararPorCasilla, describirCelda, describirClase, revisarHorario, DIA_CORTO,
  type CeldaHorario, type ClaseLeida, type Conflicto, type MateriaLeida,
} from '@/lib/horario/celdas';
import { columnasACeldas, grillaACeldas, leerCasilla, type ColumnaLeida, type GrillaLeida } from '@/lib/horario/grilla';

export const TIPOS_DOCUMENTO = ['horario', 'afiche', 'captura_chat', 'pizarra', 'otro'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export type PeriodoLeido = { nombre: string | null; inicio: string; fin: string }; // AAAA-MM-DD

export type LecturaImagen = {
  tipoDocumento: TipoDocumento;
  fechaDocumento: string | null; // AAAA-MM-DD: fecha del afiche, de los mensajes de una captura, etc.
  periodo: PeriodoLeido | null;
  materias: MateriaLeida[];
  grilla: GrillaLeida | null;
  celdas: CeldaHorario[];        // celdas FINALES (después de comparar y arbitrar)
  items: ItemExtraido[];
};

export type Revision = {
  hecha: boolean;
  coinciden: number;        // casillas ocupadas en las que las dos lecturas coinciden
  conflictos: number;       // casillas en las que no coinciden
  correcciones: string[];   // cómo se resolvió cada conflicto
  diferencias: string[];    // qué dijo cada lectura en los conflictos
};

export type ResultadoLectura = {
  lectura: LecturaImagen;
  clases: ClaseLeida[];
  items: ItemExtraido[]; // clases convertidas + lo demás que tenía la imagen
  revision: Revision;
  avisos: string[];
};

// ───────────────────────── Prompts ─────────────────────────

const FOTO = `La imagen puede ser una foto chueca, inclinada o en perspectiva: sigue las LÍNEAS de la grilla,
no una línea recta imaginaria. Una casilla pertenece a la columna cuyo encabezado está arriba siguiendo esas líneas.`;

const REGLAS_HORARIO = `HORARIO (grilla de clases semanal) → llena "grilla":
- "dias": los encabezados de las columnas de DÍAS, de izquierda a derecha, tal como aparecen (no incluyas la columna de horas).
- "filas": TODAS las filas de la grilla, de arriba hacia abajo, también las vacías y las de recreo.
  - "horario": el texto de la columna de horas de esa fila, tal cual ("07:15 - 08:00").
  - "celdas": un texto por CADA columna de día, en el MISMO orden que "dias". Casilla vacía = "".
    Cada fila lleva EXACTAMENTE tantas celdas como "dias". La posición en la lista es lo que dice el día: cuenta bien.
  - Copia el texto de cada casilla tal cual se ve (ej. "SIS-233 [1] Aula: LRED/A1-3"). No lo resumas ni lo separes.
  - Si una casilla está combinada y ocupa varias filas, repite su texto en cada fila que cubre.
- ${FOTO}
- Si el documento trae una tabla de materias (sigla, nombre, paralelo, docente), cópiala en "materias".
  Escribe el "nombre" en forma formal: mayúscula inicial y tildes correctas
  ("ANALISIS DE ALGORITMOS" → "Análisis de Algoritmos"; "REDES DE COMPUTADORAS II" → "Redes de Computadoras II").
- Si dice el periodo o semestre con fechas ("Del: 03/08/2026 Al: 12/01/2027"), ponlo en "periodo" (fechas AAAA-MM-DD).`;

const REGLAS_OTROS = `AFICHE, CAPTURA DE CHAT, PIZARRA u OTRO → llena "items":
- Mismo formato de ítem que se explica abajo. Un afiche de un evento (feria, concierto, charla) es un "evento".
- "fechaDocumento": la fecha a la que se refiere lo que se ve, si aparece.
  En una captura de chat es la fecha de los mensajes: un separador "Hoy" = la fecha de hoy, "Ayer" = la de ayer,
  "28 de octubre" = esa fecha. La hora del reloj del celular NO es la fecha de los mensajes. Si no se ve, null.
- En una captura, "mañana" o "el lunes" se dicen desde la fecha DEL MENSAJE: descríbelos igual (relativa o diaSemana)
  y agrega a ese ítem "fechaReferencia": "AAAA-MM-DD" = fecha del mensaje donde se dijo (mira el separador de día
  más cercano ARRIBA del mensaje). Una captura puede tener mensajes de "Ayer" y de "Hoy": cada ítem lleva la suya.
  El sistema hace el cálculo.
- En un afiche, si dice "20 de noviembre" sin año, usa "exacta" con el año actual; el sistema corrige si ya pasó.
- La "evidencia" es el texto que se ve en la imagen y respalda el ítem.`;

const FORMATO = `Devuelve SOLO un JSON con esta forma:
{
  "tipoDocumento": "horario" | "afiche" | "captura_chat" | "pizarra" | "otro",
  "fechaDocumento": "AAAA-MM-DD" o null,
  "periodo": { "nombre": string o null, "inicio": "AAAA-MM-DD", "fin": "AAAA-MM-DD" } o null,
  "materias": [ { "codigo": string o null, "nombre": string, "paralelo": string o null, "docente": string o null } ],
  "grilla": { "dias": [string], "filas": [ { "horario": string, "celdas": [string] } ] } o null,
  "items": [ ... ]
}
"grilla" y "materias" solo para horarios; "items" para todo lo demás (también si un horario trae avisos de exámenes).`;

const PRIVACIDAD = `PRIVACIDAD: ignora datos personales (carnet o documento de identidad, número de registro, teléfonos,
direcciones, nombres de estudiantes). No los copies. El nombre del docente de una materia sí se puede copiar.`;

const conTexto = (textoAdjunto: string | null) =>
  textoAdjunto
    ? `\n\nTEXTO EXTRAÍDO DEL MISMO DOCUMENTO (exacto: úsalo para confirmar siglas, nombres, horas y fechas;
la posición de cada casilla en la grilla sale de la IMAGEN, no de este texto):\n"""${textoAdjunto}"""`
    : '';

export function construirPromptLectura(ctx: ContextoExtraccion, textoAdjunto: string | null): string {
  return `Eres un asistente que lee imágenes que suben estudiantes universitarios en Bolivia: horarios de clases,
afiches de eventos, capturas de chats y fotos de pizarras. Copias lo que ves; no inventas nada.
Hoy es ${hoyComoTexto(ctx)}. Materias del estudiante: ${materiasComoTexto(ctx)}.

${PRIVACIDAD}

Primero decide qué es la imagen ("tipoDocumento"). Si hay varias imágenes, son páginas del mismo documento.

${REGLAS_HORARIO}

${REGLAS_OTROS}

${FORMATO}

${REGLAS_ITEMS}${conTexto(textoAdjunto)}`;
}

/** Lectura 2: independiente (no ve la lectura 1) y en el otro sentido: columna por columna. */
export function construirPromptColumnas(textoAdjunto: string | null): string {
  return `Esta imagen es una grilla de horario de clases (columnas = días, filas = horas).
Léela COLUMNA POR COLUMNA:
- Recorre las columnas de DÍAS de izquierda a derecha (no la columna de horas).
- En cada una, baja de arriba hacia abajo y anota SOLO las casillas ocupadas, con:
  "horario" = el texto de la columna de horas de ESA fila (míralo a la izquierda, en la misma fila), tal cual;
  "texto" = el texto de la casilla tal cual (ej. "SIS-233 [1] Aula: LRED/A1-3").
- Si una casilla combinada ocupa varias filas, anótala una vez por cada fila que cubre.
- Incluye TODAS las columnas de días, aunque estén vacías ("ocupadas": []).
${FOTO}
${PRIVACIDAD}

Devuelve SOLO un JSON:
{ "columnas": [ { "dia": "encabezado tal cual", "ocupadas": [ { "horario": string, "texto": string } ] } ] }${conTexto(textoAdjunto)}`;
}

/** Lectura 3 (árbitro): solo las casillas en las que las dos lecturas no coinciden. */
export function construirPromptArbitro(conflictos: Conflicto[], encabezados: string[]): string {
  const nombreDia = (d: number) => encabezados[d - 1] ?? DIA_CORTO(d);
  const preguntas = conflictos
    .map((c, i) => `${i + 1}. Fila de ${c.inicio} a ${c.fin}, columna ${nombreDia(c.dia).toUpperCase()}`)
    .join('\n');
  return `Esta imagen es una grilla de horario de clases. Mira con mucho cuidado SOLO estas casillas:

${preguntas}

Para ubicar cada una: busca la fila por su hora en la columna de horas (izquierda) y la columna por el encabezado
del día (arriba). Sigue las líneas de la grilla. ${FOTO}

Para cada casilla, copia su texto tal cual se ve, o "" si está vacía.
Devuelve SOLO un JSON: { "respuestas": [ { "n": 1, "texto": string } ] }`;
}

// ───────────────────────── Validación de lo que devuelve la IA ─────────────────────────

const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const lista = (v: unknown) => (Array.isArray(v) ? v : []);
const cadena = (v: unknown) => (typeof v === 'string' ? v.slice(0, 200) : v == null ? '' : String(v).slice(0, 200));

export function normalizarGrilla(v: unknown): GrillaLeida | null {
  const g = (v ?? null) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object') return null;
  const dias = lista(g.dias).map(cadena).slice(0, 7);
  const filas = lista(g.filas).slice(0, 40).map((f) => {
    const r = (f ?? {}) as Record<string, unknown>;
    return { horario: cadena(r.horario), celdas: lista(r.celdas).map(cadena).slice(0, 8) };
  });
  return dias.length && filas.length ? { dias, filas } : null;
}

export function normalizarColumnas(v: unknown): ColumnaLeida[] {
  return lista(v).slice(0, 7).map((c) => {
    const r = (c ?? {}) as Record<string, unknown>;
    return {
      dia: cadena(r.dia),
      ocupadas: lista(r.ocupadas).slice(0, 40).map((o) => {
        const x = (o ?? {}) as Record<string, unknown>;
        return { horario: cadena(x.horario), texto: cadena(x.texto) };
      }),
    };
  });
}

export function normalizarLectura(crudo: unknown): LecturaImagen {
  const r = (crudo ?? {}) as Record<string, unknown>;
  const tipo = (TIPOS_DOCUMENTO as readonly string[]).includes(r.tipoDocumento as string)
    ? (r.tipoDocumento as TipoDocumento)
    : 'otro';

  const p = (r.periodo ?? null) as Record<string, unknown> | null;
  const periodo =
    p && esFecha(p.inicio) && esFecha(p.fin) && p.fin > p.inicio
      ? { nombre: texto(p.nombre, 50), inicio: p.inicio, fin: p.fin }
      : null;

  const materias: MateriaLeida[] = [];
  for (const x of lista(r.materias).slice(0, 20)) {
    const m = (x ?? {}) as Record<string, unknown>;
    const nombre = texto(m.nombre, 100);
    if (!nombre) continue;
    materias.push({
      codigo: texto(m.codigo, 30),
      nombre,
      paralelo: texto(m.paralelo == null ? null : String(m.paralelo), 10),
      docente: /^[\s_.-]*$/.test(String(m.docente ?? '')) ? null : texto(m.docente, 100), // "_______" = sin docente
    });
  }

  return {
    tipoDocumento: tipo,
    fechaDocumento: esFecha(r.fechaDocumento) ? r.fechaDocumento : null,
    periodo,
    materias,
    grilla: normalizarGrilla(r.grilla),
    celdas: [],
    items: normalizarItems({ items: r.items }),
  };
}

// ───────────────────────── Clases → ítems del borrador ─────────────────────────

function claseAItem(c: ClaseLeida): ItemExtraido {
  const detalles = [c.paralelo ? `Paralelo ${c.paralelo}` : null, c.docente ? `Docente: ${c.docente}` : null].filter(Boolean);
  return {
    clase: 'evento_fijo',
    titulo: c.nombre,
    tipo: null,
    fechaDicha: null,
    fechaFinDicha: null,
    hora: c.hora,
    horaFin: c.horaFin,
    diasSemana: c.diasSemana,
    materia: c.nombreConocido ? c.nombre : null, // solo sigla → el sistema propone por código o pregunta el nombre
    codigoMateria: c.codigo,
    descripcion: detalles.length ? detalles.join(' · ') : null,
    ubicacion: c.aula,
    confianza: c.dudosa ? 0.6 : 0.95,
    fechaReferencia: null,
    evidencia: `${c.codigo ?? c.nombre}${c.paralelo ? ` [${c.paralelo}]` : ''} · ${describirClase(c)}${c.aula ? ` · ${c.aula}` : ''}`,
  };
}

/** Máximo de ítems que acepta /api/ia/confirmar. */
const MAX_ITEMS = 20;
/** Más conflictos que esto: la foto es demasiado difícil, se avisa con fuerza. */
const MAX_CONFLICTOS = 30;

/**
 * Lee una o varias imágenes del MISMO documento.
 * Horario → 2 llamadas si las lecturas coinciden, 3 si hay que arbitrar. Lo demás → 1 llamada.
 */
export async function leerImagenes(
  ia: AdaptadorIA,
  imagenes: ImagenEntrada[],
  ctx: ContextoExtraccion,
  textoAdjunto: string | null,
): Promise<ResultadoLectura> {
  const lectura = normalizarLectura(await ia.jsonConImagenes(construirPromptLectura(ctx, textoAdjunto), imagenes));
  const avisos: string[] = [];
  const revision: Revision = { hecha: false, coinciden: 0, conflictos: 0, correcciones: [], diferencias: [] };
  const dudosas = new Set<string>();

  if (lectura.tipoDocumento === 'horario' && lectura.grilla) {
    const g1 = grillaACeldas(lectura.grilla);
    avisos.push(...g1.avisos);
    lectura.celdas = g1.celdas;

    // Lectura 2, independiente
    let c2: CeldaHorario[] | null = null;
    try {
      const crudo = (await ia.jsonConImagenes(construirPromptColumnas(textoAdjunto), imagenes)) as Record<string, unknown>;
      c2 = columnasACeldas(normalizarColumnas(crudo?.columnas));
    } catch {
      avisos.push('No se pudo hacer la segunda lectura del horario. Revisa las clases antes de guardar.');
    }

    if (c2) {
      const { acuerdo, conflictos } = compararPorCasilla(g1.celdas, c2);
      revision.hecha = true;
      revision.coinciden = acuerdo.length;
      revision.conflictos = conflictos.length;
      revision.diferencias = conflictos.map(
        (c) => `${DIA_CORTO(c.dia)} ${c.inicio}–${c.fin}: lectura 1 = ${describirCelda(c.a)}, lectura 2 = ${describirCelda(c.b)}`,
      );
      if (conflictos.length > MAX_CONFLICTOS) {
        avisos.push('La imagen es difícil de leer (muchas diferencias entre lecturas). Sube una foto más derecha y con buena luz, o el PDF.');
      }

      // Lectura 3: árbitro, solo para las casillas en conflicto
      let decididas: (CeldaHorario | null)[] | null = null;
      const aArbitrar = conflictos.slice(0, MAX_CONFLICTOS);
      if (aArbitrar.length) {
        try {
          const crudo = (await ia.jsonConImagenes(
            construirPromptArbitro(aArbitrar, lectura.grilla.dias),
            imagenes,
          )) as Record<string, unknown>;
          const porNumero = new Map(
            lista(crudo?.respuestas).map((x) => {
              const r = (x ?? {}) as Record<string, unknown>;
              return [Number(r.n), cadena(r.texto)] as const;
            }),
          );
          decididas = aArbitrar.map((c, i) => {
            const t = porNumero.get(i + 1);
            if (t === undefined) return c.a; // sin respuesta: se queda la lectura 1
            const casilla = leerCasilla(t);
            return casilla ? { dia: c.dia, inicio: c.inicio, fin: c.fin, ...casilla } : null;
          });
        } catch {
          avisos.push('No se pudo resolver las diferencias entre lecturas: se usa la primera. Revisa las clases marcadas.');
        }
      }

      const finales = [...acuerdo];
      aArbitrar.forEach((c, i) => {
        const elegida = decididas ? decididas[i] : c.a;
        revision.correcciones.push(
          `${DIA_CORTO(c.dia)} ${c.inicio}–${c.fin}: ${describirCelda(c.a)} / ${describirCelda(c.b)} → ${describirCelda(elegida)}`,
        );
        if (elegida) {
          finales.push(elegida);
          dudosas.add(claveCelda(elegida)); // lo que necesitó árbitro, el usuario lo mira
        }
      });
      // Conflictos que no alcanzaron a arbitrarse: se queda la lectura 1, marcada
      for (const c of conflictos.slice(MAX_CONFLICTOS)) {
        if (c.a) {
          finales.push(c.a);
          dudosas.add(claveCelda(c.a));
        }
      }
      lectura.celdas = finales;
    }
  }

  const clases = agruparClases(lectura.celdas, lectura.materias, dudosas);
  avisos.push(...revisarHorario(clases, lectura.materias));
  if (clases.some((c) => c.dudosa)) {
    avisos.push('Algunas clases no coincidían entre las dos lecturas: están marcadas con confianza baja. Revísalas.');
  }

  let items = [...clases.map(claseAItem), ...lectura.items];
  if (items.length > MAX_ITEMS) {
    avisos.push(`Encontré ${items.length} elementos; se muestran los primeros ${MAX_ITEMS}.`);
    items = items.slice(0, MAX_ITEMS);
  }
  if (items.length === 0) avisos.push('No encontré clases, eventos ni tareas en la imagen.');

  return { lectura, clases, items, revision, avisos };
}
