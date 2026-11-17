import type { PrioridadCalculada, TareaConHoraDefinida } from '@/tipos/tarea';

type TareaConFechas = TareaConHoraDefinida & {
  estado: string;
  fechaLimite: Date;
  completadaEn: Date | null;
  prioridadCalculada?: Pick<PrioridadCalculada, 'puntaje'>;
};

const formatoDiaBolivia = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/La_Paz',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Claves ISO de calendario: su orden coincide con el de los dias en Bolivia.
export function diaEnBolivia(fecha: Date): string {
  const partes = formatoDiaBolivia.formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)!.value;
  return valor('year') + '-' + valor('month') + '-' + valor('day');
}

/** "2026-11-10" + 7 → "2026-11-17" (días de calendario, sin zona). */
export function sumarDias(dia: string, dias: number): string {
  const [anio, mes, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, d + dias)).toISOString().slice(0, 10);
}

/** Ya pasó: cerrada, o su fecha ya llegó (sin hora, al terminar el día). Lo pasado no se reabre: solo se cambia la fecha. */
export function yaPaso(tarea: TareaConFechas, fechaActual: Date): boolean {
  if (tarea.estado === 'completada' || tarea.estado === 'no_realizada') return true;
  const dia = diaEnBolivia(tarea.fechaLimite), hoy = diaEnBolivia(fechaActual);
  return dia < hoy || (dia === hoy && tarea.horaDefinida && tarea.fechaLimite <= fechaActual);
}

export function organizarTareasDia<T extends TareaConFechas>(
  tareas: readonly T[],
  fechaActual: Date,
) {
  const hoy = diaEnBolivia(fechaActual);
  const ayer = sumarDias(hoy, -1);
  const finProximosDias = sumarDias(hoy, 8);
  const sinHora: T[] = [];
  const paraHoy: T[] = [];
  const proximas: T[] = [];
  // Cero mantenimiento: lo que pasó ayer y hoy se ve como hecho; lo anterior, solo en el calendario.
  const pasaron: T[] = [];
  for (const tarea of tareas) {
    if (!['pendiente', 'en_proceso', 'completada', 'no_realizada'].includes(tarea.estado)) continue;
    const diaLimite = diaEnBolivia(tarea.fechaLimite);
    if (yaPaso(tarea, fechaActual)) {
      if (diaLimite >= ayer && diaLimite <= hoy) pasaron.push(tarea);
    } else if (diaLimite === hoy && !tarea.horaDefinida) sinHora.push(tarea);
    else if (diaLimite === hoy) paraHoy.push(tarea);
    else if (diaLimite < finProximosDias) proximas.push(tarea);
  }
  // Ordenar los puntajes recibidos sin calcular prioridades.
  for (const seccion of [sinHora, paraHoy, proximas]) {
    seccion.sort((a, b) =>
      (b.prioridadCalculada?.puntaje ?? 0) - (a.prioridadCalculada?.puntaje ?? 0) ||
      a.fechaLimite.getTime() - b.fechaLimite.getTime());
  }
  pasaron.sort((a, b) => b.fechaLimite.getTime() - a.fechaLimite.getTime());
  return [
    { id: 'sin-hora', titulo: 'Sin hora', tareas: sinHora },
    { id: 'hoy', titulo: 'Hoy', tareas: paraHoy },
    { id: 'proximas', titulo: 'Próximos 7 días', tareas: proximas },
    { id: 'pasaron', titulo: 'Ya pasaron', tareas: pasaron },
  ];
}
