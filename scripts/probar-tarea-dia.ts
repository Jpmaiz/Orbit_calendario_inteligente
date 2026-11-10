/**
 * Pruebas de la tarjeta de tarea en "Tu día" (sin base de datos):
 * estimado público de tareas guardadas, horas libres reales y "te faltarían ~X h".
 *
 * Uso: npx tsx scripts/probar-tarea-dia.ts
 */
import assert from 'node:assert/strict';
import { estimadoPublico, tareaPublica } from '../src/lib/estimacion/publico';
import { disponibilidadDe } from '../src/lib/plan/disponibilidad';
import { priorizarTareas } from '../src/lib/prioridad';

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try { fn(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}

const lectura = {
  escala: 'final', temas: [{ nombre: 'OSPF', amplitud: 'normal' }, { nombre: 'NAT', amplitud: 'normal' }], volumen: null,
  nivelCognitivo: 3, partes: false, grupal: false, formato: 'practico', claridad: 'media', impostergable: false,
  cantidades: { paginasLeer: null, paginasEscribir: null, ejercicios: null, diapositivas: null, minutosExposicion: null },
};
const guardada = {
  id: 't1', tipo: 'examen', duracionEstMin: 330, dificultad: 4, horasDelUsuario: false,
  estimacion: { horas: 5.5, factorPersonal: 1.1, dificultad: 4, razones: ['Es un examen final (8–14 h)'], lectura },
};

// ── A. Estimado público ──
prueba('Tarea guardada con lectura: horas, carga y razones simples', () => {
  const e = estimadoPublico(guardada)!;
  assert.equal(e.horas, 5.5);
  assert.equal(e.carga, 'pesada');
  assert.equal(e.razones[0], 'Examen final: integra todo el semestre');
  assert.ok(e.razones.every((r) => r.length <= 60 && !/–|\(\d/.test(r)));
});
prueba('Horas puestas por el usuario: sin razones', () => {
  assert.deepEqual(estimadoPublico({ ...guardada, horasDelUsuario: true })!.razones, []);
});
prueba('Creada a mano (sin estimación): sin razones; sin horas: null', () => {
  assert.deepEqual(estimadoPublico({ tipo: 'tarea', duracionEstMin: 90, dificultad: null, estimacion: null }), { horas: 1.5, carga: 'media', razones: [] });
  assert.equal(estimadoPublico({ tipo: 'tarea', duracionEstMin: null, estimacion: null }), null);
});
prueba('La IA no pudo leer (origen general): razones generales', () => {
  assert.equal(estimadoPublico({ tipo: 'tarea', duracionEstMin: 120, estimacion: { origen: 'general', lectura: null } })!.razones[0],
    'Estimación general para este tipo de actividad');
});
prueba('Lectura con forma vieja: no rompe', () => {
  assert.deepEqual(estimadoPublico({ tipo: 'tarea', duracionEstMin: 60, estimacion: { lectura: { puntos: 20 } } })!.razones, []);
});
prueba('tareaPublica quita la estimación interna', () => {
  const p = tareaPublica(guardada) as Record<string, unknown>;
  assert.equal('estimacion' in p, false);
  assert.equal(JSON.stringify(p).includes('factorPersonal'), false);
  assert.ok(p.estimado);
});

// ── B. Horas libres reales ──
const ahora = new Date('2026-11-10T14:00:00Z'); // 10:00 en La Paz
const h = (iso: string) => new Date(iso);
const hueco = (a: string, b: string) => ({ inicio: h(a), fin: h(b), minutos: (h(b).getTime() - h(a).getTime()) / 60000 });
const datos = {
  dias: [
    { dia: '2026-11-10', diaSemana: 2, huecos: [hueco('2026-11-10T13:00:00Z', '2026-11-10T15:00:00Z')], libresMin: 120 }, // 09–11
    { dia: '2026-11-11', diaSemana: 3, huecos: [hueco('2026-11-11T11:00:00Z', '2026-11-11T17:00:00Z')], libresMin: 360 }, // 07–13
  ],
  bloques: [{ tareaId: 't1', inicio: h('2026-11-11T11:00:00Z'), fin: h('2026-11-11T12:00:00Z') }],
  horasPorDia: 3,
  horizonte: h('2026-11-12T04:00:00Z').getTime(),
};
const libre = disponibilidadDe(datos);

prueba('libresHasta recorta desde ahora y respeta el tope de 4 h por día', () => {
  assert.equal(libre.libresHasta(h('2026-11-10T15:00:00Z'), ahora), 1); // hoy 10–11
  assert.equal(libre.libresHasta(h('2026-11-11T13:00:00Z'), ahora), 3); // 1 h hoy + 2 h mañana 07–09
  assert.equal(libre.libresHasta(h('2026-11-11T20:00:00Z'), ahora), 5); // 1 h + tope 4 h
  assert.equal(libre.libresHasta(h('2026-11-10T13:00:00Z'), ahora), 0); // ya pasó
});
prueba('Más allá del horizonte suma el promedio por día', () => {
  assert.equal(libre.libresHasta(h('2026-11-13T04:00:00Z'), ahora), 8); // 5 h + 1 día × 3 h
});
prueba('planificadas cuenta los bloques de esa tarea antes de su fecha', () => {
  assert.equal(libre.planificadas('t1', h('2026-11-12T00:00:00Z'), ahora), 1);
  assert.equal(libre.planificadas('t2', h('2026-11-12T00:00:00Z'), ahora), 0);
});

const tarea = (id: string, fechaLimite: string, min: number) =>
  ({ id, tipo: 'examen', fechaLimite: h(fechaLimite), prioridad: 'media', estado: 'pendiente', duracionEstMin: min, dificultad: 3 });
const tiempo = {
  libresHasta: (fin: Date) => libre.libresHasta(fin, ahora),
  planificadas: (t: { id: string; fechaLimite: Date }) => libre.planificadas(t.id, t.fechaLimite, ahora),
};

prueba('Hasta mañana 09:00: ~3 h libres, faltarían ~2 h 30', () => {
  const [r] = priorizarTareas([tarea('t2', '2026-11-11T13:00:00Z', 330)], ahora, undefined, tiempo);
  assert.equal(r.prioridadCalculada.horasLibres, 3);
  assert.equal(r.prioridadCalculada.faltanHoras, 2.5);
});
prueba('Lo que vence antes se descuenta; los bloques propios suman', () => {
  const r = priorizarTareas([tarea('t1', '2026-11-11T20:00:00Z', 330), tarea('t3', '2026-11-10T16:00:00Z', 60)], ahora, undefined, tiempo);
  const t1 = r.find((x) => x.id === 't1')!.prioridadCalculada;
  // 5 h libres − 1 h de t3 + 1 h ya planificada de t1 = 5 h; faltan 5,5 − 5 = 0,5
  assert.equal(t1.horasLibres, 5);
  assert.equal(t1.faltanHoras, 0.5);
});
prueba('Sin tiempo real: igual vienen horasLibres y faltanHoras (promedio)', () => {
  const [r] = priorizarTareas([tarea('t2', '2026-11-12T14:00:00Z', 120)], ahora);
  assert.equal(typeof r.prioridadCalculada.horasLibres, 'number');
  assert.equal(r.prioridadCalculada.faltanHoras, 0);
});
prueba('Cerradas y vencidas: 0', () => {
  const r = priorizarTareas([{ ...tarea('t4', '2026-11-09T14:00:00Z', 60) }, { ...tarea('t5', '2026-11-12T14:00:00Z', 60), estado: 'completada' }], ahora, undefined, tiempo);
  for (const x of r) { assert.equal(x.prioridadCalculada.faltanHoras, 0); assert.equal(x.prioridadCalculada.horasLibres, 0); }
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
