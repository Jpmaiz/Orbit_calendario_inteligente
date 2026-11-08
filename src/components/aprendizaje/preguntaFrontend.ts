export type RespuestaPregunta = 'menos' | 'justo' | 'mas';
export type Pregunta = {
  tareaId: string; titulo: string; texto: string; horasSugeridas: number; opciones: RespuestaPregunta[];
};
export type EstadoPregunta = {
  pregunta: Pregunta | null; consultando: boolean; enviando: boolean;
  seleccion: RespuestaPregunta | null; error: string | null; terminada: boolean;
};
export const ESTADO_INICIAL: EstadoPregunta = {
  pregunta: null, consultando: false, enviando: false, seleccion: null, error: null, terminada: false,
};
const opciones: RespuestaPregunta[] = ['menos', 'justo', 'mas'];
export function leerPregunta(valor: unknown): Pregunta | null {
  if (!valor || typeof valor !== 'object' || !('pregunta' in valor)) throw new Error('No se pudo leer la pregunta.');
  if (valor.pregunta === null) return null;
  const p = valor.pregunta as Partial<Pregunta> | null;
  if (!p || typeof p !== 'object' || typeof p.tareaId !== 'string' || !p.tareaId ||
      typeof p.titulo !== 'string' || typeof p.texto !== 'string' ||
      typeof p.horasSugeridas !== 'number' || !Number.isFinite(p.horasSugeridas) || p.horasSugeridas <= 0 ||
      !Array.isArray(p.opciones) || p.opciones.length !== 3 || new Set(p.opciones).size !== 3 ||
      p.opciones.some((o) => !opciones.includes(o))) throw new Error('No se pudo leer la pregunta.');
  return { tareaId: p.tareaId, titulo: p.titulo, texto: p.texto, horasSugeridas: p.horasSugeridas, opciones: [...p.opciones] };
}
function mensaje(datos: unknown, status: number): string {
  if (datos && typeof datos === 'object' && 'error' in datos && typeof datos.error === 'string') return datos.error;
  return status === 401 ? 'Tu sesión venció. Inicia sesión de nuevo.' : 'No se pudo completar la solicitud. Intenta de nuevo.';
}
function crearSesion() {
  let estado: EstadoPregunta = ESTADO_INICIAL;
  let consultada = false;
  let consulta: Promise<void> | null = null;
  const oyentes = new Set<() => void>();
  function actualizar(cambios: Partial<EstadoPregunta>) {
    estado = { ...estado, ...cambios };
    oyentes.forEach((avisar) => avisar());
  }
  function consultar(reintento = false): Promise<void> {
    if (consulta) return consulta;
    if (estado.terminada || (consultada && !reintento)) return Promise.resolve();
    consultada = true;
    actualizar({ consultando: true, error: null });
    // No abortar al desmontar: el GET ya puede haber consumido la pregunta.
    // Guardar su respuesta permite mostrarla al volver, sin ejecutar otro GET.
    consulta = (async () => {
      try {
        const respuesta = await fetch('/api/aprendizaje/pregunta', { cache: 'no-store' });
        const datos: unknown = await respuesta.json().catch(() => null);
        if (respuesta.status !== 200) throw new Error(mensaje(datos, respuesta.status));
        const pregunta = leerPregunta(datos);
        actualizar({ pregunta, terminada: pregunta === null });
      } catch (e) {
        actualizar({ error: e instanceof Error ? e.message : 'No se pudo consultar la pregunta.' });
      } finally {
        actualizar({ consultando: false });
        consulta = null;
      }
    })();
    return consulta;
  }
  async function responder(respuesta: RespuestaPregunta): Promise<void> {
    if (!estado.pregunta || estado.enviando || estado.terminada || !estado.pregunta.opciones.includes(respuesta)) return;
    const tareaId = estado.pregunta.tareaId;
    actualizar({ enviando: true, seleccion: respuesta, error: null });
    try {
      const resultado = await fetch('/api/aprendizaje/pregunta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tareaId, respuesta }),
      });
      if (resultado.status !== 200) {
        const datos: unknown = await resultado.json().catch(() => null);
        throw new Error(mensaje(datos, resultado.status));
      }
      actualizar({ pregunta: null, terminada: true });
    } catch (e) {
      actualizar({ error: e instanceof Error ? e.message : 'No se pudo guardar. Puedes reintentar.' });
    } finally {
      actualizar({ enviando: false });
    }
  }
  return {
    getSnapshot: () => estado,
    subscribe(avisar: () => void) { oyentes.add(avisar); return () => { oyentes.delete(avisar); }; },
    consultar,
    responder,
    cerrar() { if (!estado.enviando) actualizar({ pregunta: null, error: null, terminada: true }); },
  };
}
type SesionPregunta = ReturnType<typeof crearSesion>;
// Solo memoria de esta pestaña, separada por usuario y día. Sin temporizadores ni almacenamiento persistente.
const sesiones = new Map<string, SesionPregunta>();
export function obtenerSesionPregunta(clave: string): SesionPregunta {
  if (typeof window === 'undefined') return crearSesion();
  let sesion = sesiones.get(clave);
  if (!sesion) { sesion = crearSesion(); sesiones.set(clave, sesion); }
  return sesion;
}
