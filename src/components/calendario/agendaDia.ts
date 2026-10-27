import type { PrioridadCalculada } from '@/tipos/tarea';
import { diaEnBolivia } from './organizarTareasDia';

type MateriaAgenda = { nombre: string; color: string } | null;
export type TareaAgenda = {
  id: string; titulo: string; tipo: string; prioridad: string; estado: string;
  fechaLimite: Date; completadaEn: Date | null; horaDefinida: boolean;
  materia: MateriaAgenda;
};
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
export type AgendaDia = { tareas: TareaAgenda[]; clases: ClaseAgenda[]; eventos: EventoAgenda[] };

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
function leerTarea(valor: unknown): TareaAgenda {
  const datos = registro(valor);
  if (typeof datos.horaDefinida !== 'boolean') throw new Error('La tarea no indica si su hora está definida.');
  return {
    id: texto(datos.id), titulo: texto(datos.titulo), tipo: texto(datos.tipo),
    prioridad: texto(datos.prioridad), estado: texto(datos.estado),
    fechaLimite: fecha(datos.fechaLimite), completadaEn: fechaOpcional(datos.completadaEn),
    horaDefinida: datos.horaDefinida, materia: materia(datos.materia),
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
    tareas: lista(datos.tareas).map(leerTarea),
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
  // Conservar las adicionales para las secciones de vencidas y próximas.
  const porId = new Map<string, TareaAgenda & { prioridadCalculada?: PrioridadCalculada }>(
    priorizadas.map((tarea) => [tarea.id, tarea]),
  );
  let sinPrioridad = 0;
  for (const tarea of agenda) {
    const prioridadCalculada = porId.get(tarea.id)?.prioridadCalculada;
    if (!prioridadCalculada) sinPrioridad++;
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
    eventos: agenda.eventos.filter((evento) =>
      evento.inicio < fin && (evento.fin ? evento.fin > inicio : evento.inicio >= inicio))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
  };
}
