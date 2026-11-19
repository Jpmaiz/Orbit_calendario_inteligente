import { leerEstimacionTarea } from '../estimacion/estimacionFrontend';
import type { EstimacionTarea, PrioridadCalculada } from '@/tipos/tarea';
import { diaEnBolivia } from './organizarTareasDia';
import { CATEGORIAS_NOTA, type CategoriaNota, type Nota } from '../ia/borradorCaptura';

type MateriaAgenda = { nombre: string; color: string } | null;
/** v2.12: resumen de TODOS los bloques del plan de la tarea (no solo los del rango pedido). */
export type PlanTarea = { bloques: number; minutos: number; proximo: Date | null };
export type TareaAgenda = EstimacionTarea & {
  id: string; titulo: string; tipo: string; prioridad: string; estado: string;
  fechaLimite: Date; completadaEn: Date | null; horaDefinida: boolean;
  materia: MateriaAgenda;
  notas: Nota[];
  /** null = sin plan. */
  plan?: PlanTarea | null;
  /** Lo que DURA un examen o exposición (no las horas de estudio). null si no se sabe. */
  duracionMin?: number | null;
};
/** v2.12–2.13: el horario de estudio («Mi ritmo») que usa Orbit para huecos y horas libres. */
export type VentanaAgenda = { desde: string; hasta: string; diasLibres: number[] };
export type TareaDia = TareaAgenda & { prioridadCalculada: PrioridadCalculada };
export type ClaseAgenda = {
  id: string; titulo: string; diaSemana: number; horaInicio: string; horaFin: string;
  vigenteDesde: Date | null; vigenteHasta: Date | null;
  ubicacion: string | null; materia: MateriaAgenda;
};
export type EventoAgenda = {
  id: string; titulo: string; inicio: Date; fin: Date | null;
  ubicacion: string | null; descripcion: string | null; materia: MateriaAgenda;
};
export type BloqueEstudioAgenda = {
  id: string; inicio: Date; fin: Date; tipo: 'estudio' | 'repaso'; estado: string;
  tarea: { id: string; titulo: string; tipo: string; materia: MateriaAgenda };
};
export type AgendaDia = {
  tareas: TareaAgenda[]; clases: ClaseAgenda[]; eventos: EventoAgenda[]; bloques: BloqueEstudioAgenda[];
  ventana?: VentanaAgenda;
};

