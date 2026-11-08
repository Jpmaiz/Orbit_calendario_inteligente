/**
 * Pruebas de la rúbrica de estimación (sin IA ni base de datos).
 * Cada caso es una lectura como la que devolvería la IA y el resultado que debe calcular el sistema.
 * Son los ejemplos del documento "Orbit: fundamento de la estimación" y los de Medicina.
 *
 * Uso: npx tsx scripts/probar-rubrica.ts
 */
import assert from 'node:assert/strict';
import { estimar, normalizarLecturaEstimacion, type LecturaEstimacion } from '../src/lib/estimacion/rubrica';

const base: LecturaEstimacion = {
  escala: null, temas: [], volumen: null, nivelCognitivo: 2, partes: false, grupal: false,
  formato: null, claridad: 'media', impostergable: false,
  cantidades: { paginasLeer: null, paginasEscribir: null, ejercicios: null, diapositivas: null, minutosExposicion: null },
};
const temas = (...n: string[]) => n.map((nombre) => ({ nombre, amplitud: 'normal' as const }));
const amplios = (...n: string[]) => n.map((nombre) => ({ nombre, amplitud: 'amplio' as const }));

type Caso = { nombre: string; tipo: string; lectura: Partial<LecturaEstimacion> | null; horas: number; dificultad: number | null; importancia?: string };

const casos: Caso[] = [
  // Documento: ejemplos de punta a punta
  { nombre: 'Final de Redes II, 5 temas, práctico', tipo: 'examen',
    lectura: { escala: 'final', temas: temas('OSPF', 'EIGRP', 'NAT', 'VLANs', 'ACL'), nivelCognitivo: 3, formato: 'practico' },
    horas: 11.5, dificultad: 4, importancia: 'alta' },
  { nombre: 'Parcial de recursividad', tipo: 'examen',
    lectura: { escala: 'parcial', temas: temas('Recursividad'), nivelCognitivo: 2, formato: 'practico' },
    horas: 4.5, dificultad: 3, importancia: 'media' },
  { nombre: 'Defensa sprint 3: 15 min, 10 diapositivas, demo, grupal', tipo: 'exposicion',
    lectura: { nivelCognitivo: 3, partes: true, grupal: true, formato: 'oral',
      cantidades: { ...base.cantidades, diapositivas: 10, minutosExposicion: 15 } },
    horas: 5, dificultad: 4, importancia: 'alta' },
  { nombre: 'Quiz del capítulo 3', tipo: 'examen',
    lectura: { escala: 'control', temas: temas('Capítulo 3'), nivelCognitivo: 1 },
    horas: 1, dificultad: 1, importancia: 'baja' },
  // Simulacro: examen de redes sin temas y después con temas
  { nombre: 'Examen de redes sin temas (claridad baja)', tipo: 'examen',
    lectura: { claridad: 'baja' }, horas: 6, dificultad: 3 },
  { nombre: 'Examen de redes con 5 temas, práctico', tipo: 'examen',
    lectura: { temas: temas('Estático', 'RIP', 'OSPF', 'EIGRP', 'NAT'), nivelCognitivo: 3, formato: 'practico' },
    horas: 6.5, dificultad: 4 },
  // Medicina
  { nombre: 'Examen de Salud Mental: atención primaria', tipo: 'examen',
    lectura: { temas: temas('Atención primaria en salud mental') }, horas: 4.5, dificultad: 2 },
  { nombre: 'Historia clínica de litiasis renal', tipo: 'tarea',
    lectura: { volumen: 'medio', nivelCognitivo: 3 }, horas: 2, dificultad: 3, importancia: 'baja' },
  { nombre: 'Oral de examen físico de abdomen (control)', tipo: 'examen',
    lectura: { escala: 'control', temas: temas('Inspección', 'Auscultación', 'Percusión', 'Palpación', 'Teoría de abdomen'), formato: 'oral' },
    horas: 1.5, dificultad: 3, importancia: 'baja' },
  { nombre: 'Tabla nefrítico vs nefrótico', tipo: 'tarea',
    lectura: { temas: temas('Síndrome nefrítico', 'Síndrome nefrótico'), nivelCognitivo: 3 }, horas: 2, dificultad: 3 },
  { nombre: 'Preparación de cirugía: apéndice y nudos', tipo: 'tarea',
    lectura: { temas: temas('Semiología de apéndice', 'Nudos quirúrgicos'), formato: 'practico' }, horas: 1.5, dificultad: 3 },
  { nombre: 'Preguntas de Fisiopatología ("20 pts" se ignora)', tipo: 'tarea',
    lectura: { volumen: 'medio' }, horas: 2, dificultad: 2, importancia: 'baja' },
  { nombre: 'Examen teórico de Semiología: cardio y digestivo (amplios)', tipo: 'examen',
    lectura: { temas: amplios('Cardiovascular', 'Digestivo') }, horas: 6, dificultad: 3 },
  { nombre: 'Final sin práctica ni nivel alto: integra todo (+0,5)', tipo: 'examen',
    lectura: { escala: 'final', temas: temas('OSPF', 'EIGRP', 'NAT', 'VLANs', 'ACL', 'Subnetting') }, horas: 11.5, dificultad: 3, importancia: 'alta' },
  { nombre: 'Cuadro comparativo de ovario, impostergable', tipo: 'entrega',
    lectura: { temas: temas('Carcinoma seroso', 'Carcinoma mucinoso', 'Tumor de células de la granulosa', 'Disgerminoma'),
      nivelCognitivo: 3, formato: 'a_mano', impostergable: true },
    horas: 3.5, dificultad: 3, importancia: 'alta' },
  // Respaldo: la IA no pudo leer
  { nombre: 'Sin lectura de la IA: centro del rango', tipo: 'examen', lectura: null, horas: 6, dificultad: null, importancia: 'media' },
  { nombre: 'Muchos temas no llegan al máximo', tipo: 'examen',
    lectura: { temas: temas(...Array.from({ length: 20 }, (_, i) => `T${i}`)) }, horas: 7, dificultad: 3 },
];

