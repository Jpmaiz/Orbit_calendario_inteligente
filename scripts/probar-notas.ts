/**
 * Pruebas de la tarjeta del borrador (sin IA ni base de datos):
 * razones para el usuario, notas por categoría, tipo seguro y que prepararItems ya no ensucie la descripción.
 *
 * Uso: npx tsx scripts/probar-notas.ts
 */
import assert from 'node:assert/strict';
import { razonesParaUsuario, type LecturaEstimacion } from '../src/lib/estimacion/rubrica';
import { notasDeItem, normalizarNotas, notasDeIA } from '../src/lib/borrador/notas';
import { normalizarItems } from '../src/lib/ia/extraccion';
import { prepararItems } from '../src/lib/borrador/prepararItems';

const base: LecturaEstimacion = {
  escala: null, temas: [], volumen: null, nivelCognitivo: 2, partes: false, grupal: false,
  formato: null, claridad: 'media', impostergable: false,
  cantidades: { paginasLeer: null, paginasEscribir: null, ejercicios: null, diapositivas: null, minutosExposicion: null },
};
const temas = (...n: string[]) => n.map((nombre) => ({ nombre, amplitud: 'normal' as const }));

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✓ ${nombre}`);
  } catch (e) {
    fallas++;
    console.log(`✗ ${nombre}: ${(e as Error).message}`);
  }
}

/** Reglas de toda razón visible: máx. 3, ≤ 60 caracteres, sin rangos ni horas de la rúbrica. */
function razonesValidas(r: string[]) {
  assert.ok(r.length >= 1 && r.length <= 3, `cantidad ${r.length}`);
  for (const x of r) {
    assert.ok(x.length <= 60, `muy larga (${x.length}): ${x}`);
    assert.ok(!/\d+\s*–\s*\d+|\(\d|\brango\b|\bfactor\b/i.test(x), `tiene números internos: ${x}`);
  }
}

// ── Razones ──
prueba('Final de Redes: final + temas + análisis', () => {
  const r = razonesParaUsuario('examen', { ...base, escala: 'final', temas: temas('OSPF', 'EIGRP', 'NAT', 'VLANs', 'ACL'), nivelCognitivo: 3, formato: 'practico' });
  razonesValidas(r);
  assert.equal(r[0], 'Examen final: integra todo el semestre');
  assert.match(r[1], /^Temas: OSPF, EIGRP/);
});
prueba('Exposición grupal con diapositivas', () => {
  const r = razonesParaUsuario('exposicion', { ...base, nivelCognitivo: 3, partes: true, grupal: true, formato: 'oral',
    cantidades: { ...base.cantidades, diapositivas: 10, minutosExposicion: 15 } });
  razonesValidas(r);
  assert.equal(r[0], '10 diapositivas, 15 min de exposición');
  assert.ok(r.includes('Tiene varias partes y es en grupo'));
});
prueba('Muchos temas con nombres largos no pasan de 60 caracteres', () => {
  const r = razonesParaUsuario('examen', { ...base, temas: temas('Glomerulonefritis postestreptocócica', 'Síndrome nefrótico', 'Insuficiencia renal aguda', 'Litiasis') });
  razonesValidas(r);
  assert.match(r[0], /y \d más$/);
});
prueba('Un tema amplio', () => {
  const r = razonesParaUsuario('examen', { ...base, temas: [{ nombre: 'Cardio', amplitud: 'amplio' }] });
  razonesValidas(r);
  assert.equal(r[0], 'Tema: Cardio (tema amplio)');
});
prueba('Sin lectura de la IA: estimación general', () => {
  const r = razonesParaUsuario('tarea', null);
  razonesValidas(r);
  assert.equal(r[0], 'Estimación general para este tipo de actividad');
});
prueba('Sin temas ni cantidades', () => {
  const r = razonesParaUsuario('entrega', { ...base });
  razonesValidas(r);
  assert.deepEqual(r, ['El mensaje no dice qué temas entran']);
});
prueba('Control corto', () => {
  const r = razonesParaUsuario('examen', { ...base, escala: 'control', temas: temas('Nudos') });
  razonesValidas(r);
  assert.equal(r[0], 'Es un control: suele entrar poco');
});

// ── Lo que lee la IA → ítems ──
const crudo = {
  items: [
    { clase: 'evento', titulo: 'Cirugía', fechaDicha: { tipo: 'relativa', dias: 2 }, hora: '08:00',
      preparativos: ['Llevar bata', 'Llevar bata'], referencias: [], confianza: 0.9, evidencia: 'cirugía el miércoles, llevar bata',
      preparacion: { titulo: 'Semiología', estimacion: { temas: ['Semiología de apéndice', 'Nudos'], nivelCognitivo: 2 } } },
    { clase: 'tarea', titulo: 'Exposición de Redes', tipo: 'exposicion', tipoSeguro: true, duracion: '15 min por grupo',
      referencias: ['Cisco CCNA 2'], descripcion: 'En el laboratorio 3', confianza: 0.9, evidencia: 'exposición de 15 min por grupo',
      estimacion: { temas: ['OSPF'], nivelCognitivo: 3, evidencia: { nivel: 'exponer' } } },
    { clase: 'tarea', titulo: 'Informe', tipo: 'algo', confianza: 0.8, evidencia: 'el informe' },
    { clase: 'tarea', titulo: 'Práctica 4', tipo: 'tarea', tipoSeguro: false, confianza: 0.8, evidencia: 'la práctica 4' },
  ],
};
const leidos = normalizarItems(crudo);

prueba('tipoSeguro: dicho, inválido y deducido', () => {
  assert.equal(leidos[1].tipoSeguro, true);
  assert.equal(leidos[2].tipoSeguro, false); // tipo inválido → "tarea" por defecto, no es seguro
  assert.equal(leidos[3].tipoSeguro, false);
  assert.equal(leidos[0].tipoSeguro, true); // eventos: no se pregunta
});
prueba('duracion se lee', () => assert.equal(leidos[1].duracion, '15 min por grupo'));

const items = prepararItems(leidos);
prueba('prepararItems ya no copia "Llevar:" ni "Temas:" a la descripción', () => {
  for (const it of items) assert.ok(!/^(Llevar|Bibliografía|Temas):/m.test(it.descripcion ?? ''), it.descripcion ?? '');
  const prep = items.find((i) => i.titulo.startsWith('Preparación'));
  assert.ok(prep);
  assert.equal(prep!.descripcion, null);
});
prueba('Notas del evento: llevar (sin repetir) y sin los temas de su preparación', () => {
  assert.deepEqual(notasDeItem(items[0]), [{ categoria: 'llevar', texto: 'Llevar bata' }]);
});
prueba('Notas de la preparación: un tema por nota', () => {
  const prep = items.find((i) => i.titulo.startsWith('Preparación'))!;
  assert.deepEqual(notasDeItem(prep), [
    { categoria: 'temas', texto: 'Semiología de apéndice' }, { categoria: 'temas', texto: 'Nudos' },
  ]);
});
prueba('Notas de la exposición, en orden de categoría', () => {
  const expo = items.find((i) => i.titulo === 'Exposición de Redes')!;
  assert.deepEqual(notasDeItem(expo), [
    { categoria: 'temas', texto: 'OSPF' },
    { categoria: 'bibliografia', texto: 'Cisco CCNA 2' },
    { categoria: 'duracion', texto: '15 min por grupo' },
    { categoria: 'otros', texto: 'En el laboratorio 3' },
  ]);
});
prueba('Interpretación guardada antes de este cambio (sin campos nuevos)', () => {
  assert.deepEqual(notasDeItem({ titulo: 'Viejo', preparativos: ['Calculadora'] }), [{ categoria: 'llevar', texto: 'Calculadora' }]);
});

// ── Validación de notas que manda el front ──
prueba('normalizarNotas: undefined, inválidas y válidas', () => {
  assert.equal(normalizarNotas(undefined), undefined);
  assert.equal(normalizarNotas('hola'), null);
  assert.equal(normalizarNotas([{ categoria: 'usuario', texto: 'x' }]), null);
  assert.deepEqual(normalizarNotas([]), []);
  assert.deepEqual(normalizarNotas([{ categoria: 'otros', texto: '  aula   5 ' }, { categoria: 'llevar', texto: 'Bata' }, { categoria: 'llevar', texto: 'bata' }]),
    [{ categoria: 'llevar', texto: 'Bata' }, { categoria: 'otros', texto: 'aula 5' }]);
});
prueba('notasDeIA descarta lo inválido sin rechazar todo', () => {
  assert.deepEqual(notasDeIA([{ categoria: 'temas', texto: 'NAT' }, { categoria: 'chisme', texto: 'x' }, null, { categoria: 'llevar' }]),
    [{ categoria: 'temas', texto: 'NAT' }]);
  assert.deepEqual(notasDeIA('nada'), []);
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
