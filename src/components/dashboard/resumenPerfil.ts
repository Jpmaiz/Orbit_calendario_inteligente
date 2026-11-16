import type { AgendaDia } from '../calendario/agendaDia';
import { inicioDiaBolivia, organizarSemana, sumarDias } from '../calendario/agendaSemana';
import { formatearHoras } from '../estimacion/estimacionFrontend';

export type MateriaPerfil = { id: string; nombre: string; color: string };

export function leerMateriasPerfil(valor: unknown): MateriaPerfil[] {
  if (!valor || typeof valor !== 'object' || !('materias' in valor) || !Array.isArray(valor.materias)) {
    throw new Error('No se pudieron leer las materias.');
  }
  return valor.materias.map((materia: unknown) => {
    if (!materia || typeof materia !== 'object' ||
        !('id' in materia) || typeof materia.id !== 'string' ||
        !('nombre' in materia) || typeof materia.nombre !== 'string' ||
        !('color' in materia) || typeof materia.color !== 'string') {
      throw new Error('No se pudieron leer las materias.');
    }
    return { id: materia.id, nombre: materia.nombre, color: materia.color };
  });
}

export function resumirSemana(agenda: AgendaDia, lunes: string) {
  const actividades = new Set<string>();
  for (const dia of organizarSemana(agenda, lunes)) {
    for (const bloque of dia.bloques) {
      // Las clases son ocurrencias semanales; los eventos de varios días cuentan una vez.
      actividades.add(bloque.tipo === 'clase' ? dia.fecha + ':' + bloque.id : bloque.id);
    }
    for (const tarea of dia.sinHora) actividades.add('tarea-' + tarea.id);
  }
  const inicio = inicioDiaBolivia(lunes).getTime();
  const fin = inicioDiaBolivia(sumarDias(lunes, 7)).getTime();
  const unicos = new Map(agenda.bloques.map((bloque) => [bloque.id, bloque]));
  const milisegundos = [...unicos.values()].reduce((total, bloque) =>
    total + Math.max(0, Math.min(bloque.fin.getTime(), fin) - Math.max(bloque.inicio.getTime(), inicio)), 0);
  return {
    actividades: actividades.size,
    horas: milisegundos === 0 ? '0 h' : formatearHoras(milisegundos / 3_600_000)?.replace(/^~/, '') ?? '0 h',
  };
}

export function contarPendientes(tareas: readonly { id: string; estado: string }[]) {
  return new Set(tareas.filter((tarea) =>
    tarea.estado === 'pendiente' || tarea.estado === 'en_proceso').map((tarea) => tarea.id)).size;
}
