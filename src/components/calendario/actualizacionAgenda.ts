// Evento local: las vistas conservan su día/semana y vuelven a consultar sus datos.
export const AGENDA_ACTUALIZADA = 'orbit:agenda-actualizada';

export function avisarAgendaActualizada() {
  window.dispatchEvent(new Event(AGENDA_ACTUALIZADA));
}
