/**
 * Valida el plan que guarda el usuario (POST /api/plan/{tareaId}). Código puro: se prueba con scripts/probar-validar-plan.ts.
 *
 * A mano el usuario tiene más libertad que la sugerencia: cuartos de hora, bloques desde 30 min y sin el margen de 15 min.
 * Se rechaza (400) lo que no puede ser: un bloque en el pasado, después de la fecha de la actividad o encima de otra cosa.
 * El tope de 4 h por día NO se valida: lo decide el usuario (el front avisa).
 * Un bloque ya guardado que está en curso (empezó y no terminó) se conserva tal cual: si el front lo reenvía, se ignora.
 */
import { instanteEnZona } from '@/lib/fechas/resolverFecha';
import { diaLocal, sumarDias, type Ocupacion } from './huecos';

const MIN_MS = 60_000;
const CUARTO_MS = 15 * MIN_MS;

export const REGLAS_GUARDAR = { minimoMin: 30, maximoMin: 240, maxBloques: 40 };

export type OrigenBloque = 'orbit' | 'usuario';
export type BloqueAGuardar = { inicio: Date; fin: Date; tipo: 'estudio' | 'repaso'; origen: OrigenBloque };
export type Tramo = { inicio: Date; fin: Date };

/** Hasta cuándo puede terminar un bloque: la hora de la actividad, o el fin de ese día si no tiene hora definida. */
export function limiteParaGuardar(t: { fechaLimite: Date; horaDefinida: boolean }, zona: string): Date {
  if (t.horaDefinida) return t.fechaLimite;
  return instanteEnZona(sumarDias(diaLocal(t.fechaLimite, zona), 1), '00:00', zona);
}

/** Bloques guardados de esta actividad que ya empezaron y todavía no terminan. */
export const enCurso = (propios: Tramo[], ahora: Date) => propios.filter((b) => b.inicio < ahora && b.fin > ahora);

const hora = (f: Date, zona: string) =>
  new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);

export function validarPlan(
  body: unknown,
  opciones: { limite: Date; ahora: Date; zona: string; ocupaciones: Ocupacion[]; enCurso: Tramo[] },
): { ok: true; bloques: BloqueAGuardar[] } | { ok: false; error: string } {
  const { limite, ahora, zona, ocupaciones } = opciones;
  const lista = (body as { bloques?: unknown })?.bloques;
  if (!Array.isArray(lista)) return { ok: false, error: 'Falta "bloques" (lista)' };
  if (lista.length > REGLAS_GUARDAR.maxBloques) return { ok: false, error: `Máximo ${REGLAS_GUARDAR.maxBloques} bloques` };

  const desdeAhora = Math.floor(ahora.getTime() / CUARTO_MS) * CUARTO_MS; // vale empezar en el cuarto de hora actual
  const bloques: BloqueAGuardar[] = [];
  for (const [i, x] of lista.entries()) {
    const r = (x ?? {}) as Record<string, unknown>;
    const n = `Bloque ${i + 1}`;
    const inicio = typeof r.inicio === 'string' ? new Date(r.inicio) : null;
    const fin = typeof r.fin === 'string' ? new Date(r.fin) : null;
    if (!inicio || !fin || isNaN(+inicio) || isNaN(+fin)) return { ok: false, error: `${n}: fechas inválidas` };
    // El bloque en curso se conserva solo (no se edita): si viene igual, se ignora
    if (opciones.enCurso.some((b) => +b.inicio === +inicio && +b.fin === +fin)) continue;
    if (+inicio % CUARTO_MS || +fin % CUARTO_MS) return { ok: false, error: `${n}: empieza y termina en :00, :15, :30 o :45` };
    const minutos = (+fin - +inicio) / MIN_MS;
    if (minutos < REGLAS_GUARDAR.minimoMin) return { ok: false, error: `${n}: dura al menos ${REGLAS_GUARDAR.minimoMin} min` };
    if (minutos > REGLAS_GUARDAR.maximoMin) return { ok: false, error: `${n}: dura como máximo 4 h` };
    if (+inicio < desdeAhora) return { ok: false, error: `${n}: empieza antes de ahora` };
    if (fin > limite) return { ok: false, error: `${n}: termina después de la fecha de la actividad` };
    const choca = ocupaciones.find((o) => inicio < o.fin && o.inicio < fin);
    if (choca) return { ok: false, error: `${n} (${hora(inicio, zona)}): se cruza con «${choca.titulo}»` };
    if (opciones.enCurso.some((b) => inicio < b.fin && b.inicio < fin)) {
      return { ok: false, error: `${n} (${hora(inicio, zona)}): se cruza con el bloque que está en curso` };
    }
    bloques.push({
      inicio, fin, tipo: r.tipo === 'repaso' ? 'repaso' : 'estudio',
      origen: r.origen === 'orbit' ? 'orbit' : 'usuario', // sin dato: lo puso el usuario
    });
  }
  bloques.sort((a, b) => +a.inicio - +b.inicio);
  for (let i = 1; i < bloques.length; i++) {
    if (bloques[i].inicio < bloques[i - 1].fin) return { ok: false, error: 'Dos bloques del plan se cruzan entre sí' };
  }
  return { ok: true, bloques };
}
