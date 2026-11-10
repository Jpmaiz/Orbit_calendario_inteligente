import { esPeriodoActual, type PeriodoAcademico } from '../periodos/periodosFrontend';
import { diaEnBolivia } from '../calendario/organizarTareasDia';
import { fechaElegidaISO } from './flujoCaptura';
import type { Estimado } from '@/tipos/tarea';
import { leerEstimado } from '../estimacion/estimacionFrontend';

export const tiposTarea = ['examen', 'tarea', 'entrega', 'proyecto', 'exposicion'] as const;
export const nombresTipo: Record<string, string> = { examen: 'Examen', tarea: 'Tarea', entrega: 'Entrega', proyecto: 'Proyecto', exposicion: 'Exposición' };
export const CATEGORIAS_NOTA = ['llevar', 'temas', 'bibliografia', 'duracion', 'otros'] as const;
export type CategoriaNota = (typeof CATEGORIAS_NOTA)[number];
export type Nota = { categoria: CategoriaNota; texto: string };
export type HoraClase = { inicio: string; fin: string; motivo: string };
export type ClaseItem = 'tarea' | 'evento' | 'evento_fijo';
export type MateriaUsuario = { id: string; nombre: string; codigo: string | null };
export type MateriaElegida =
  | { accion: 'ninguna' }
  | { accion: 'vincular'; materiaId: string }
  | { accion: 'crear'; nombre: string; codigo: string | null };
export type PropuestaMateria =
  | { accion: 'ninguna' }
  | { accion: 'vincular'; materiaId: string; nombre: string; seguro: boolean; alternativas: { id: string; nombre: string }[] }
  | { accion: 'crear'; nombre: string; codigo: string | null; clave: string }
  | { accion: 'preguntar_nombre'; codigo: string };