function registro(valor: unknown): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new Error('La respuesta contiene datos no válidos.');
  }
  return valor as Record<string, unknown>;
}
function texto(valor: unknown): string {
  if (typeof valor !== 'string') throw new Error('Falta un texto en la respuesta.');
  return valor;
}
function numero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new Error('La respuesta contiene un número no válido.');
  return valor;
}
function fecha(valor: unknown): Date {
  const resultado = new Date(texto(valor));
  if (Number.isNaN(resultado.getTime())) throw new Error('La respuesta contiene una fecha no válida.');
  return resultado;
}
function fechaOpcional(valor: unknown): Date | null { return valor === null ? null : fecha(valor); }
function textoOpcional(valor: unknown): string | null { return valor === null ? null : texto(valor); }
function lista(valor: unknown): unknown[] {
  if (!Array.isArray(valor)) throw new Error('Falta una lista en la respuesta.');
  return valor;
}
function materia(valor: unknown): MateriaAgenda {
  if (valor === null) return null;
  const datos = registro(valor);
  return { nombre: texto(datos.nombre), color: texto(datos.color) };
}
/** Tolerante: null (nunca tuvo notas) o lo que no sea válido → lista vacía. */
function leerNotas(valor: unknown): Nota[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((v) => {
    const n = (v ?? {}) as Record<string, unknown>;
    return (CATEGORIAS_NOTA as readonly string[]).includes(n.categoria as string) && typeof n.texto === 'string' && n.texto.trim()
      ? [{ categoria: n.categoria as CategoriaNota, texto: n.texto.trim() }] : [];
  });
}
/** Tolerantes: si el back todavía no los manda, quedan en null o sin ventana. */
function leerPlanTarea(valor: unknown): PlanTarea | null {
  if (!valor || typeof valor !== 'object') return null;
  const p = valor as Record<string, unknown>;
  const bloques = typeof p.bloques === 'number' && Number.isFinite(p.bloques) ? p.bloques : 0;
  const minutos = typeof p.minutos === 'number' && Number.isFinite(p.minutos) ? p.minutos : 0;
  const proximo = typeof p.proximo === 'string' && !Number.isNaN(Date.parse(p.proximo)) ? new Date(p.proximo) : null;
  return bloques > 0 ? { bloques, minutos, proximo } : null;
}
function leerVentana(valor: unknown): VentanaAgenda | undefined {
  if (!valor || typeof valor !== 'object') return undefined;
  const v = valor as Record<string, unknown>;
  const hora = (x: unknown) => typeof x === 'string' && /^\d{2}:\d{2}$/.test(x);
  if (!hora(v.desde) || !hora(v.hasta)) return undefined;
  const diasLibres = Array.isArray(v.diasLibres) ? v.diasLibres.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : [];
  return { desde: v.desde as string, hasta: v.hasta as string, diasLibres };
}
function leerTarea(valor: unknown): TareaAgenda {
  const datos = registro(valor);
  if (typeof datos.horaDefinida !== 'boolean') throw new Error('La tarea no indica si su hora está definida.');
  return {
    ...leerEstimacionTarea(datos),
    id: texto(datos.id), titulo: texto(datos.titulo), tipo: texto(datos.tipo),
    prioridad: texto(datos.prioridad), estado: texto(datos.estado),
    fechaLimite: fecha(datos.fechaLimite), completadaEn: fechaOpcional(datos.completadaEn),
    horaDefinida: datos.horaDefinida, materia: materia(datos.materia), notas: leerNotas(datos.notas),
    plan: leerPlanTarea(datos.plan),
    duracionMin: typeof datos.duracionMin === 'number' && datos.duracionMin > 0 && datos.duracionMin <= 600 ? datos.duracionMin : null,
  };
}
function leerPrioridad(valor: unknown): PrioridadCalculada {
  const datos = registro(valor);
  const desglose = registro(datos.desglose);
  const nivel = datos.nivel;
  if (nivel !== 'vencida' && nivel !== 'critica' && nivel !== 'alta' &&
      nivel !== 'media' && nivel !== 'baja' && nivel !== 'ninguna') {
    throw new Error('La tarea no incluye un nivel de prioridad válido.');
  }
  const origenHoras = desglose.origenHoras;
  if (origenHoras !== 'estimada' && origenHoras !== 'por_tipo') {
    throw new Error('La tarea no incluye un origen de horas válido.');
  }
  return {
    nivel, puntaje: numero(datos.puntaje), horasNecesarias: numero(datos.horasNecesarias),
    holguraDias: numero(datos.holguraDias), horasPorDia: numero(datos.horasPorDia),
    fechaInicioSugerida: textoOpcional(datos.fechaInicioSugerida),
    sobrecargaHoras: numero(datos.sobrecargaHoras), mensaje: texto(datos.mensaje),
    // Misma base que el chip de horas: "te queda ~X libre, te faltarían ~Y" (v2.9).
    ...(typeof datos.horasLibres === 'number' && Number.isFinite(datos.horasLibres) ? { horasLibres: datos.horasLibres } : {}),
    ...(typeof datos.faltanHoras === 'number' && Number.isFinite(datos.faltanHoras) ? { faltanHoras: datos.faltanHoras } : {}),
    desglose: {
      origenHoras, urgencia: numero(desglose.urgencia), importancia: numero(desglose.importancia),
      horasBase: numero(desglose.horasBase), factorColchon: numero(desglose.factorColchon),
      horasOtrasTareas: numero(desglose.horasOtrasTareas),
    },
  };
}
export function leerTareasConPrioridad(valor: unknown): TareaDia[] {
  return lista(registro(valor).tareas).map((valor) => ({
    ...leerTarea(valor), prioridadCalculada: leerPrioridad(registro(valor).prioridadCalculada),
  }));
}
function hora(valor: unknown): string {
  const resultado = texto(valor);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(resultado)) throw new Error('La clase contiene una hora no válida.');
  return resultado;
}
export function leerAgenda(valor: unknown): AgendaDia {
  const datos = registro(valor);
  // El endpoint interpreta el rango en la zona del perfil, no admite una zona en el query.
  if (datos.zonaHoraria !== 'America/La_Paz') {
    throw new Error('La zona horaria de tu perfil debe ser America/La_Paz para mostrar esta vista.');
  }
  return {
    ventana: leerVentana(datos.ventana),
    tareas: lista(datos.tareas).map(leerTarea),
    bloques: (datos.bloques === undefined ? [] : lista(datos.bloques)).map((valor): BloqueEstudioAgenda => {
      const bloque = registro(valor), tarea = registro(bloque.tarea);
      const inicio = fecha(bloque.inicio), fin = fecha(bloque.fin);
      if (fin <= inicio) throw new Error('El bloque de estudio tiene un intervalo inválido.');
      if (bloque.tipo !== 'estudio' && bloque.tipo !== 'repaso') throw new Error('Tipo de bloque de estudio desconocido.');
      return {
        id: texto(bloque.id), inicio, fin, tipo: bloque.tipo, estado: texto(bloque.estado),
        tarea: {
          id: texto(tarea.id), titulo: texto(tarea.titulo), tipo: texto(tarea.tipo), materia: materia(tarea.materia),
        },
      };
    }),
    clases: lista(datos.clases).map((valor) => {
      const clase = registro(valor);
      const diaSemana = numero(clase.diaSemana);
      if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) throw new Error('La clase contiene un día no válido.');
      return {
        id: texto(clase.id), titulo: texto(clase.titulo), diaSemana,
        horaInicio: hora(clase.horaInicio), horaFin: hora(clase.horaFin),
        vigenteDesde: fechaOpcional(clase.vigenteDesde), vigenteHasta: fechaOpcional(clase.vigenteHasta),
        ubicacion: textoOpcional(clase.ubicacion), materia: materia(clase.materia),
      };
    }),
    eventos: lista(datos.eventos).map((valor) => {
      const evento = registro(valor);
      return {
        id: texto(evento.id), titulo: texto(evento.titulo), inicio: fecha(evento.inicio),
        fin: fechaOpcional(evento.fin), ubicacion: textoOpcional(evento.ubicacion),
        descripcion: textoOpcional(evento.descripcion), materia: materia(evento.materia),
      };
    }),
  };
}
export function combinarTareas(agenda: readonly TareaAgenda[], priorizadas: readonly TareaDia[]) {
  // Conservar las adicionales para las secciones de próximas y "Ya pasaron".
  const porId = new Map<string, TareaAgenda & { prioridadCalculada?: PrioridadCalculada }>(
    priorizadas.map((tarea) => [tarea.id, tarea]),
  );
  let sinPrioridad = 0;
  for (const tarea of agenda) {
    const prioridadCalculada = porId.get(tarea.id)?.prioridadCalculada;
    // Lo que ya pasó ("Ya pasaron") no lleva prioridad: no cuenta como faltante.
    if (!prioridadCalculada && (tarea.estado === 'pendiente' || tarea.estado === 'en_proceso') && tarea.fechaLimite > new Date()) sinPrioridad++;
    // Los datos de agenda prevalecen; la prioridad solo se adjunta si se obtuvo.
    porId.set(tarea.id, { ...tarea, prioridadCalculada });
  }
  return { tareas: [...porId.values()], sinPrioridad };
}
export function horarioDelDia(agenda: AgendaDia, fechaActual: Date) {
  const hoy = diaEnBolivia(fechaActual);
  const inicio = new Date(hoy + 'T00:00:00-04:00');
  const fin = new Date(inicio.getTime() + 86_400_000);
  const diaSemana = new Date(hoy + 'T12:00:00Z').getUTCDay() || 7;
  return {
    clases: agenda.clases.filter((clase) =>
      clase.diaSemana === diaSemana &&
      (!clase.vigenteDesde || clase.vigenteDesde < fin) &&
      (!clase.vigenteHasta || clase.vigenteHasta >= inicio))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    bloques: agenda.bloques.filter((bloque) => bloque.inicio < fin && bloque.fin > inicio)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
    eventos: agenda.eventos.filter((evento) =>
      evento.inicio < fin && (evento.fin ? evento.fin > inicio : evento.inicio >= inicio))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
  };
}
