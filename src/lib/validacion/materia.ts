export interface DatosMateria {
  nombre?: string;
  color?: string;
  semestre?: string | null;
}

type Resultado = { ok: true; datos: DatosMateria } | { ok: false; error: string };

export function validarMateria(body: unknown, modo: 'crear' | 'editar'): Resultado {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const b = body as Record<string, unknown>;
  const crear = modo === 'crear';
  const datos: DatosMateria = {};

  if (b.nombre !== undefined) {
    if (typeof b.nombre !== 'string' || b.nombre.trim() === '' || b.nombre.length > 100) {
      return { ok: false, error: 'El nombre debe tener entre 1 y 100 caracteres' };
    }
    datos.nombre = b.nombre.trim();
  } else if (crear) {
    return { ok: false, error: 'Falta el nombre' };
  }

  if (b.color !== undefined) {
    if (typeof b.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(b.color)) {
      return { ok: false, error: 'Color inválido (formato #RRGGBB)' };
    }
    datos.color = b.color;
  }

  if (b.semestre !== undefined) {
    if (b.semestre !== null && (typeof b.semestre !== 'string' || b.semestre.length > 50)) {
      return { ok: false, error: 'Semestre inválido' };
    }
    datos.semestre = b.semestre as string | null;
  }

  if (!crear && Object.keys(datos).length === 0) {
    return { ok: false, error: 'No hay nada para actualizar' };
  }

  return { ok: true, datos };
}