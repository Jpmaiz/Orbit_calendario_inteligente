/**
 * Validación de eventos de UNA sola vez (tabla Evento): reunión de grupo, charla, defensa…
 * Las clases semanales (EventoFijo) se validan en validacion/evento.ts.
 */
export interface DatosEventoPuntual {
  titulo?: string;
  descripcion?: string | null;
  inicio?: Date;
  fin?: Date | null;
  ubicacion?: string | null;
  materiaId?: string | null;
}

type Resultado = { ok: true; datos: DatosEventoPuntual } | { ok: false; error: string };

const MAX_DURACION_MS = 14 * 24 * 60 * 60 * 1000; // un congreso de varios días entra; más de 2 semanas no

function fecha(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const anio = d.getUTCFullYear();
  return anio >= 2000 && anio <= 2100 ? d : null;
}

export function validarEventoPuntual(body: unknown, modo: 'crear' | 'editar'): Resultado {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const b = body as Record<string, unknown>;
  const crear = modo === 'crear';
  const datos: DatosEventoPuntual = {};

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

  // inicio (ISO con zona, ej. "2026-10-30T15:00:00-04:00")
  if (b.inicio !== undefined) {
    const d = fecha(b.inicio);
    if (!d) return { ok: false, error: 'Fecha y hora de inicio inválidas' };
    datos.inicio = d;
  } else if (crear) {
    return { ok: false, error: 'Falta la fecha y hora de inicio' };
  }

  // fin (opcional; null = sin hora de fin)
  if (b.fin !== undefined) {
    if (b.fin === null) {
      datos.fin = null;
    } else {
      const d = fecha(b.fin);
      if (!d) return { ok: false, error: 'Fecha y hora de fin inválidas' };
      datos.fin = d;
    }
  }

  // ubicacion
  if (b.ubicacion !== undefined) {
    if (b.ubicacion !== null && (typeof b.ubicacion !== 'string' || b.ubicacion.length > 200)) {
      return { ok: false, error: 'Ubicación inválida' };
    }
    datos.ubicacion = b.ubicacion as string | null;
  }

  // materiaId (la pertenencia al usuario se verifica en el endpoint)
  if (b.materiaId !== undefined) {
    if (b.materiaId !== null && typeof b.materiaId !== 'string') {
      return { ok: false, error: 'Materia inválida' };
    }
    datos.materiaId = b.materiaId as string | null;
  }

  if (!crear && Object.keys(datos).length === 0) {
    return { ok: false, error: 'No hay nada para actualizar' };
  }

  return { ok: true, datos };
}

/** Reglas que dependen de inicio y fin JUNTOS (al editar se combinan con lo que ya estaba guardado). */
export function validarRango(inicio: Date, fin: Date | null): string | null {
  if (!fin) return null;
  if (fin <= inicio) return 'La hora de fin debe ser posterior a la de inicio';
  if (fin.getTime() - inicio.getTime() > MAX_DURACION_MS) return 'Un evento no puede durar más de 14 días';
  return null;
}
