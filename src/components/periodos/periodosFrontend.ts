import { diaEnBolivia } from '../calendario/organizarTareasDia';

export type PeriodoAcademico = { id: string; nombre: string; inicio: string; fin: string };
export type DatosPeriodos = { periodos: PeriodoAcademico[]; actual: PeriodoAcademico | null };
export type FormularioPeriodo = { nombre: string; inicio: string; fin: string };

function registro(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('La respuesta de períodos no tiene el formato esperado.');
  return valor as Record<string, unknown>;
}
function texto(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) throw new Error('Falta un dato del período en la respuesta.');
  return valor;
}
function instante(valor: unknown): string {
  const fecha = texto(valor);
  if (Number.isNaN(new Date(fecha).getTime())) throw new Error('La respuesta contiene una fecha de período inválida.');
  return fecha;
}
export function leerPeriodo(valor: unknown): PeriodoAcademico {
  const p = registro(valor);
  return { id: texto(p.id), nombre: texto(p.nombre), inicio: instante(p.inicio), fin: instante(p.fin) };
}
export function leerPeriodos(valor: unknown): DatosPeriodos {
  const datos = registro(valor);
  if (!Array.isArray(datos.periodos)) throw new Error('Falta la lista de períodos en la respuesta.');
  return { periodos: datos.periodos.map(leerPeriodo), actual: datos.actual === null ? null : leerPeriodo(datos.actual) };
}
export function leerPeriodoCreado(valor: unknown): PeriodoAcademico {
  return leerPeriodo(registro(valor).periodo);
}
export function mensajePeriodo(valor: unknown, respaldo: string): string {
  if (!valor || typeof valor !== 'object') return respaldo;
  const datos = valor as Record<string, unknown>;
  return typeof datos.error === 'string' && datos.error ? datos.error : respaldo;
}
export function esPeriodoActual(periodo: PeriodoAcademico, ahora = new Date()): boolean {
  return new Date(periodo.inicio) <= ahora && new Date(periodo.fin) >= ahora;
}
function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(valor + 'T00:00:00-04:00');
  return !Number.isNaN(fecha.getTime()) && diaEnBolivia(fecha) === valor;
}
export function construirPeriodo(valores: FormularioPeriodo): FormularioPeriodo {
  const nombre = valores.nombre.trim();
  if (!nombre || nombre.length > 50) throw new Error('El nombre debe tener entre 1 y 50 caracteres (ej. "II/2026").');
  if (!fechaValida(valores.inicio) || !fechaValida(valores.fin)) throw new Error('Completa las fechas de inicio y fin.');
  // Mismos límites del POST, con los días completos en Bolivia. Se envían fechas de calendario, no ISO.
  const dias = (new Date(valores.fin + 'T23:59:00-04:00').getTime() -
    new Date(valores.inicio + 'T00:00:00-04:00').getTime()) / 86_400_000;
  if (dias < 7 || dias > 366) throw new Error('El periodo debe durar entre 1 semana y 1 año');
  return { nombre, inicio: valores.inicio, fin: valores.fin };
}
