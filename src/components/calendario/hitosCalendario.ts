import { horarioDelDia, type AgendaDia, type TareaAgenda } from './agendaDia';
import { inicioDiaBolivia } from './agendaSemana';
import { diaEnBolivia, sumarDias, yaPaso } from './organizarTareasDia';

/**
 * Lo que cambia el calendario: exámenes, entregas y eventos. Cada tipo tiene su forma
 * (gema, bandera, punto) para no depender solo del color. Las clases son rutina y no se marcan.
 */
export type TipoHito = 'examen' | 'entrega' | 'evento';

export function tipoHito(tipoTarea: string): TipoHito {
  return tipoTarea === 'examen' || tipoTarea === 'exposicion' ? 'examen' : 'entrega';
}

export type Hito = {
  clave: string; tipo: TipoHito; dia: string; momento: Date; conHora: boolean;
  titulo: string; color: string | null; tarea: TareaAgenda | null; pasado: boolean;
};

export function hitosDeAgenda(agenda: AgendaDia, ahora: Date): Hito[] {
  return [
    ...agenda.tareas.map((t): Hito => ({
      clave: 't' + t.id, tipo: tipoHito(t.tipo), dia: diaEnBolivia(t.fechaLimite), momento: t.fechaLimite,
      conHora: t.horaDefinida, titulo: t.titulo, color: t.materia?.color ?? null, tarea: t, pasado: yaPaso(t, ahora),
    })),
    ...agenda.eventos.map((e): Hito => ({
      clave: 'e' + e.id, tipo: 'evento', dia: diaEnBolivia(e.inicio), momento: e.inicio, conHora: true,
      titulo: e.titulo, color: e.materia?.color ?? null, tarea: null, pasado: (e.fin ?? e.inicio) <= ahora,
    })),
  ].sort((a, b) => a.momento.getTime() - b.momento.getTime());
}

function aMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Horas ocupadas del día (clases, eventos con fin y estudio, recortados al día) y cuántas son de clase. */
export function horasDelDia(agenda: AgendaDia, dia: string): { total: number; clases: number } {
  const inicio = inicioDiaBolivia(dia).getTime(), fin = inicioDiaBolivia(sumarDias(dia, 1)).getTime();
  const horario = horarioDelDia(agenda, new Date(dia + 'T12:00:00-04:00'));
  const tramo = (a: Date, b: Date) => Math.max(0, (Math.min(b.getTime(), fin) - Math.max(a.getTime(), inicio)) / 60000);
  const clases = horario.clases.reduce((t, c) => t + Math.max(0, aMinutos(c.horaFin) - aMinutos(c.horaInicio)), 0);
  const eventos = horario.eventos.reduce((t, e) => t + (e.fin ? tramo(e.inicio, e.fin) : 0), 0);
  const estudio = horario.bloques.reduce((t, b) => t + tramo(b.inicio, b.fin), 0);
  // v2.12: un examen con hora y duración también ocupa el día.
  const examenes = agenda.tareas.filter((t) => tipoHito(t.tipo) === 'examen' && t.horaDefinida && t.duracionMin)
    .reduce((t, x) => t + tramo(x.fechaLimite, new Date(x.fechaLimite.getTime() + x.duracionMin! * 60000)), 0);
  return { total: (clases + eventos + estudio + examenes) / 60, clases: clases / 60 };
}

/** 0 libre · 1 poco · 2 medio · 3 cargado (el fondo del día se oscurece con el nivel). */
export function nivelCarga(horas: number): 0 | 1 | 2 | 3 {
  return horas <= 0 ? 0 : horas < 3.5 ? 1 : horas < 6 ? 2 : 3;
}

/** "hoy", "mañana", "en 3 días" entre dos días de calendario. */
export function cuantoFalta(hoy: string, dia: string): string {
  const dias = Math.round((Date.parse(dia + 'T12:00:00Z') - Date.parse(hoy + 'T12:00:00Z')) / 86_400_000);
  return dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
}

/** Color oscuro de una materia para íconos y texto (legible sobre su tinte claro). */
export function colorFuerte(color: string | null): string {
  return color ? `color-mix(in srgb, ${color} 58%, #142E27)` : '#245B4C';
}
