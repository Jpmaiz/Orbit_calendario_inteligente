/**
 * Pruebas de la duración de exámenes y exposiciones y del resumen del plan (sin base de datos ni IA).
 *
 * Uso: npx tsx scripts/probar-duracion.ts
 */
import assert from 'node:assert/strict';
import { duracionDeTexto, duracionEntre, duracionDeItem, tipoEvaluado } from '@/lib/tareas/duracion';
import { normalizarItems } from '@/lib/ia/extraccion';
import { resumirBloques } from '@/lib/plan/resumen';

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try { fn(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}

// ── Duración ──
prueba('De 10:00 a 12:00 = 120 min; fin antes del inicio = null', () => {
  assert.equal(duracionEntre('10:00', '12:00'), 120);
  assert.equal(duracionEntre('12:00', '10:00'), null);
  assert.equal(duracionEntre('10:00', null), null);
});
prueba('Lo que dice el texto', () => {
  assert.equal(duracionDeTexto('dura 2 h'), 120);
  assert.equal(duracionDeTexto('2 horas de examen'), 120);
  assert.equal(duracionDeTexto('90 min'), 90);
  assert.equal(duracionDeTexto('1 h 30'), 90);
  assert.equal(duracionDeTexto('1:30 h'), 90);
  assert.equal(duracionDeTexto('1,5 horas'), 90);
  assert.equal(duracionDeTexto('hora y media'), 90);
});
prueba('Por grupo o por persona no es la duración del usuario; sin dato = null', () => {
  assert.equal(duracionDeTexto('15 min por grupo'), null);
  assert.equal(duracionDeTexto('10 minutos por persona'), null);
  assert.equal(duracionDeTexto('en el laboratorio'), null);
  assert.equal(duracionDeTexto(null), null);
});
prueba('Solo examen y exposición tienen duración; el rango manda sobre el texto', () => {
  assert.equal(duracionDeItem({ tipo: 'examen', hora: '10:00', horaFin: '12:00', duracion: '3 h' }), 120);
  assert.equal(duracionDeItem({ tipo: 'exposicion', hora: null, horaFin: null, duracion: 'dura 45 min' }), 45);
  assert.equal(duracionDeItem({ tipo: 'entrega', hora: '10:00', horaFin: '12:00', duracion: null }), null);
  assert.equal(duracionDeItem({ tipo: 'examen', hora: '10:00', horaFin: null, duracion: null }), null);
});
prueba('tipoEvaluado: examen, parcial, final, exposición, defensa', () => {
  assert.equal(tipoEvaluado('Examen de Redes'), 'examen');
  assert.equal(tipoEvaluado('Segundo parcial de Cálculo'), 'examen');
  assert.equal(tipoEvaluado('Exposición de Taller'), 'exposicion');
  assert.equal(tipoEvaluado('Defensa del proyecto'), 'exposicion');
  assert.equal(tipoEvaluado('Reunión de grupo'), null);
  assert.equal(tipoEvaluado('Repaso para el examen'), null);
});

// ── La IA trae un examen como evento ──
const leidos = normalizarItems({ items: [
  { clase: 'evento', titulo: 'Examen de Redes', fechaDicha: { tipo: 'relativa', dias: 2 }, hora: '10:00', horaFin: '12:00', confianza: 0.9, evidencia: 'examen de 10 a 12',
    preparacion: { titulo: 'OSPF', estimacion: { temas: ['OSPF', 'NAT'], nivelCognitivo: 2 } } },
  { clase: 'evento', titulo: 'Reunión de grupo', fechaDicha: { tipo: 'relativa', dias: 1 }, hora: '15:00', horaFin: '16:00', confianza: 0.9, evidencia: 'reunión' },
] });
prueba('Un evento que se llama "Examen…" se guarda como tarea tipo examen, con su duración y lo que hay que estudiar', () => {
  const e = leidos[0];
  assert.equal(e.clase, 'tarea');
  assert.equal(e.tipo, 'examen');
  assert.equal(e.tipoSeguro, true);
  assert.equal(e.preparacion, null);
  assert.deepEqual(e.estimacion?.temas.map((t) => t.nombre), ['OSPF', 'NAT']);
  assert.equal(duracionDeItem(e), 120);
});
prueba('Un evento normal sigue siendo evento', () => assert.equal(leidos[1].clase, 'evento'));

// ── Resumen del plan ──
const h = (s: string) => new Date(s);
const ahora = h('2026-11-18T16:00:00Z');
const planes = resumirBloques([
  { tareaId: 'a', inicio: h('2026-11-10T14:00:00Z'), fin: h('2026-11-10T15:00:00Z') }, // pasado (cuenta)
  { tareaId: 'a', inicio: h('2026-12-02T14:00:00Z'), fin: h('2026-12-02T15:30:00Z') }, // fuera del mes (cuenta)
  { tareaId: 'a', inicio: h('2026-11-20T14:00:00Z'), fin: h('2026-11-20T15:00:00Z') },
  { tareaId: 'b', inicio: h('2026-11-18T15:30:00Z'), fin: h('2026-11-18T16:30:00Z') }, // en curso
], ahora);
prueba('Cuenta todos los bloques (pasados y fuera del rango) y el próximo que no terminó', () => {
  assert.deepEqual(planes.get('a'), { bloques: 3, minutos: 210, proximo: '2026-11-20T14:00:00.000Z' });
  assert.deepEqual(planes.get('b'), { bloques: 1, minutos: 60, proximo: '2026-11-18T15:30:00.000Z' });
  assert.equal(planes.get('c'), undefined); // sin bloques → plan: null en la API
});
prueba('Si todos ya pasaron, proximo = null', () => {
  const p = resumirBloques([{ tareaId: 'x', inicio: h('2026-11-01T10:00:00Z'), fin: h('2026-11-01T11:00:00Z') }], ahora);
  assert.equal(p.get('x')?.proximo, null);
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
