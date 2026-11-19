/**
 * Pruebas de la validación del plan que guarda el usuario (POST /api/plan/{tareaId}), sin base de datos.
 *
 * Uso: npx tsx scripts/probar-validar-plan.ts
 */
import assert from 'node:assert/strict';
import { validarPlan, limiteParaGuardar, enCurso } from '@/lib/plan/validarPlan';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

const ZONA = 'America/La_Paz';
const en = (d: number, h: string) => instanteEnZona({ y: 2026, m: 11, d }, h, ZONA);
const ahora = en(10, '14:38');
const ocupaciones = [{ inicio: en(11, '09:00'), fin: en(11, '10:00'), titulo: 'Redes II' }];
const limite = en(12, '09:00');
const b = (d: number, i: string, f: string, extra: Record<string, unknown> = {}) => ({ inicio: en(d, i).toISOString(), fin: en(d, f).toISOString(), ...extra });
const opc = { limite, ahora, zona: ZONA, ocupaciones, enCurso: [] as { inicio: Date; fin: Date }[] };

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try { fn(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}
const error = (r: ReturnType<typeof validarPlan>) => (r.ok ? '' : r.error);

prueba('Acepta cuartos de hora y 30 min, pegado a una clase (sin margen)', () => {
  const r = validarPlan({ bloques: [b(11, '10:00', '10:45'), b(11, '08:30', '09:00', { origen: 'orbit', tipo: 'repaso' })] }, opc);
  assert.ok(r.ok, error(r));
  if (r.ok) {
    assert.equal(r.bloques[0].origen, 'orbit');
    assert.equal(r.bloques[0].tipo, 'repaso');
    assert.equal(r.bloques[1].origen, 'usuario'); // sin dato = usuario
  }
});
prueba('Rechaza minutos fuera de cuarto de hora', () => assert.match(error(validarPlan({ bloques: [b(11, '10:10', '11:00')] }, opc)), /:00, :15/));
prueba('Rechaza menos de 30 min', () => assert.match(error(validarPlan({ bloques: [b(11, '10:00', '10:15')] }, opc)), /al menos 30/));
prueba('Rechaza si empieza antes de ahora (vale el cuarto de hora actual)', () => {
  assert.match(error(validarPlan({ bloques: [b(10, '14:15', '15:00')] }, opc)), /antes de ahora/);
  assert.ok(validarPlan({ bloques: [b(10, '14:30', '15:30')] }, opc).ok);
});
prueba('Rechaza si termina después de la fecha', () => assert.match(error(validarPlan({ bloques: [b(12, '08:30', '09:15')] }, opc)), /después de la fecha/));
prueba('Rechaza cruces con una clase, con su nombre', () => assert.match(error(validarPlan({ bloques: [b(11, '09:30', '10:30')] }, opc)), /Redes II/));
prueba('Rechaza dos bloques del plan que se cruzan', () => {
  assert.match(error(validarPlan({ bloques: [b(11, '11:00', '12:00'), b(11, '11:30', '12:30')] }, opc)), /se cruzan/);
});
prueba('No valida el tope de 4 h por día', () => {
  assert.ok(validarPlan({ bloques: [b(11, '10:00', '14:00'), b(11, '14:00', '16:00')] }, opc).ok);
});
prueba('Sin hora definida: el límite es el fin de ese día', () => {
  const l = limiteParaGuardar({ fechaLimite: en(12, '08:00'), horaDefinida: false }, ZONA);
  assert.equal(l.toISOString(), en(13, '00:00').toISOString());
  assert.equal(limiteParaGuardar({ fechaLimite: en(12, '08:00'), horaDefinida: true }, ZONA).toISOString(), en(12, '08:00').toISOString());
});
prueba('Bloque en curso: si se reenvía igual se ignora; si se pisa, se rechaza', () => {
  const curso = enCurso([{ inicio: en(10, '14:00'), fin: en(10, '15:00') }, { inicio: en(11, '11:00'), fin: en(11, '12:00') }], ahora);
  assert.equal(curso.length, 1);
  const o = { ...opc, enCurso: curso };
  const r = validarPlan({ bloques: [b(10, '14:00', '15:00'), b(11, '11:00', '12:00')] }, o);
  assert.ok(r.ok && r.bloques.length === 1, error(r));
  assert.match(error(validarPlan({ bloques: [b(10, '14:45', '15:30')] }, o)), /en curso/);
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
