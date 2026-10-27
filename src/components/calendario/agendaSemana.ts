import { horarioDelDia, type AgendaDia, type ClaseAgenda, type EventoAgenda, type TareaAgenda } from './agendaDia';
import { diaEnBolivia } from './organizarTareasDia';

export function sumarDias(fecha: string, cantidad: number): string {
  // UTC solo para aritmética de calendario; el día visible siempre es de Bolivia.
  const resultado = new Date(fecha + 'T12:00:00Z');
  resultado.setUTCDate(resultado.getUTCDate() + cantidad);
  return resultado.toISOString().slice(0, 10);
}

export function lunesDeSemana(fecha: Date): string {
  const dia = diaEnBolivia(fecha);
  const numero = new Date(dia + 'T12:00:00Z').getUTCDay() || 7;
  return sumarDias(dia, 1 - numero);
}

export function inicioDiaBolivia(fecha: string): Date {
  return new Date(fecha + 'T00:00:00-04:00');
}

export type BloqueSemana =
  | { tipo: 'clase'; id: string; hora: string; datos: ClaseAgenda }
  | { tipo: 'evento'; id: string; hora: string; datos: EventoAgenda }
  | { tipo: 'tarea'; id: string; hora: string; datos: TareaAgenda };

export const formatoHoraBolivia = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function organizarSemana(agenda: AgendaDia, lunes: string) {
  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = sumarDias(lunes, indice);
    const inicio = inicioDiaBolivia(fecha);
    const horario = horarioDelDia(agenda, inicio);
    const tareas = agenda.tareas.filter((tarea) => diaEnBolivia(tarea.fechaLimite) === fecha);
    const bloques: BloqueSemana[] = [
      ...horario.clases.map((datos): BloqueSemana => ({
        tipo: 'clase', id: 'clase-' + datos.id, hora: datos.horaInicio, datos,
      })),
      ...horario.eventos
        // Un evento que termina a medianoche no ocupa el día siguiente.
        .filter((evento) => !evento.fin || evento.fin > inicio || evento.inicio >= inicio)
        .map((datos): BloqueSemana => ({
          tipo: 'evento', id: 'evento-' + datos.id,
          hora: datos.inicio < inicio ? '00:00' : formatoHoraBolivia.format(datos.inicio), datos,
        })),
      ...tareas.filter((tarea) => tarea.horaDefinida).map((datos): BloqueSemana => ({
        tipo: 'tarea', id: 'tarea-' + datos.id, hora: formatoHoraBolivia.format(datos.fechaLimite), datos,
      })),
    ];
    bloques.sort((a, b) => a.hora.localeCompare(b.hora) || a.datos.titulo.localeCompare(b.datos.titulo));
    return {
      fecha, bloques,
      sinHora: tareas.filter((tarea) => !tarea.horaDefinida)
        .sort((a, b) => a.titulo.localeCompare(b.titulo)),
    };
  });
}
