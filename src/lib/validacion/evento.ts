export interface DatosEvento {
  titulo?: string;
  diaSemana?: number;
  horaInicio?: string;
  horaFin?: string;
  ubicacion?: string | null;
  materiaId?: string | null;
  vigenteDesde?: Date | null; // inicio del semestre (o de la clase)
  vigenteHasta?: Date | null; // fin del semestre (o de la clase)
}

type Resultado = { ok: true; datos: DatosEvento } | { ok: false; error: string };

// Comprueba formato "HH:MM" entre 00:00 y 23:59
function horaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

export function validarEvento(body: unknown, modo: 'crear' | 'editar'): Resultado {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const b = body as Record<string, unknown>;
  const crear = modo === 'crear';
  const datos: DatosEvento = {};

  // titulo
  if (b.titulo !== undefined) {
    if (typeof b.titulo !== 'string' || b.titulo.trim() === '' || b.titulo.length > 200) {
      return { ok: false, error: 'El título debe tener entre 1 y 200 caracteres' };
    }
    datos.titulo = b.titulo.trim();
  } else if (crear) {
    return { ok: false, error: 'Falta el título' };
  }

  // diaSemana (1 = lunes ... 7 = domingo)
  if (b.diaSemana !== undefined) {
    if (typeof b.diaSemana !== 'number' || !Number.isInteger(b.diaSemana) || b.diaSemana < 1 || b.diaSemana > 7) {
      return { ok: false, error: 'Día de la semana inválido (1 a 7)' };
    }
    datos.diaSemana = b.diaSemana;
  } else if (crear) {
    return { ok: false, error: 'Falta el día de la semana' };
  }

  // horaInicio
  if (b.horaInicio !== undefined) {
    if (!horaValida(b.horaInicio)) {
      return { ok: false, error: 'Hora de inicio inválida (formato HH:MM)' };
    }
    datos.horaInicio = b.horaInicio;
  } else if (crear) {
    return { ok: false, error: 'Falta la hora de inicio' };
  }

  // horaFin
  if (b.horaFin !== undefined) {
    if (!horaValida(b.horaFin)) {
      return { ok: false, error: 'Hora de fin inválida (formato HH:MM)' };
    }
    datos.horaFin = b.horaFin;
  } else if (crear) {
    return { ok: false, error: 'Falta la hora de fin' };
  }

  // la hora de fin debe ser posterior a la de inicio
  if (datos.horaInicio && datos.horaFin && datos.horaFin <= datos.horaInicio) {
    return { ok: false, error: 'La hora de fin debe ser posterior a la de inicio' };
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

  // vigencia (opcional; null = sin límite). Si llegan las dos, el fin debe ser posterior.
  for (const campo of ['vigenteDesde', 'vigenteHasta'] as const) {
    if (b[campo] !== undefined) {
      if (b[campo] === null) {
        datos[campo] = null;
      } else {
        const d = typeof b[campo] === 'string' ? new Date(b[campo] as string) : null;
        if (!d || Number.isNaN(d.getTime())) {
          return { ok: false, error: `${campo === 'vigenteDesde' ? 'Inicio' : 'Fin'} de vigencia inválido` };
        }
        datos[campo] = d;
      }
    }
  }
  if (datos.vigenteDesde && datos.vigenteHasta && datos.vigenteHasta <= datos.vigenteDesde) {
    return { ok: false, error: 'El fin de vigencia debe ser posterior al inicio' };
  }

  if (!crear && Object.keys(datos).length === 0) {
    return { ok: false, error: 'No hay nada para actualizar' };
  }

  return { ok: true, datos };
}