export type ReferenciaExistente = { clase: 'tarea' | 'evento'; id: string };
export type ItemExtraido = {
  estimado?: Estimado | null;
  /** Por qué ~N h: solo se muestran si el usuario toca el chip (guía v2.8, regla 3). */
  razones: string[];
  /** false → Detalles se abre con "¿Qué tipo de actividad es?". */
  tipoSeguro: boolean;
  notas: Nota[];
  /** Fragmento del mensaje del que salió el ítem ("Tu mensaje"). */
  origen: string | null;
  /** Días con clase de su materia (1 = lun … 7 = dom): puntos del calendario. */
  diasClase: number[];
  clase: ClaseItem; titulo: string; tipo: string | null; fechaDicha: unknown;
  venceCon: number | null; // Posición del destino en la lista original, nunca un ID.
  hora: string | null; horaFin: string | null; diasSemana: number[];
  materia: string | null; codigoMateria: string | null; descripcion: string | null;
  ubicacion: string | null; confianza: number; evidencia: string;
  inicio: string | null; fin: string | null; horaDefinida: boolean;
  supuestos: string[]; opcionesFecha: { etiqueta: string; fecha: string }[] | null; faltantes: string[];
  materiaPropuesta: PropuestaMateria;
  horaPropuesta: HoraClase | null;
  vigencia: { desde: string; hasta: string; periodo: string } | null;
  duplicado: { tipoDuplicado: string; pregunta: string; sugerenciasDiferencia?: string[];
    diasExistentes?: number[]; tarea?: { id: string; titulo: string; fechaLimite?: string; horaDefinida?: boolean }; similitud?: number;
    evento?: { id: string; titulo: string; inicio: string } } | null;
  choques: { titulo: string; cuando: string }[];
};
export type Borrador = {
  interpretacionId: string; items: ItemExtraido[];
  periodo: { nombre: string; inicio: string; fin: string } | null; advertencias: string[];
};
export type ItemRevision = {
  original: ItemExtraido; titulo: string; clase: ClaseItem; tipo: string;
  fecha: string; hora: string; horaDefinida: boolean; fechaFin: string; horaFin: string;
  diasSemana: number[]; ubicacion: string; descripcion: string;
  materia: MateriaElegida; grupoMateria: string | null;
  vigenciaDesde: string; vigenciaHasta: string;
  fechaElegida: boolean; propuestaResuelta: boolean;
  decisionDuplicado: 'pendiente' | 'existente' | 'nueva'; excluido: boolean;
  existenteElegido?: ReferenciaExistente | null; // Omitir no selecciona un existente.
  fechaEditadaManualmente?: boolean; inicioVinculado?: string | null;
  notas: Nota[];
  /** Clase de la materia en la fecha elegida (POST /api/ia/revisar). undefined = aún no se revisó. */
  horaClase?: HoraClase | null;
  /** Días con clase de la materia elegida, según la última revisión. undefined = los del borrador. */
  diasClase?: number[];
  /** La hora salió de "Sí, es en horario de clase": al cambiar la fecha se vuelve a preguntar. */
  horaDeClase?: boolean;
  esperandoHoraClase?: boolean;
  tipoElegido?: boolean;
};
export type ResultadoConfirmacion = {
  creados: { tareas: string[]; eventos: string[]; clases: string[]; materias: { id: string; nombre: string }[] };
  omitidos: { indice: number; titulo: string; motivo: string }[];
};
function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('La respuesta del servidor no tiene el formato esperado.');
  return v as Record<string, unknown>;
}
function texto(v: unknown): string {
  if (typeof v !== 'string') throw new Error('Falta un texto en la respuesta del servidor.');
  return v;
}
function nullable(v: unknown): string | null { return v === null ? null : texto(v); }
function lista(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new Error('Falta una lista en la respuesta del servidor.');
  return v;
}
function textos(v: unknown): string[] { return lista(v).map(texto); }
function fecha(v: unknown): string {
  const s = texto(v);
  if (Number.isNaN(new Date(s).getTime())) throw new Error('El servidor devolvió una fecha inválida.');
  return s;
}
function fechaOpcional(v: unknown): string | null { return v === null ? null : fecha(v); }
function booleano(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error('Falta un indicador en la respuesta del servidor.');
  return v;
}
function numero(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('El servidor devolvió un número inválido.');
  return v;
}
/** Tolerante: descarta lo que no tenga categoría o texto válidos. */
function leerNotas(v: unknown): Nota[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const n = (x ?? {}) as Record<string, unknown>;
    const ok = (CATEGORIAS_NOTA as readonly string[]).includes(n.categoria as string) && typeof n.texto === 'string' && n.texto.trim();
    return ok ? [{ categoria: n.categoria as CategoriaNota, texto: (n.texto as string).trim() }] : [];
  });
}
function leerRazones(v: unknown): string[] {
  const r = v && typeof v === 'object' ? (v as Record<string, unknown>).razones : null;
  return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 3) : [];
}
function leerDiasClase(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : [];
}
function leerHoraClase(v: unknown): HoraClase | null {
  if (v == null) return null;
  const h = objeto(v);
  return { inicio: texto(h.inicio), fin: texto(h.fin), motivo: texto(h.motivo) };
}
/** Notas que vienen de "Añade algo más" (POST /api/ia/notas). */
export function leerNotasIA(v: unknown): Nota[] { return leerNotas(objeto(v).notas); }

