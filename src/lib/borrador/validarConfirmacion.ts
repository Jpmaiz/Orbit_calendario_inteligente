/**
 * Valida lo que el front manda a /api/ia/confirmar.
 * El usuario pudo editar el borrador: nada de lo que llega se da por bueno.
 */
import { TIPOS_TAREA } from '@/lib/ia/extraccion';

export type MateriaElegida =
  | { accion: 'vincular'; materiaId: string }
  | { accion: 'crear'; nombre: string; codigo: string | null }
  | { accion: 'ninguna' };

export type ItemConfirmado =
  | { clase: 'tarea'; titulo: string; tipo: string; inicio: Date; horaDefinida: boolean; descripcion: string | null;
      materia: MateriaElegida; materiaDetectada: string | null; confirmarNueva: boolean }
  | { clase: 'evento'; titulo: string; inicio: Date; fin: Date | null; ubicacion: string | null; descripcion: string | null;
      materia: MateriaElegida; materiaDetectada: string | null }
  | { clase: 'evento_fijo'; titulo: string; diasSemana: number[]; hora: string; horaFin: string; ubicacion: string | null;
      vigencia: { desde: Date; hasta: Date } | null; materia: MateriaElegida; materiaDetectada: string | null };

type R<T> = { ok: true; valor: T } | { ok: false; error: string };

const esHora = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const fecha = (v: unknown) => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function validarMateria(v: unknown): R<MateriaElegida> {
  const m = (v ?? { accion: 'ninguna' }) as Record<string, unknown>;
  if (m.accion === 'vincular' && typeof m.materiaId === 'string' && m.materiaId) {
    return { ok: true, valor: { accion: 'vincular', materiaId: m.materiaId } };
  }
  if (m.accion === 'crear') {
    const nombre = texto(m.nombre, 100);
    if (!nombre) return { ok: false, error: 'Falta el nombre de la materia a crear' };
    return { ok: true, valor: { accion: 'crear', nombre, codigo: texto(m.codigo, 30) } };
  }
  if (m.accion === 'ninguna' || m.accion === undefined) return { ok: true, valor: { accion: 'ninguna' } };
  return { ok: false, error: 'Materia inválida' };
}

export function validarItem(v: unknown, i: number): R<ItemConfirmado> {
  const x = (v ?? {}) as Record<string, unknown>;
  const pre = `Ítem ${i + 1}: `;
  const titulo = texto(x.titulo, 200);
  if (!titulo) return { ok: false, error: pre + 'falta el título' };
  const materia = validarMateria(x.materia);
  if (!materia.ok) return { ok: false, error: pre + materia.error };
  const comunes = { titulo, materia: materia.valor, materiaDetectada: texto(x.materiaDetectada, 100) };

  if (x.clase === 'tarea') {
    if (!(TIPOS_TAREA as readonly string[]).includes(x.tipo as string)) return { ok: false, error: pre + 'tipo inválido' };
    const inicio = fecha(x.inicio);
    if (!inicio) return { ok: false, error: pre + 'falta la fecha' };
    return {
      ok: true,
      valor: {
        clase: 'tarea', ...comunes, tipo: x.tipo as string, inicio,
        horaDefinida: x.horaDefinida !== false, descripcion: texto(x.descripcion, 2000),
        confirmarNueva: x.confirmarNueva === true,
      },
    };
  }

  if (x.clase === 'evento') {
    const inicio = fecha(x.inicio);
    if (!inicio) return { ok: false, error: pre + 'falta la fecha y hora de inicio' };
    const fin = x.fin == null ? null : fecha(x.fin);
    if (x.fin != null && (!fin || fin <= inicio)) return { ok: false, error: pre + 'la hora de fin debe ser posterior al inicio' };
    return {
      ok: true,
      valor: { clase: 'evento', ...comunes, inicio, fin, ubicacion: texto(x.ubicacion, 100), descripcion: texto(x.descripcion, 2000) },
    };
  }

  if (x.clase === 'evento_fijo') {
    const dias = Array.isArray(x.diasSemana)
      ? [...new Set(x.diasSemana.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))]
      : [];
    if (dias.length === 0) return { ok: false, error: pre + 'faltan los días de la clase' };
    if (!esHora(x.hora) || !esHora(x.horaFin) || x.horaFin <= x.hora) {
      return { ok: false, error: pre + 'horario inválido (HH:mm, y el fin después del inicio)' };
    }
    const vg = (x.vigencia ?? null) as Record<string, unknown> | null;
    const desde = vg ? fecha(vg.desde) : null, hasta = vg ? fecha(vg.hasta) : null;
    if (vg && (!desde || !hasta || hasta <= desde)) return { ok: false, error: pre + 'vigencia inválida' };
    return {
      ok: true,
      valor: {
        clase: 'evento_fijo', ...comunes, diasSemana: dias, hora: x.hora, horaFin: x.horaFin,
        ubicacion: texto(x.ubicacion, 100), vigencia: desde && hasta ? { desde, hasta } : null,
      },
    };
  }

  return { ok: false, error: pre + 'clase inválida (tarea, evento o evento_fijo)' };
}