let fallas = 0;
for (const c of casos) {
  const r = estimar(c.tipo, c.lectura ? { ...base, ...c.lectura } : null);
  try {
    assert.equal(r.horas, c.horas, 'horas');
    assert.equal(r.dificultad, c.dificultad, 'dificultad');
    if (c.importancia) assert.equal(r.importancia, c.importancia, 'importancia');
    console.log(`✓ ${c.nombre}: ${r.horas} h · dificultad ${r.dificultad ?? '—'} · ${r.importancia}`);
  } catch (e) {
    fallas++;
    console.log(`✗ ${c.nombre}: ${(e as Error).message} → ${r.horas} h · dificultad ${r.dificultad} · ${r.importancia}`);
    console.log(`   razones: ${r.razones.join(' · ')}`);
  }
}

// Justicia: un factor alto sin evidencia baja a su nivel medio
const sinEvidencia = normalizarLecturaEstimacion({ nivelCognitivo: 4, volumen: 'alto', grupal: true, formato: 'practico', impostergable: true });
try {
  assert.equal(sinEvidencia?.nivelCognitivo, 2);
  assert.equal(sinEvidencia?.volumen, 'medio');
  assert.equal(sinEvidencia?.grupal, false);
  assert.equal(sinEvidencia?.formato, null);
  assert.equal(sinEvidencia?.impostergable, false);
  console.log('✓ Sin evidencia, los factores altos bajan a su nivel medio');
} catch (e) {
  fallas++;
  console.log(`✗ Evidencia: ${(e as Error).message}`);
}
const conEvidencia = normalizarLecturaEstimacion({
  nivelCognitivo: 3, grupal: true, evidencia: { nivel: 'cuadro comparativo', grupal: 'en grupos de 3' }, temas: ['OSPF', 'OSPF', { nombre: 'NAT', amplitud: 'amplio' }],
});
try {
  assert.equal(conEvidencia?.nivelCognitivo, 3);
  assert.equal(conEvidencia?.grupal, true);
  assert.deepEqual(conEvidencia?.temas, [{ nombre: 'OSPF', amplitud: 'normal' }, { nombre: 'NAT', amplitud: 'amplio' }]);
  console.log('✓ Con evidencia se respetan; los temas repetidos se juntan');
} catch (e) {
  fallas++;
  console.log(`✗ Evidencia: ${(e as Error).message}`);
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${casos.length + 2})`);
process.exit(fallas ? 1 : 0);