function propuesta(v: unknown): PropuestaMateria {
  const p = objeto(v);
  if (p.accion === 'ninguna') return { accion: 'ninguna' };
  if (p.accion === 'crear') return { accion: 'crear', nombre: texto(p.nombre), codigo: nullable(p.codigo), clave: texto(p.clave) };
  if (p.accion === 'preguntar_nombre') return { accion: 'preguntar_nombre', codigo: texto(p.codigo) };
  if (p.accion === 'vincular') return {
    accion: 'vincular', materiaId: texto(p.materiaId), nombre: texto(p.nombre), seguro: booleano(p.seguro),
    alternativas: lista(p.alternativas).map((v) => { const a = objeto(v); return { id: texto(a.id), nombre: texto(a.nombre) }; }),
  };
  throw new Error('El servidor devolvió una propuesta de materia desconocida.');
}
function leerDuplicado(v: unknown): ItemExtraido['duplicado'] {
  if (v == null) return null;
  const d = objeto(v);
  const t = d.tarea ? objeto(d.tarea) : null;
  const e = d.evento ? objeto(d.evento) : null;
  return {
    tipoDuplicado: texto(d.tipoDuplicado), pregunta: texto(d.pregunta),
    sugerenciasDiferencia: d.sugerenciasDiferencia === undefined ? undefined : textos(d.sugerenciasDiferencia),
    diasExistentes: d.diasExistentes === undefined ? undefined : lista(d.diasExistentes).map(numero),
    tarea: t ? {
      id: texto(t.id), titulo: texto(t.titulo),
      fechaLimite: t.fechaLimite == null ? undefined : fecha(t.fechaLimite),
      horaDefinida: t.horaDefinida == null ? undefined : booleano(t.horaDefinida),
    } : undefined,
    evento: e ? { id: texto(e.id), titulo: texto(e.titulo), inicio: fecha(e.inicio) } : undefined,
    similitud: d.similitud === undefined ? undefined : numero(d.similitud),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Solo referencias persistidas provistas por el backend y del mismo tipo que el destino. */
export function referenciaDuplicado(item: ItemRevision): ReferenciaExistente | null {
  const duplicado = item.original.duplicado;
  const registro = item.clase === 'tarea' ? duplicado?.tarea : item.clase === 'evento' ? duplicado?.evento : null;
  if (!registro || !UUID.test(registro.id) || item.clase === 'evento_fijo') return null;
  return { clase: item.clase, id: registro.id };
}

function referenciaElegida(item: ItemRevision): ReferenciaExistente | null {
  const elegida = item.existenteElegido;
  const disponible = referenciaDuplicado(item);
  return item.excluido && item.decisionDuplicado === 'existente' && elegida && disponible &&
    elegida.clase === disponible.clase && elegida.id === disponible.id ? disponible : null;
}

/** Sin datos reales completos no se puede asegurar la fecha inicial de una relación persistida. */
function fechaDelDestino(item: ItemRevision): { inicio: string; horaDefinida: boolean } | null {
  if (!item.excluido) {
    const inicio = inicioDe(item);
    return item.clase !== 'evento_fijo' && item.fechaElegida && item.propuestaResuelta && inicio
      ? { inicio, horaDefinida: item.horaDefinida } : null;
  }
  const elegida = referenciaElegida(item);
  if (elegida?.clase === 'tarea') {
    const t = item.original.duplicado?.tarea;
    return t?.fechaLimite && typeof t.horaDefinida === 'boolean'
      ? { inicio: t.fechaLimite, horaDefinida: t.horaDefinida } : null;
  }
  const e = elegida?.clase === 'evento' ? item.original.duplicado?.evento : null;
  return e ? { inicio: e.inicio, horaDefinida: true } : null;
}

export function leerBorrador(v: unknown): Borrador {
  const b = objeto(v);
  const p = b.periodo === null ? null : objeto(b.periodo);
  const originales = lista(b.items);
  return {
    interpretacionId: texto(b.interpretacionId), advertencias: textos(b.advertencias),
    periodo: p ? { nombre: texto(p.nombre), inicio: fecha(p.inicio), fin: fecha(p.fin) } : null,
    items: originales.map((v, indice) => {
      const i = objeto(v);
      if (i.clase !== 'tarea' && i.clase !== 'evento' && i.clase !== 'evento_fijo') throw new Error('Clase de actividad desconocida.');
      const venceCon = i.venceCon == null ? null : numero(i.venceCon);
      if (venceCon !== null && (!Number.isInteger(venceCon) || venceCon < 0 ||
          venceCon >= originales.length || venceCon === indice)) {
        throw new Error('El servidor devolvió un vínculo de actividad inválido.');
      }
      const h = i.horaPropuesta === null ? null : objeto(i.horaPropuesta);
      const vg = i.vigencia === null ? null : objeto(i.vigencia);
      return {
        estimado: i.clase === 'tarea' ? leerEstimado(i.estimado) : null,
        razones: i.clase === 'tarea' ? leerRazones(i.estimado) : [],
        tipoSeguro: typeof i.tipoSeguro === 'boolean' ? i.tipoSeguro : true,
        notas: leerNotas(i.notas),
        diasClase: leerDiasClase(i.diasClase),
        origen: typeof i.origen === 'string' && i.origen.trim() ? i.origen : typeof i.evidencia === 'string' && i.evidencia.trim() ? i.evidencia : null,
        clase: i.clase, titulo: texto(i.titulo), tipo: nullable(i.tipo), fechaDicha: i.fechaDicha, venceCon,
        hora: nullable(i.hora), horaFin: nullable(i.horaFin), diasSemana: lista(i.diasSemana).map(numero),
        materia: nullable(i.materia), codigoMateria: nullable(i.codigoMateria), descripcion: nullable(i.descripcion),
        ubicacion: nullable(i.ubicacion), confianza: numero(i.confianza), evidencia: texto(i.evidencia),
        inicio: fechaOpcional(i.inicio), fin: fechaOpcional(i.fin), horaDefinida: booleano(i.horaDefinida),
        supuestos: textos(i.supuestos), faltantes: textos(i.faltantes),
        opcionesFecha: i.opcionesFecha === null ? null : lista(i.opcionesFecha).map((v) => {
          const o = objeto(v); return { etiqueta: texto(o.etiqueta), fecha: fecha(o.fecha) };
        }),
        materiaPropuesta: propuesta(i.materiaPropuesta),
        horaPropuesta: h ? leerHoraClase(h) : null,
        vigencia: vg ? { desde: fecha(vg.desde), hasta: fecha(vg.hasta), periodo: texto(vg.periodo) } : null,
        duplicado: leerDuplicado(i.duplicado),
        choques: lista(i.choques).map((v) => { const c = objeto(v); return { titulo: texto(c.titulo), cuando: texto(c.cuando) }; }),
      };
    }),
  };
}
export function leerMaterias(v: unknown): MateriaUsuario[] {
  return lista(objeto(v).materias).map((v) => {
    const m = objeto(v); return { id: texto(m.id), nombre: texto(m.nombre), codigo: nullable(m.codigo) };
  });
}
export function leerResultado(v: unknown): ResultadoConfirmacion {
  const r = objeto(v), c = objeto(r.creados);
  return {
    creados: {
      tareas: textos(c.tareas), eventos: textos(c.eventos), clases: textos(c.clases),
      materias: lista(c.materias).map((v) => { const m = objeto(v); return { id: texto(m.id), nombre: texto(m.nombre) }; }),
    },
    omitidos: lista(r.omitidos).map((v) => {
      const o = objeto(v); return { indice: numero(o.indice), titulo: texto(o.titulo), motivo: texto(o.motivo) };
    }),
  };
}
export function mensajeBackend(v: unknown, respaldo: string): string {
  if (!v || typeof v !== 'object') return respaldo;
  const o = v as Record<string, unknown>;
  const mensajes = ['error', 'mensaje', 'pregunta', 'motivo'].flatMap((clave) =>
    typeof o[clave] === 'string' && o[clave] ? [o[clave] as string] : []);
  return [...new Set(mensajes)].join('\n') || respaldo;
}
const horaBolivia = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function diaISO(iso: string): string { return diaEnBolivia(new Date(iso)); }
export function horaISO(iso: string): string { return horaBolivia.format(new Date(iso)); }
export function crearRevision(i: ItemExtraido): ItemRevision {
  const p = i.materiaPropuesta;
  const materia: MateriaElegida = p.accion === 'vincular' ? { accion: 'vincular', materiaId: p.materiaId }
    : p.accion === 'crear' ? { accion: 'crear', nombre: p.nombre, codigo: p.codigo }
    : p.accion === 'preguntar_nombre' ? { accion: 'crear', nombre: '', codigo: p.codigo } : { accion: 'ninguna' };
  return {
    original: i, titulo: i.titulo, clase: i.clase, tipo: i.tipo ?? 'tarea',
    fecha: i.inicio ? diaISO(i.inicio) : '', hora: i.horaDefinida ? i.hora ?? (i.inicio ? horaISO(i.inicio) : '') : '',
    horaDefinida: i.horaDefinida, fechaFin: i.fin ? diaISO(i.fin) : i.inicio ? diaISO(i.inicio) : '',
    horaFin: i.horaFin ?? (i.fin ? horaISO(i.fin) : ''), diasSemana: [...i.diasSemana],
    ubicacion: i.ubicacion ?? '', descripcion: i.descripcion ?? '', materia,
    grupoMateria: p.accion === 'crear' ? p.clave : p.accion === 'preguntar_nombre' ? 'codigo:' + p.codigo.toLowerCase().replace(/[^a-z0-9]/g, '') : null,
    vigenciaDesde: i.vigencia ? diaISO(i.vigencia.desde) : '', vigenciaHasta: i.vigencia ? diaISO(i.vigencia.hasta) : '',
    fechaElegida: !i.opcionesFecha?.length, propuestaResuelta: !i.horaPropuesta,
    decisionDuplicado: i.duplicado && i.clase === 'tarea' ? 'pendiente' : 'existente', excluido: false,
    notas: i.notas.map((n) => ({ ...n })), horaClase: undefined, horaDeClase: false, esperandoHoraClase: false,
    tipoElegido: i.tipoSeguro,
  };
}
/** La pregunta de hora vigente: la de la revisión (si ya hubo) o la del borrador inicial. */
export function propuestaHora(i: ItemRevision): HoraClase | null {
  return i.horaClase !== undefined ? i.horaClase : i.original.horaPropuesta;
}
export function diasClaseDe(i: ItemRevision): number[] {
  return i.diasClase ?? i.original.diasClase;
}
export function actualizarRevision(items: ItemRevision[], indice: number, cambios: Partial<ItemRevision>): ItemRevision[] {
  const anterior = items[indice];
  const editaFecha = ['fecha', 'hora', 'horaDefinida'].some((campo) => campo in cambios);
  const limpiaExistente = 'clase' in cambios || ('excluido' in cambios && !cambios.existenteElegido) || cambios.decisionDuplicado === 'nueva';
  const siguiente = { ...anterior, ...cambios,
    ...(limpiaExistente ? { existenteElegido: null } : {}),
    ...(editaFecha ? { fechaEditadaManualmente: true, inicioVinculado: null } : {}),
  };
  const revisados = items.map((item, posicion) => {
    if (posicion === indice) return siguiente;
    if (anterior.grupoMateria && item.grupoMateria === anterior.grupoMateria &&
        cambios.materia?.accion === 'crear' && item.materia.accion === 'crear') {
      return { ...item, materia: { ...cambios.materia } };
    }
    return item;
  });
  return sincronizarFechasVinculadas(revisados);
}

/** Conserva la misma fecha/hora que el destino, sin sobrescribir una edición manual. */
export function sincronizarFechasVinculadas(items: ItemRevision[]): ItemRevision[] {
  const resueltos = new Map<number, ItemRevision>();
  const visitando = new Set<number>();
  function resolver(indice: number): ItemRevision {
    const item = items[indice];
    const listo = resueltos.get(indice);
    if (listo) return listo;
    if (visitando.has(indice)) return item;
    visitando.add(indice);
    let siguiente = item;
    const referencia = item.original.venceCon;
    if (!item.excluido && item.clase === 'tarea' && !item.fechaEditadaManualmente &&
        referencia != null && referencia !== indice && items[referencia]) {
      const destino = resolver(referencia);
      const fechaDestino = fechaDelDestino(destino);
      if (fechaDestino) {
        const { inicio, horaDefinida } = fechaDestino;
        siguiente = {
          ...item, fecha: diaISO(inicio), hora: horaDefinida ? horaISO(inicio) : '',
          horaDefinida, inicioVinculado: inicio, fechaElegida: true, propuestaResuelta: true,
        };
      }
    }
    visitando.delete(indice);
    resueltos.set(indice, siguiente);
    return siguiente;
  }
  return items.map((_, indice) => resolver(indice));
}

/** No se envía venceCon: confirmar lo recupera del borrador original mediante indice. */
export function problemasVinculos(items: ItemRevision[]): string[] {
  return items.flatMap((item, indice) => {
    const referencia = item.original.venceCon;
    if (item.excluido || referencia == null) return [];
    const destino = items[referencia];
    const pre = `Actividad ${indice + 1} («${item.titulo}»): `;
    if (!destino || referencia === indice) return [pre + 'el vínculo no tiene un destino válido. Omite esta actividad.'];
    if (destino.excluido && !referenciaElegida(destino)) {
      return [pre + 'El destino está omitido sin una referencia existente válida elegida. Vuelve a incluirlo o elige usar su existente.'];
    }
    if (item.clase !== 'tarea' || destino.clase === 'evento_fijo') {
      return [pre + 'este vínculo requiere una tarea y un destino de tipo tarea o evento. Revisa los tipos o deja la actividad vinculada para después.'];
    }
    const vistos = new Set<number>([indice]);
    let siguiente: number | null = referencia;
    while (siguiente != null && items[siguiente]) {
      if (vistos.has(siguiente)) return [pre + 'los vínculos forman un ciclo. Deja esta actividad para después.'];
      vistos.add(siguiente);
      siguiente = items[siguiente].original.venceCon;
    }
    const fechaDestino = fechaDelDestino(destino);
    if (destino.excluido && !fechaDestino) {
      return [pre + 'Faltan la fecha o la indicación de hora del destino existente. No se puede vincular de forma segura.'];
    }
    const inicio = inicioDe(item), inicioDestino = fechaDestino?.inicio;
    if (inicio && inicioDestino && (+new Date(inicio) !== +new Date(inicioDestino) ||
        item.horaDefinida !== fechaDestino?.horaDefinida)) {
      return [pre + `debe vencer al empezar «${destino.titulo}». Revisa ambas fechas y horas; tus cambios manuales se conservaron.`];
    }
    return [];
  });
}

function esHora(h: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(h); }
const horaInterna: Record<string, string> = { examen: '08:00', exposicion: '08:00', entrega: '23:59', tarea: '23:59', proyecto: '23:59' };
function inicioDe(i: ItemRevision): string | null {
  if (i.inicioVinculado && !i.fechaEditadaManualmente) return i.inicioVinculado;
  // Conservar el instante exacto recibido si no se editaron su fecha ni su hora.
  if (i.original.inicio && i.fecha === diaISO(i.original.inicio) &&
      i.horaDefinida === i.original.horaDefinida &&
      (!i.horaDefinida || i.hora === horaISO(i.original.inicio))) {
    return i.original.inicio;
  }
  // Sin hora: conservar el valor de almacenamiento del backend, nunca presentarlo como una hora confirmada.
  const interna = i.original.inicio ? horaISO(i.original.inicio)
    : i.original.opcionesFecha?.[0] ? horaISO(i.original.opcionesFecha[0].fecha) : horaInterna[i.tipo] ?? '23:59';
  return fechaElegidaISO(i.fecha + 'T' + (i.horaDefinida ? i.hora : interna));
}
function finDe(i: ItemRevision): string | null {
  if (i.original.fin && (i.fechaFin || i.fecha) === diaISO(i.original.fin) &&
      i.horaFin === horaISO(i.original.fin)) {
    return i.original.fin;
  }
  return i.horaFin ? fechaElegidaISO((i.fechaFin || i.fecha) + 'T' + i.horaFin) : null;
}
export function problemasItem(i: ItemRevision): string[] {
  if (i.excluido) return [];
  const problemas: string[] = [];
  if (!i.titulo.trim() || i.titulo.trim().length > 200) problemas.push('El título debe tener entre 1 y 200 caracteres.');
  if (i.materia.accion === 'crear' && (!i.materia.nombre.trim() || i.materia.nombre.trim().length > 100)) problemas.push('Indica el nombre de la materia (máximo 100 caracteres).');
  if (i.materia.accion === 'vincular' && !i.materia.materiaId) problemas.push('Elige una materia.');
  if (i.clase === 'evento_fijo') {
    if (!i.diasSemana.length || i.diasSemana.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) problemas.push('Elige los días de clase.');
    if (!esHora(i.hora) || !esHora(i.horaFin) || i.horaFin <= i.hora) problemas.push('Indica un horario de clase válido, con fin posterior al inicio.');
    if (i.vigenciaDesde || i.vigenciaHasta) {
      const desde = fechaElegidaISO(i.vigenciaDesde + 'T00:00');
      const hasta = fechaElegidaISO(i.vigenciaHasta + 'T23:59');
      if (!desde || !hasta || hasta <= desde) problemas.push('Completa ambas fechas de vigencia, con fin posterior al inicio.');
    }
  } else {
    if (!i.fecha || !inicioDe(i)) problemas.push('¿Para cuándo es? Indica una fecha válida.');
    if (!i.fechaElegida) problemas.push('Elige una de las fechas propuestas o indica otra fecha.');
    if (i.horaDefinida && !esHora(i.hora)) problemas.push('Indica una hora válida.');
    if (!i.propuestaResuelta) problemas.push(propuestaHora(i) ? 'Responde si es en horario de clase.' : 'Elige la hora o marca «Hora por definir».');
    if (i.clase === 'evento') {
      if (!i.horaDefinida || !esHora(i.hora)) problemas.push('Confirma la hora del evento.');
      if (i.horaFin && (!finDe(i) || !inicioDe(i) || new Date(finDe(i)!) <= new Date(inicioDe(i)!))) problemas.push('El fin del evento debe ser posterior al inicio.');
      if (i.fechaFin && i.fechaFin !== i.fecha && !i.horaFin) problemas.push('Indica la hora de fin del evento o deja su fecha de fin vacía.');
    } else {
      if (!(tiposTarea as readonly string[]).includes(i.tipo)) problemas.push('Elige un tipo de tarea válido.');
      if (i.original.duplicado && i.decisionDuplicado === 'pendiente') problemas.push('Decide si es la actividad existente o una nueva.');
    }
  }
  return problemas;
}
/** indice = posición en el borrador: el backend recupera con él la estimación y el vínculo "vence con". */
function itemParaEnvio(i: ItemRevision, indice: number, existente: ReferenciaExistente | null = null) {
  const comunes = { clase: i.clase, titulo: i.titulo.trim(), materia: i.materia, materiaDetectada: i.original.materia, indice };
  if (i.clase === 'tarea') return {
    ...comunes, clase: 'tarea' as const, tipo: i.tipo, inicio: inicioDe(i)!,
    horaDefinida: i.horaDefinida, descripcion: null, notas: i.notas,
    confirmarNueva: i.decisionDuplicado === 'nueva',
    ...(existente ? { venceConExistente: { clase: existente.clase, id: existente.id } } : {}),
  };
  if (i.clase === 'evento') return {
    ...comunes, clase: 'evento' as const, inicio: inicioDe(i)!, fin: finDe(i),
    ubicacion: i.ubicacion || null, descripcion: null, notas: i.notas,
  };
  // Conservar los instantes exactos de la vigencia propuesta cuando no se editaron.
  const original = i.original.vigencia;
  const intacta = original && i.vigenciaDesde === diaISO(original.desde) && i.vigenciaHasta === diaISO(original.hasta);
  return {
    ...comunes, clase: 'evento_fijo' as const, diasSemana: i.diasSemana, hora: i.hora, horaFin: i.horaFin,
    ubicacion: i.ubicacion || null,
    vigencia: intacta ? { desde: original.desde, hasta: original.hasta }
      : i.vigenciaDesde && i.vigenciaHasta ? {
        desde: fechaElegidaISO(i.vigenciaDesde + 'T00:00')!, hasta: fechaElegidaISO(i.vigenciaHasta + 'T23:59')!,
      } : null,
  };
}

export function construirConfirmacion(interpretacionId: string, items: ItemRevision[], fueCorregida: boolean) {
  items = sincronizarFechasVinculadas(items);
  const incluidos = items.filter((i) => !i.excluido);
  if (!incluidos.length || incluidos.length > 20) throw new Error('Incluye entre 1 y 20 actividades para confirmar.');
  const errores = [...incluidos.flatMap(problemasItem), ...problemasVinculos(items)];
  if (errores.length) throw new Error(errores.join('\n'));
  return {
    interpretacionId, fueCorregida,
    items: items.flatMap((item, indice) => {
      if (item.excluido) return [];
      const destino = item.original.venceCon == null ? null : items[item.original.venceCon];
      return [itemParaEnvio(item, indice, destino ? referenciaElegida(destino) : null)];
    }),
  };
}

export type ResultadoRevision = { indice: number } & (
  | { duplicado: ItemExtraido['duplicado']; choques: ItemExtraido['choques']; horaClase?: HoraClase | null; diasClase?: number[] }
  | { error: string }
);

export function construirSolicitudRevision(items: ItemRevision[]) {
  const indices = items.flatMap((item, indice) => item.excluido ? [] : [indice]);
  if (!indices.length || indices.length > 20) throw new Error('Incluye entre 1 y 20 actividades para revisar.');
  // El backend devuelve un error por ítem incompleto sin impedir revisar los demás.
  return { indices, body: { items: indices.map((indice) => itemParaEnvio(items[indice], indice)) } };
}

export function leerRevisionCalculada(valor: unknown, cantidad: number): ResultadoRevision[] {
  const resultados = lista(objeto(valor).items);
  if (resultados.length !== cantidad) throw new Error('La revisión no incluye todas las actividades enviadas.');
  const vistos = new Set<number>();
  return resultados.map((valor) => {
    const resultado = objeto(valor);
    const indice = numero(resultado.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= cantidad || vistos.has(indice)) {
      throw new Error('La revisión contiene una actividad no válida o repetida.');
    }
    vistos.add(indice);
    if ('error' in resultado) return { indice, error: texto(resultado.error) };
    const duplicado = leerDuplicado(resultado.duplicado);
    const choques = lista(resultado.choques).map((valor) => {
      const choque = objeto(valor);
      return { titulo: texto(choque.titulo), cuando: texto(choque.cuando) };
    });
    return {
      indice, duplicado, choques,
      ...('horaClase' in resultado ? { horaClase: leerHoraClase(resultado.horaClase) } : {}),
      ...(Array.isArray(resultado.diasClase) ? { diasClase: leerDiasClase(resultado.diasClase) } : {}),
    };
  });
}

export function aplicarRevisionCalculada(
  items: ItemRevision[], indices: number[], resultados: ResultadoRevision[],
): ItemRevision[] {
  const porIndice = new Map(resultados.map((resultado) => [indices[resultado.indice], resultado]));
  return items.map((item, indice) => {
    const resultado = porIndice.get(indice);
    if (!resultado) return item;
    if ('error' in resultado) return item.esperandoHoraClase ? { ...item, esperandoHoraClase: false, horaClase: null } : item;
    if (item.excluido) return item;
    const { duplicado, choques } = resultado;
    const hora = resultado.horaClase !== undefined
      ? { horaClase: resultado.horaClase, esperandoHoraClase: false } : item.esperandoHoraClase ? { esperandoHoraClase: false } : {};
    const mismaTarea = duplicado?.tarea?.id && duplicado.tarea.id === item.original.duplicado?.tarea?.id;
    return {
      ...item, ...hora, ...(resultado.diasClase ? { diasClase: resultado.diasClase } : {}),
      original: { ...item.original, duplicado, choques },
      // Una decisión sobre otra tarea duplicada necesita una nueva confirmación del usuario.
      decisionDuplicado: item.clase !== 'tarea' ? item.decisionDuplicado
        : !duplicado ? 'existente' : mismaTarea ? item.decisionDuplicado : 'pendiente',
    };
  });
}

export function aplicarPeriodoARevision(
  items: ItemRevision[], periodo: PeriodoAcademico, ahora = new Date(),
): ItemRevision[] {
  if (!esPeriodoActual(periodo, ahora)) return items;
  return items.map((item) => {
    if (item.clase !== 'evento_fijo' || !item.original.faltantes.includes('periodo') || item.original.vigencia) return item;
    const tieneFechasPropias = !!(item.vigenciaDesde || item.vigenciaHasta);
    return {
      ...item,
      original: {
        ...item.original,
        faltantes: item.original.faltantes.filter((faltante) => faltante !== 'periodo'),
        vigencia: { desde: periodo.inicio, hasta: periodo.fin, periodo: periodo.nombre },
      },
      vigenciaDesde: tieneFechasPropias ? item.vigenciaDesde : diaISO(periodo.inicio),
      vigenciaHasta: tieneFechasPropias ? item.vigenciaHasta : diaISO(periodo.fin),
    };
  });
}
