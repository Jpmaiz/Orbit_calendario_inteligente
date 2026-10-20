import type { PrioridadCalculada } from '@/tipos/tarea';

type TareaConFechas = {
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
function diaEnBolivia(fecha: Date): string {
  const partes = formatoDiaBolivia.formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)!.value;
  return valor('year') + '-' + valor('month') + '-' + valor('day');
}

export function organizarTareasDia<T extends TareaConFechas>(
  tareas: readonly T[],
  fechaActual: Date,
) {
  const hoy = diaEnBolivia(fechaActual);
  const [anio, mes, dia] = hoy.split('-').map(Number);
  // UTC se usa solo para sumar dias al calendario, nunca como zona del usuario.
  const finProximosDias = new Date(Date.UTC(anio, mes - 1, dia + 8))
    .toISOString().slice(0, 10);
  const vencidas: T[] = [];
  const paraHoy: T[] = [];
  const proximas: T[] = [];
  const completadasHoy: T[] = [];
  const ordenadas = [...tareas].sort(
    (a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime(),
  );
  for (const tarea of ordenadas) {
    if (tarea.estado === 'completada') {
      if (tarea.completadaEn && diaEnBolivia(tarea.completadaEn) === hoy) {
        completadasHoy.push(tarea);
      }
      continue;
    }
    if (tarea.estado !== 'pendiente' && tarea.estado !== 'en_proceso') continue;
    const diaLimite = diaEnBolivia(tarea.fechaLimite);
    if (diaLimite < hoy) vencidas.push(tarea);
    else if (diaLimite === hoy) paraHoy.push(tarea);
    else if (diaLimite < finProximosDias) proximas.push(tarea);
  }
  // Ordenar los puntajes recibidos sin calcular prioridades.
  for (const seccion of [vencidas, paraHoy, proximas]) {
    seccion.sort((a, b) =>
      (b.prioridadCalculada?.puntaje ?? 0) - (a.prioridadCalculada?.puntaje ?? 0) ||
      a.fechaLimite.getTime() - b.fechaLimite.getTime());
  }
  return [
    { id: 'vencidas', titulo: 'Vencidas', tareas: vencidas },
    { id: 'hoy', titulo: 'Hoy', tareas: paraHoy },
    { id: 'proximas', titulo: 'Próximos 7 días', tareas: proximas },
    { id: 'completadas-hoy', titulo: 'Completadas hoy', tareas: completadasHoy },
  ];
}
