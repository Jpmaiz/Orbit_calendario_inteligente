/**
 * Pruebas de la personalización (Fase 3), sin base de datos.
 * Uso: npx tsx scripts/probar-personal.ts
 */
import assert from 'node:assert/strict';
import { aplicarFactor, factorPersonal, franjaDe, franjaPreferida, type SenalFranja, type SenalHoras } from '@/lib/estimacion/personal';

const ahora = new Date('2026-11-08T12:00:00Z');
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);
const s = (razon: number, x: Partial<SenalHoras> = {}): SenalHoras =>
  ({ razon, peso: 1, materiaId: 'redes', tipoTarea: 'examen', creadoEn: hace(1), ...x });

let fallas = 0;
function prueba(nombre: string, f: () => void) {
  try { f(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}
const cerca = (a: number, b: number, tol = 0.03) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

prueba('Sin datos: factor 1 (estudiante promedio)', () => assert.deepEqual(factorPersonal([], 'redes', 'examen', ahora), { factor: 1, datos: 0, nivel: 'ninguno' }));
prueba('3 datos de ×1,5 en Redes · examen: el historial pesa la mitad (≈ ×1,22)', () => {
  const f = factorPersonal([s(1.5), s(1.5), s(1.5)], 'redes', 'examen', ahora);
  cerca(f.factor, 1.22);
  assert.equal(f.nivel, 'materia');
});
prueba('10 datos de ×1,5: pesa el 77 % (≈ ×1,37)', () => cerca(factorPersonal(Array(10).fill(0).map(() => s(1.5)), 'redes', 'examen', ahora).factor, 1.37));
prueba('Señales implícitas (peso 0,5) ajustan más despacio', () => {
  const f = factorPersonal([s(1.5, { peso: 0.5 }), s(1.5, { peso: 0.5 }), s(1.5, { peso: 0.5 })], 'redes', 'examen', ahora);
  assert.ok(f.factor < 1.22 && f.factor > 1.1, `${f.factor}`);
});
prueba('Sin datos de esta materia: usa los exámenes de otras materias', () => {
  const f = factorPersonal([s(1.5, { materiaId: 'bd' }), s(1.5, { materiaId: 'bd' }), s(1.5, { materiaId: 'bd' })], 'redes', 'examen', ahora);
  assert.equal(f.nivel, 'tipo');
  cerca(f.factor, 1.22);
});
prueba('Un dato raro (×10) no descalibra: se recorta a ×4 y se mezcla', () => {
  const f = factorPersonal([s(1), s(1), s(1), s(1), s(10)], 'redes', 'examen', ahora);
  assert.ok(f.factor < 1.3, `${f.factor}`);
});
prueba('Lo de hace un año pesa menos que lo reciente', () => {
  const viejo = factorPersonal([s(2, { creadoEn: hace(360) }), s(1, { creadoEn: hace(1) })], 'redes', 'examen', ahora);
  assert.ok(viejo.factor < 1.15, `${viejo.factor}`);
});
prueba('Límites: nunca más de ×2 ni menos de ×0,5', () => {
  assert.ok(factorPersonal(Array(30).fill(0).map(() => s(4)), 'redes', 'examen', ahora).factor <= 2);
  assert.ok(factorPersonal(Array(30).fill(0).map(() => s(0.25)), 'redes', 'examen', ahora).factor >= 0.5);
});
prueba('Horas personales: 6 h × 1,22 = 7 h 30 (media hora)', () => assert.equal(aplicarFactor(6, 1.22), 7.5));

const v = (franja: SenalFranja['franja'], voto: number, dias = 1): SenalFranja => ({ franja, voto, peso: 0.5, creadoEn: hace(dias) });
prueba('Franja: sin votos suficientes, ninguna', () => assert.equal(franjaPreferida([v('noche', 1)], ahora), null));
prueba('Franja: mover bloques a la noche y sacarlos de la tarde → noche', () =>
  assert.equal(franjaPreferida([v('noche', 1), v('noche', 1), v('tarde', -1), v('noche', 1)], ahora), 'noche'));
prueba('Franja de una hora local (La Paz)', () => {
  assert.equal(franjaDe(new Date('2026-11-08T13:00:00Z'), 'America/La_Paz'), 'manana'); // 09:00
  assert.equal(franjaDe(new Date('2026-11-08T20:00:00Z'), 'America/La_Paz'), 'tarde');  // 16:00
  assert.equal(franjaDe(new Date('2026-11-09T00:30:00Z'), 'America/La_Paz'), 'noche');  // 20:30
});

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
