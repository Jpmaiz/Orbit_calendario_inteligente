export type Interpretacion = { titulo: string; tipo: string };
export type SolicitudIA = { via: 'ia'; texto: string; confirmarNueva: boolean; tituloFinal: string | null };
export type SolicitudTarea = {
  via: 'tareas'; texto: string; confirmarNueva: boolean;
  tarea: { titulo: string; tipo: string; fechaLimite: string; materiaId: string | null; origen: 'texto' };
};
export type Solicitud = SolicitudIA | SolicitudTarea;
export type PasoFecha = { tipo: 'fecha'; solicitud: SolicitudIA; interpretacion: Interpretacion; materiaId: string | null };
export type PasoDuplicado = { tipo: 'duplicado'; solicitud: Solicitud; titulo: string; pregunta: string; sugerencias: string[] };
export type Paso = { tipo: 'texto' } | PasoFecha | PasoDuplicado;
type Resultado = { tipo: 'creada' } | PasoFecha | PasoDuplicado | { tipo: 'error'; mensaje: string; ofrecerManual: boolean };

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}
function leerInterpretacion(valor: unknown): Interpretacion | null {
  if (!esObjeto(valor) || typeof valor.titulo !== 'string' || !valor.titulo.trim() || typeof valor.tipo !== 'string') return null;
  // Mismo respaldo que aplica el endpoint si la IA devuelve un tipo desconocido.
  const tipos = ['examen', 'tarea', 'entrega', 'proyecto', 'exposicion'];
  return { titulo: valor.titulo, tipo: tipos.includes(valor.tipo) ? valor.tipo : 'tarea' };
}
export function peticionDe(solicitud: Solicitud) {
  return solicitud.via === 'ia'
    ? { url: '/api/ia', body: { texto: solicitud.texto, guardar: true, confirmarNueva: solicitud.confirmarNueva, tituloFinal: solicitud.tituloFinal } }
    : { url: '/api/tareas', body: { ...solicitud.tarea, confirmarNueva: solicitud.confirmarNueva } };
}
export function resolverRespuesta(status: number, datos: unknown, solicitud: Solicitud): Resultado {
  if (status === 201) return { tipo: 'creada' };
  const objeto = esObjeto(datos) ? datos : {};
  const interpretacion = leerInterpretacion(objeto.interpretacion);
  if (status === 200 && objeto.necesitaFecha === true && solicitud.via === 'ia' && interpretacion &&
      (objeto.materiaId === null || typeof objeto.materiaId === 'string')) {
    return { tipo: 'fecha', solicitud, interpretacion, materiaId: objeto.materiaId };
  }
  if (status === 409 && typeof objeto.pregunta === 'string' && Array.isArray(objeto.sugerenciasDiferencia) &&
      objeto.sugerenciasDiferencia.every((valor: unknown) => typeof valor === 'string')) {
    const titulo = solicitud.via === 'tareas' ? solicitud.tarea.titulo : solicitud.tituloFinal ?? interpretacion?.titulo;
    if (titulo) return { tipo: 'duplicado', solicitud, titulo, pregunta: objeto.pregunta, sugerencias: objeto.sugerenciasDiferencia };
  }
  return {
    tipo: 'error',
    mensaje: typeof objeto.error === 'string' ? objeto.error
      : status === 401 ? 'Tu sesión terminó. Inicia sesión para continuar.'
        : 'No se pudo completar la solicitud. Intenta de nuevo.',
    ofrecerManual: status === 500 && solicitud.via === 'ia',
  };
}
export function confirmarDuplicado(paso: PasoDuplicado, titulo: string | null): Solicitud {
  return paso.solicitud.via === 'ia'
    ? { ...paso.solicitud, confirmarNueva: true, tituloFinal: titulo }
    : { ...paso.solicitud, confirmarNueva: true, tarea: { ...paso.solicitud.tarea, titulo: titulo ?? paso.solicitud.tarea.titulo } };
}
export function solicitudConFecha(paso: PasoFecha, fechaLimite: string): SolicitudTarea {
  return {
    via: 'tareas', texto: paso.solicitud.texto, confirmarNueva: paso.solicitud.confirmarNueva,
    tarea: {
      titulo: paso.solicitud.tituloFinal ?? paso.interpretacion.titulo,
      tipo: paso.interpretacion.tipo, fechaLimite, materiaId: paso.materiaId, origen: 'texto',
    },
  };
}
// Las opciones rápidas representan el fin del día elegido en Bolivia.
export function fechaRapida(opcion: 'manana' | 'viernes', ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((parte) => parte.type === tipo)!.value);
  const dia = new Date(Date.UTC(valor('year'), valor('month') - 1, valor('day')));
  const dias = opcion === 'manana' ? 1 : (5 - dia.getUTCDay() + 7) % 7 || 7;
  dia.setUTCDate(dia.getUTCDate() + dias);
  return new Date(dia.toISOString().slice(0, 10) + 'T23:59:00-04:00').toISOString();
}
export function fechaElegidaISO(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const fecha = new Date(valor + ':00-04:00');
  if (Number.isNaN(fecha.getTime())) return null;
  const local = new Date(fecha.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
  return local === valor ? fecha.toISOString() : null;
}
