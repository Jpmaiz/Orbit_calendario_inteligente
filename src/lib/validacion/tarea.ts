export const TIPOS = ['examen', 'tarea', 'entrega', 'proyecto', 'exposicion'];
export const PRIORIDADES = ['alta', 'media', 'baja'];
export const ESTADOS = ['pendiente', 'en_proceso', 'completada', 'no_realizada'];
export const ORIGENES = ['texto', 'manual', 'foto'];

export interface DatosTarea {
  titulo?: string;
  descripcion?: string | null;
  tipo?: string;
  fechaLimite?: Date;
  duracionEstMin?: number;
  prioridad?: string;
  estado?: string;
  materiaId?: string | null;
  origen?: string;
}

type Resultado = { ok: true; datos: DatosTarea } | { ok: false; error: string };

/**
 * Valida el body y SOLO deja pasar campos permitidos.
 * crear: titulo, tipo y fechaLimite obligatorios.
 * editar: todo opcional, pero lo que llegue se valida.
 */
export function validarTarea(body: unknown, modo: 'crear' | 'editar'): Resultado {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const b = body as Record<string, unknown>;
  const crear = modo === 'crear';
  const datos: DatosTarea = {};

  // titulo
  if (b.titulo !== undefined) {
    if (typeof b.titulo !== 'string' || b.titulo.trim() === '' || b.titulo.length > 200) {
      return { ok: false, error: 'El título debe tener entre 1 y 200 caracteres' };
    }
    datos.titulo = b.titulo.trim();
  } else if (crear) {
    return { ok: false, error: 'Falta el título' };
  }

  // descripcion
  if (b.descripcion !== undefined) {
    if (b.descripcion !== null && (typeof b.descripcion !== 'string' || b.descripcion.length > 2000)) {
      return { ok: false, error: 'Descripción inválida' };
    }
    datos.descripcion = b.descripcion as string | null;
  }

  // tipo
  if (b.tipo !== undefined) {
    if (typeof b.tipo !== 'string' || !TIPOS.includes(b.tipo)) {
      return { ok: false, error: `Tipo inválido. Usar: ${TIPOS.join(', ')}` };
    }
    datos.tipo = b.tipo;
  } else if (crear) {
    return { ok: false, error: 'Falta el tipo' };
  }

  // fechaLimite
  if (b.fechaLimite !== undefined) {
    const fecha = new Date(b.fechaLimite as string);
    if (typeof b.fechaLimite !== 'string' || isNaN(fecha.getTime())) {
      return { ok: false, error: 'Fecha límite inválida' };
    }
    datos.fechaLimite = fecha;
  } else if (crear) {
    return { ok: false, error: 'Falta la fecha límite' };
  }

  // duracionEstMin
  if (b.duracionEstMin !== undefined) {
    const d = b.duracionEstMin;
    if (typeof d !== 'number' || !Number.isInteger(d) || d <= 0 || d > 1440) {
      return { ok: false, error: 'Duración inválida (1 a 1440 minutos)' };
    }
    datos.duracionEstMin = d;
  }

  // prioridad
  if (b.prioridad !== undefined) {
    if (typeof b.prioridad !== 'string' || !PRIORIDADES.includes(b.prioridad)) {
      return { ok: false, error: `Prioridad inválida. Usar: ${PRIORIDADES.join(', ')}` };
    }
    datos.prioridad = b.prioridad;
  }

  // materiaId (la pertenencia al usuario se verifica en el endpoint)
  if (b.materiaId !== undefined) {
    if (b.materiaId !== null && typeof b.materiaId !== 'string') {
      return { ok: false, error: 'Materia inválida' };
    }
    datos.materiaId = b.materiaId as string | null;
  }

  // estado: solo al editar (al crear siempre es 'pendiente')
  if (!crear && b.estado !== undefined) {
    if (typeof b.estado !== 'string' || !ESTADOS.includes(b.estado)) {
      return { ok: false, error: `Estado inválido. Usar: ${ESTADOS.join(', ')}` };
    }
    datos.estado = b.estado;
  }

  // origen: solo al crear (no se cambia después)
  if (crear && b.origen !== undefined) {
    if (typeof b.origen !== 'string' || !ORIGENES.includes(b.origen)) {
      return { ok: false, error: 'Origen inválido' };
    }
    datos.origen = b.origen;
  }

  if (!crear && Object.keys(datos).length === 0) {
    return { ok: false, error: 'No hay nada para actualizar' };
  }

  return { ok: true, datos };
}