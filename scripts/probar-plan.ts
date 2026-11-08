/**
 * Pruebas del planificador (Fase 2), sin base de datos ni IA.
 * Simulacro: hoy es sábado 7 de noviembre de 2026, 20:11, con el horario de Medicina de prueba.
 *
 * Uso: npx tsx scripts/probar-plan.ts
 */
import assert from 'node:assert/strict';
import { huecosLibres, ocupacionesDeClases, horasLibresPorDia, type ClaseSemanal } from '@/lib/plan/huecos';
import { planificar, limiteDePlan, inicioDePlan, type TareaAPlanificar, type Plan } from '@/lib/plan/planificador';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

const ZONA = 'America/La_Paz';
const ahora = instanteEnZona({ y: 2026, m: 11, d: 7 }, '20:11', ZONA);
const en = (d: number, h: string) => instanteEnZona({ y: 2026, m: 11, d }, h, ZONA);
const hora = (f: Date) => new Intl.DateTimeFormat('es-BO', { timeZone: ZONA, weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
const dia = (f: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(f);

// Horario de Medicina (13 clases), vigente todo el semestre
const c = (titulo: string, diaSemana: number, horaInicio: string, horaFin: string): ClaseSemanal =>
  ({ titulo, diaSemana, horaInicio, horaFin, vigenteDesde: null, vigenteHasta: null });
const clases = [
  c('Salud Mental I', 1, '07:15', '08:45'), c('Cirugía I · Práctica', 1, '09:00', '10:30'), c('Semiología', 1, '17:45', '19:15'),
  c('Farmacología', 1, '19:30', '21:00'), c('Cirugía I', 2, '07:15', '08:45'), c('Semiología · Práctica', 2, '14:15', '16:30'),
  c('Epidemiología', 2, '17:45', '19:15'), c('Anatomía Patológica', 2, '19:30', '21:00'), c('Anatomía Patológica · Práctica', 3, '14:15', '15:45'),
  c('Epidemiología · Práctica', 3, '17:45', '19:15'), c('Fisiopatología', 3, '19:30', '21:00'), c('Farmacología', 4, '17:45', '19:15'),
  c('Semiología', 5, '17:45', '19:15'), c('Fisiopatología', 5, '19:30', '21:00'), c('Farmacología · Práctica', 6, '09:00', '10:30'),
];

function plan(t: TareaAPlanificar, extra?: { materia?: Map<string, number> }): Plan {
  const limite = limiteDePlan(t, ZONA);
  const desde = inicioDePlan(limite, ahora);
  const ocup = ocupacionesDeClases(clases, desde, limite, ZONA);
  const dias = huecosLibres(desde, limite, ocup, ZONA, ahora);
  return planificar(t, { dias, zona: ZONA, minutosMateriaPorDia: extra?.materia }, ahora);
}
const ver = (p: Plan) => p.bloques.map((b) => `${hora(b.inicio)}–${hora(b.fin).slice(-5)}${b.tipo === 'repaso' ? ' (repaso)' : ''}`).join(' | ');

let fallas = 0;
function prueba(nombre: string, f: () => void) {
  try { f(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}

prueba('Huecos del lunes: 10:45–17:30 y 21:15–22:30 (clases con 15 min de margen)', () => {
  const dias = huecosLibres(en(9, '00:00'), en(9, '23:59'), ocupacionesDeClases(clases, en(9, '00:00'), en(9, '23:59'), ZONA), ZONA, ahora);
  const h = dias[0].huecos.map((x) => `${hora(x.inicio).slice(-5)}–${hora(x.fin).slice(-5)}`);
  assert.deepEqual(h, ['10:45–17:30', '21:15–22:30']);
});

const examen: TareaAPlanificar = { titulo: 'Examen de Redes', tipo: 'examen', fechaLimite: en(11, '08:00'), horaDefinida: false, horas: 6 };
const p1 = plan(examen);
console.log(`  Examen del miércoles, 6 h: ${ver(p1)}`);
prueba('Examen: las 6 h caben', () => assert.equal(p1.minutosPlanificados, 360));
prueba('Examen: al menos 3 días distintos', () => assert.ok(p1.diasUsados >= 3, `${p1.diasUsados} días`));
prueba('Examen: nada el mismo día del examen', () => assert.ok(p1.bloques.every((b) => dia(b.fin) < '2026-11-11')));
prueba('Examen: el último bloque es el repaso, el martes', () => {
  const u = p1.bloques[p1.bloques.length - 1];
  assert.equal(u.tipo, 'repaso');
  assert.equal(dia(u.inicio), '2026-11-10');
});
prueba('Máximo 2 h de la materia por día', () => {
  const porDia = new Map<string, number>();
  for (const b of p1.bloques) porDia.set(dia(b.inicio), (porDia.get(dia(b.inicio)) ?? 0) + b.minutos);
  assert.ok([...porDia.values()].every((m) => m <= 120), JSON.stringify([...porDia]));
});
prueba('Ningún bloque pisa una clase (con su margen)', () => {
  const ocup = ocupacionesDeClases(clases, ahora, en(11, '00:00'), ZONA);
  for (const b of p1.bloques) for (const o of ocup) {
    assert.ok(!(b.inicio.getTime() < o.fin.getTime() + 15 * 60000 && o.inicio.getTime() - 15 * 60000 < b.fin.getTime()), `${hora(b.inicio)} pisa ${o.titulo}`);
  }
});
prueba('Nada antes de ahora (sábado 20:11)', () => assert.ok(p1.bloques.every((b) => b.inicio >= ahora)));

const p2 = plan({ ...examen, fechaLimite: en(8, '08:00') });
console.log(`  Examen el domingo, 6 h: ${ver(p2)} · ${p2.aviso}`);
prueba('Si no alcanza: arma lo que cabe y avisa', () => {
  assert.ok(p2.faltanMin > 0 && p2.minutosPlanificados > 0);
  assert.match(p2.aviso ?? '', /Solo caben/);
});

const entrega: TareaAPlanificar = { titulo: 'Cuadro comparativo', tipo: 'entrega', fechaLimite: en(10, '23:59'), horaDefinida: true, horas: 3.5 };
const p3 = plan(entrega);
console.log(`  Entrega del martes 23:59, 3 h 30: ${ver(p3)}`);
prueba('Entrega: 3 h 30 planificadas y terminan 1 h antes de la entrega', () => {
  assert.equal(p3.minutosPlanificados, 210);
  assert.ok(p3.bloques.every((b) => b.fin.getTime() <= en(10, '22:59').getTime()));
});

const p4 = plan(examen, { materia: new Map([['2026-11-08', 120]]) });
console.log(`  Con 2 h de la materia ya planificadas el domingo: ${ver(p4)}`);
prueba('Respeta lo ya planificado de la misma materia', () => assert.ok(p4.bloques.every((b) => dia(b.inicio) !== '2026-11-08')));
prueba('Y aun así acomoda las 6 h en los otros días', () => assert.equal(p4.minutosPlanificados, 360));

prueba('Capacidad para el motor de prioridad (promedio con tope de 4 h)', () => {
  const dias = huecosLibres(ahora, en(21, '23:59'), ocupacionesDeClases(clases, ahora, en(21, '23:59'), ZONA), ZONA, ahora);
  const h = horasLibresPorDia(dias, 4);
  assert.ok(h > 2 && h <= 4, `${h}`);
});

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
