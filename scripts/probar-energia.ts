/**
 * Pruebas de la energía por momento del día (D23), sin base de datos ni IA:
 * "Mi ritmo" sin texto libre, cada estudio a su momento, lo que se aprende de los bloques movidos,
 * la sugerencia de cambio, "¿Cómo estás hoy?" (mover un bloque) y "sueles tener poca energía los lunes".
 *
 * Uso: npx tsx scripts/probar-energia.ts
 */
import assert from 'node:assert/strict';
import { ENERGIA_NORMAL, leerRitmo, momentoDeMinuto, normalizarRitmo, franjaCompatible, RITMO_POR_DEFECTO, type Energia } from '@/lib/usuarios/ritmo';
import { energiaEfectiva, patronCansancio, votosDelPlan } from '@/lib/aprendizaje/energia';
import { demandaDe, planificar, topeEstudio, ubicarBloque, type TareaAPlanificar } from '@/lib/plan/planificador';
import { huecosLibres } from '@/lib/plan/huecos';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

const ZONA = 'America/La_Paz';
const en = (d: number, h: string) => instanteEnZona({ y: 2026, m: 11, d }, h, ZONA);
const hora = (f: Date) => new Intl.DateTimeFormat('es-BO', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
const dia = (f: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(f);
const E = (x: Partial<Energia>): Energia => ({ ...ENERGIA_NORMAL, ...x });

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try { fn(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}

// ── Mi ritmo: todo con toques ──
prueba('Ritmo viejo con franja "noche" → noche alta y ya no se vuelve a preguntar', () => {
  const r = leerRitmo({ desde: '08:00', hasta: '22:00', maxHorasDia: 3, diasLibres: [7], franja: 'noche' });
  assert.equal(r.energia.noche, 'alta');
  assert.equal(r.energia.tarde, 'normal');
  assert.equal(r.energiaPreguntada, true);
  assert.equal(franjaCompatible(r.energia), 'noche');
});
prueba('Las dos preguntas: mejor = noche, cuesta = mediodía', () => {
  const r = normalizarRitmo({ energia: { noche: 'alta', mediodia: 'baja' }, energiaPreguntada: true }, RITMO_POR_DEFECTO);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.ritmo.energia, E({ noche: 'alta', mediodia: 'baja' }));
});
prueba('Rechaza momentos y niveles que no existen', () => {
  assert.equal(normalizarRitmo({ energia: { madrugada: 'alta' } }, RITMO_POR_DEFECTO).ok, false);
  assert.equal(normalizarRitmo({ energia: { noche: 'muy alta' } }, RITMO_POR_DEFECTO).ok, false);
  assert.equal(normalizarRitmo({ menosEstudio: [8] }, RITMO_POR_DEFECTO).ok, false);
});
prueba('Momentos del día: 11:59 mañana · 12:00 mediodía · 15:00 tarde · 19:00 noche', () => {
  assert.deepEqual([719, 720, 900, 1140].map(momentoDeMinuto), ['manana', 'mediodia', 'tarde', 'noche']);
});
prueba('Días con menos estudio: la mitad del tope, nunca menos de 1 h', () => {
  assert.equal(topeEstudio(1, 240, [1]), 120);
  assert.equal(topeEstudio(2, 240, [1]), 240);
  assert.equal(topeEstudio(1, 90, [1]), 60);
});

// ── Qué pide cada actividad ──
prueba('Demanda: nivel 3–4 o proyecto = profundo; nivel 1–2 = práctica', () => {
  assert.equal(demandaDe({ tipo: 'examen', estimacion: { lectura: { nivelCognitivo: 3 } } }), 'profundo');
  assert.equal(demandaDe({ tipo: 'examen', estimacion: { lectura: { nivelCognitivo: 2 } } }), 'practica');
  assert.equal(demandaDe({ tipo: 'proyecto', estimacion: { lectura: { nivelCognitivo: 2 } } }), 'profundo');
  assert.equal(demandaDe({ tipo: 'tarea' }), 'practica');
  assert.equal(demandaDe({ tipo: 'examen' }), 'profundo');
});

// ── Cada estudio a su momento ──
const libre = (d: number) => huecosLibres(en(d, '00:00'), en(d, '23:59'), [], ZONA, en(d, '00:00'));
const tarea = (horas: number): TareaAPlanificar => ({ titulo: 'Informe', tipo: 'tarea', fechaLimite: en(20, '23:59'), horaDefinida: true, horas });
const ahora = en(20, '00:00');

prueba('Sin datos (todo normal): el orden de siempre, desde la tarde', () => {
  const p = planificar(tarea(1), { dias: libre(20), zona: ZONA }, ahora);
  assert.equal(hora(p.bloques[0].inicio), '15:00');
  assert.equal(p.bloques[0].razon, null);
});
prueba('Profundo con la noche alta: a las 19:00 y con su razón', () => {
  const p = planificar(tarea(1), { dias: libre(20), zona: ZONA, energia: E({ noche: 'alta' }), demanda: 'profundo' }, ahora);
  assert.equal(hora(p.bloques[0].inicio), '19:00');
  assert.equal(p.bloques[0].momento, 'noche');
  assert.equal(p.bloques[0].razon, 'Tu mejor momento');
});
prueba('Profundo nunca donde la energía es baja si hay otro hueco', () => {
  // Libre solo de 13:00 a 22:30; tarde y noche bajas → va al mediodía
  const dias = huecosLibres(en(20, '00:00'), en(20, '23:59'), [{ inicio: en(20, '07:00'), fin: en(20, '12:45'), titulo: 'Clases' }], ZONA, en(20, '00:00'));
  const p = planificar(tarea(1), { dias, zona: ZONA, energia: E({ tarde: 'baja', noche: 'baja' }), demanda: 'profundo' }, ahora);
  assert.equal(p.bloques[0].momento, 'mediodia');
});
prueba('Si solo queda un momento de energía baja: igual arma el plan y lo dice', () => {
  const dias = huecosLibres(en(20, '00:00'), en(20, '23:59'), [{ inicio: en(20, '07:00'), fin: en(20, '18:45'), titulo: 'Clases' }], ZONA, en(20, '00:00'));
  const p = planificar(tarea(2), { dias, zona: ZONA, energia: E({ noche: 'baja' }), demanda: 'profundo' }, ahora);
  assert.equal(p.minutosPlanificados, 120);
  assert.equal(p.bloques[0].razon, 'Único hueco libre antes de la fecha');
});
prueba('Práctica sí puede ir con energía normal aunque haya alta en otro momento', () => {
  const p = planificar(tarea(1), { dias: libre(20), zona: ZONA, energia: E({ noche: 'alta' }), demanda: 'practica' }, ahora);
  assert.ok(['tarde', 'noche'].includes(p.bloques[0].momento));
});
prueba('Repaso del examen: al final del día anterior', () => {
  const ex: TareaAPlanificar = { titulo: 'Examen', tipo: 'examen', fechaLimite: en(23, '08:00'), horaDefinida: false, horas: 4 };
  const dias = huecosLibres(en(20, '00:00'), en(22, '23:59'), [], ZONA, en(20, '00:00'));
  const p = planificar(ex, { dias, zona: ZONA, demanda: 'profundo' }, ahora);
  const repaso = p.bloques.find((b) => b.tipo === 'repaso')!;
  assert.equal(dia(repaso.inicio), '2026-11-22');
  assert.equal(`${hora(repaso.inicio)}–${hora(repaso.fin)}`, '21:30–22:30');
  assert.equal(repaso.razon, 'Repaso al final del día');
});
prueba('Repaso con la noche baja: al final de la tarde', () => {
  const ex: TareaAPlanificar = { titulo: 'Examen', tipo: 'examen', fechaLimite: en(23, '08:00'), horaDefinida: false, horas: 4 };
  const dias = huecosLibres(en(20, '00:00'), en(22, '23:59'), [], ZONA, en(20, '00:00'));
  const p = planificar(ex, { dias, zona: ZONA, demanda: 'profundo', energia: E({ noche: 'baja' }) }, ahora);
  const repaso = p.bloques.find((b) => b.tipo === 'repaso')!;
  assert.equal(hora(repaso.fin), '19:00');
});
prueba('Los lunes con menos estudio: el plan no pasa de 2 h ese día', () => {
  // 23 de noviembre de 2026 es lunes
  const t: TareaAPlanificar = { titulo: 'Proyecto', tipo: 'entrega', fechaLimite: en(23, '23:59'), horaDefinida: true, horas: 4 };
  const p = planificar(t, { dias: libre(23), zona: ZONA, diasMenosEstudio: [1] }, en(23, '00:00'));
  assert.equal(p.minutosPlanificados, 120);
  assert.ok(p.faltanMin > 0);
});

// ── Lo que aprende de los bloques movidos ──
const prop = [{ inicio: en(20, '15:00'), fin: en(20, '16:00') }, { inicio: en(21, '15:00'), fin: en(21, '16:00') }];
prueba('Mover a otra hora del MISMO día: +1 a la noche y −1 a la tarde', () => {
  const v = votosDelPlan(prop, [
    { inicio: en(20, '20:00'), fin: en(20, '21:00'), origen: 'usuario' },
    { inicio: en(21, '15:00'), fin: en(21, '16:00'), origen: 'orbit' },
  ], ZONA);
  assert.deepEqual(v, [{ momento: 'noche', voto: 1, peso: 0.5 }, { momento: 'tarde', voto: -1, peso: 0.5 }]);
});
prueba('Mover a OTRO día: no vota', () => {
  const v = votosDelPlan(prop, [
    { inicio: en(22, '15:00'), fin: en(22, '16:00'), origen: 'usuario' },
    { inicio: en(21, '15:00'), fin: en(21, '16:00'), origen: 'orbit' },
  ], ZONA);
  assert.deepEqual(v, []);
});
prueba('Agregar un bloque propio: +1 · borrar uno sin reemplazo: −0,5', () => {
  const agregado = votosDelPlan(prop, [
    ...prop.map((p) => ({ ...p, origen: 'orbit' })), { inicio: en(21, '20:00'), fin: en(21, '21:00'), origen: 'usuario' },
  ], ZONA);
  assert.deepEqual(agregado, [{ momento: 'noche', voto: 1, peso: 0.5 }]);
  const borrado = votosDelPlan(prop, [{ ...prop[0], origen: 'orbit' }], ZONA);
  assert.deepEqual(borrado, [{ momento: 'tarde', voto: -1, peso: 0.25 }]);
});

const voto = (momento: 'noche' | 'tarde', n: number, dias = 1) =>
  Array.from({ length: n }, () => ({ momento, voto: 1, peso: 0.5, creadoEn: new Date(ahora.getTime() - dias * 86_400_000) }));
prueba('"No sé": con 3 puntos y 2 de ventaja, la noche pasa a alta (aprendido)', () => {
  const ef = energiaEfectiva(ENERGIA_NORMAL, voto('noche', 3), ahora);
  assert.equal(ef.energia.noche, 'alta');
  assert.deepEqual(ef.aprendidos, ['noche']);
});
prueba('Con 2 puntos todavía no', () => assert.deepEqual(energiaEfectiva(ENERGIA_NORMAL, voto('noche', 2), ahora).aprendidos, []));
prueba('Lo viejo pesa menos: 3 votos de hace 8 meses no alcanzan', () => {
  assert.deepEqual(energiaEfectiva(ENERGIA_NORMAL, voto('noche', 3, 240), ahora).aprendidos, []);
});
prueba('Si eligió la tarde, su elección manda; con 5 puntos a la noche, se le pregunta', () => {
  const elegida = E({ tarde: 'alta' });
  const pocos = energiaEfectiva(elegida, voto('noche', 4), ahora);
  assert.equal(pocos.energia.noche, 'normal');
  assert.equal(pocos.sugerencia, null);
  const muchos = energiaEfectiva(elegida, voto('noche', 5), ahora);
  assert.equal(muchos.energia.tarde, 'alta');
  assert.deepEqual(muchos.sugerencia?.cambio, { noche: 'alta', tarde: 'normal' });
  assert.match(muchos.sugerencia?.texto ?? '', /la noche/);
});
prueba('Si marcó la noche como baja y la usa mucho, también se le pregunta (no se cambia solo)', () => {
  const ef = energiaEfectiva(E({ noche: 'baja' }), voto('noche', 5), ahora);
  assert.equal(ef.energia.noche, 'baja');
  assert.ok(ef.sugerencia);
});

// ── ¿Cómo estás hoy? ──
prueba('Cansado: un bloque profundo pasa al día siguiente, en el mejor momento', () => {
  const dias = huecosLibres(en(21, '00:00'), en(22, '23:59'), [], ZONA, en(21, '00:00'));
  const usado = new Map<string, number>();
  const b = ubicarBloque(dias, 60, 'profundo', {
    zona: ZONA, ahora: en(21, '00:00'), limite: en(23, '00:00'), energia: E({ noche: 'alta' }), topeDia: () => 240, usadoPorDia: usado,
  });
  assert.ok(b);
  assert.equal(dia(b!.inicio), '2026-11-21');
  assert.equal(hora(b!.inicio), '19:00');
  assert.equal(usado.get('2026-11-21'), 60);
  // El segundo bloque no se encima con el primero
  const b2 = ubicarBloque(dias, 60, 'profundo', {
    zona: ZONA, ahora: en(21, '00:00'), limite: en(23, '00:00'), energia: E({ noche: 'alta' }), topeDia: () => 240, usadoPorDia: usado,
  });
  assert.ok(b2 && (b2.inicio >= b!.fin || b2.fin <= b!.inicio));
});
prueba('Cansado: si el día siguiente ya está en su tope, busca el otro', () => {
  const dias = huecosLibres(en(21, '00:00'), en(22, '23:59'), [], ZONA, en(21, '00:00'));
  const b = ubicarBloque(dias, 60, 'profundo', {
    zona: ZONA, ahora: en(21, '00:00'), limite: en(23, '00:00'), topeDia: () => 240, usadoPorDia: new Map([['2026-11-21', 240]]),
  });
  assert.equal(dia(b!.inicio), '2026-11-22');
});
prueba('Cansado: sin hueco antes de la fecha → null (no se mueve)', () => {
  const dias = huecosLibres(en(21, '00:00'), en(21, '23:59'), [{ inicio: en(21, '06:00'), fin: en(21, '23:00'), titulo: 'Viaje' }], ZONA, en(21, '00:00'));
  assert.equal(ubicarBloque(dias, 60, 'profundo', {
    zona: ZONA, ahora: en(21, '00:00'), limite: en(22, '00:00'), topeDia: () => 240, usadoPorDia: new Map(),
  }), null);
});
prueba('Los lunes con poca energía: 3 veces en 8 semanas → sugerencia', () => {
  const lunes = [16, 9, 2].map((d) => ({ fecha: en(d, '10:00'), estado: 'cansado' })); // 16, 9 y 2 de noviembre: lunes
  const s = patronCansancio(lunes, ZONA, en(20, '12:00'));
  assert.equal(s?.diaSemana, 1);
  assert.match(s?.texto ?? '', /^Los lunes sueles tener poca energía/);
  assert.equal(patronCansancio(lunes.slice(0, 2), ZONA, en(20, '12:00')), null);
  assert.equal(patronCansancio(lunes, ZONA, en(20, '12:00'), [1]), null); // ya tiene menos estudio los lunes
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
