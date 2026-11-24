/**
 * "Lo que Orbit sabe de ti": lo aprendido, contado en palabras (sin números ni el factor personal).
 * Código puro: scripts/probar-ritmo.ts.
 */
import { factorPersonal, type SenalHoras } from '@/lib/estimacion/personal';
import { energiaEfectiva, NOMBRE_MOMENTO, type VotoMomento } from '@/lib/aprendizaje/energia';
import { ENERGIA_NORMAL, type Energia } from '@/lib/usuarios/ritmo';

const PLURAL: Record<string, string> = {
  examen: 'exámenes', tarea: 'tareas', entrega: 'entregas', proyecto: 'proyectos', exposicion: 'exposiciones',
};
/** Desde cuánto se dice "más" o "menos" (×1,15 / ×0,87): por debajo es ruido, no un patrón. */
const UMBRAL_MAS = 1.15, UMBRAL_MENOS = 0.87;
const MIN_DATOS_TIPO = 2;

export function describirAprendizaje(
  senales: { horas: SenalHoras[]; momentos: VotoMomento[] },
  ahora: Date = new Date(),
  energiaElegida: Energia = ENERGIA_NORMAL,
) {
  const frases: string[] = [];
  for (const tipo of Object.keys(PLURAL)) {
    const delTipo = senales.horas.filter((s) => s.tipoTarea === tipo);
    if (delTipo.reduce((n, s) => n + s.peso, 0) < MIN_DATOS_TIPO) continue;
    const { factor } = factorPersonal(delTipo, null, tipo, ahora);
    if (factor >= UMBRAL_MAS) frases.push(`Tus ${PLURAL[tipo]} te suelen tomar más de lo que calcula Orbit para un estudiante promedio. Ya lo tiene en cuenta.`);
    else if (factor <= UMBRAL_MENOS) frases.push(`Tus ${PLURAL[tipo]} te suelen tomar menos de lo que calcula Orbit para un estudiante promedio. Ya lo tiene en cuenta.`);
  }
  const { aprendidos } = energiaEfectiva(energiaElegida, senales.momentos, ahora);
  for (const m of aprendidos) frases.push(`Sueles estudiar en ${NOMBRE_MOMENTO[m]}, así que Orbit pone ahí tu estudio más exigente.`);
  const datos = senales.horas.length + senales.momentos.length;
  const conociendo = frases.length === 0;
  if (conociendo) frases.push('Orbit todavía te está conociendo. Con el uso, ajusta las horas y los horarios a tu ritmo, sin que tengas que marcar nada.');
  return { conociendo, frases, datos };
}
