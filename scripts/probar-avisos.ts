/**
 * Pruebas de los avisos (D25), sin base de datos ni envío real: qué dice cada aviso y cuándo toca.
 * Uso: npx tsx scripts/probar-avisos.ts
 */
import assert from 'node:assert/strict';
import { avisoBloque, avisoManana, claveManana, esHoraDelResumen, ventanaBloques } from '@/lib/avisos/mensajes';
import { leerPreferencias, normalizarPreferencias, AVISOS_POR_DEFECTO } from '@/lib/avisos/preferencias';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

const ZONA = 'America/La_Paz';
const en = (d: number, h: string) => instanteEnZona({ y: 2026, m: 11, d }, h, ZONA);

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try { fn(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}

prueba('Bloque: "En 15 min: …" con su horario', () => {
  const a = avisoBloque({ id: 'b1', titulo: 'Examen de Redes', tipo: 'estudio', inicio: en(24, '20:00'), fin: en(24, '21:00') }, en(24, '19:45'), ZONA);
  assert.equal(a.titulo, 'En 15 min: Examen de Redes');
  assert.equal(a.cuerpo, 'Estudio de 20:00 a 21:00');
  assert.equal(a.tag, 'bloque-b1');
});
prueba('Bloque de repaso', () => {
  const a = avisoBloque({ id: 'b2', titulo: 'Parcial', tipo: 'repaso', inicio: en(24, '21:30'), fin: en(24, '22:30') }, en(24, '21:12'), ZONA);
  assert.equal(a.titulo, 'En 18 min: Parcial');
  assert.match(a.cuerpo, /^Repaso de 21:30 a 22:30$/);
});
prueba('Ventana de bloques: de 2 a 20 min desde ahora', () => {
  const { desde, hasta } = ventanaBloques(en(24, '19:45'));
  assert.equal(+desde, +en(24, '19:47'));
  assert.equal(+hasta, +en(24, '20:05'));
});
prueba('Mañana: nada que vence → no se manda nada', () => assert.equal(avisoManana([], ZONA), null));
prueba('Mañana: una sola cosa, con su hora', () => {
  const a = avisoManana([{ titulo: 'Examen de Redes', fechaLimite: en(25, '09:00'), horaDefinida: true }], ZONA)!;
  assert.equal(a.titulo, 'Mañana: Examen de Redes');
  assert.equal(a.cuerpo, 'Examen de Redes (09:00)');
});
prueba('Mañana: varias, ordenadas y como máximo 3 nombres', () => {
  const a = avisoManana([
    { titulo: 'Informe', fechaLimite: en(25, '23:59'), horaDefinida: false },
    { titulo: 'Examen', fechaLimite: en(25, '08:00'), horaDefinida: true },
    { titulo: 'Quiz', fechaLimite: en(25, '10:00'), horaDefinida: true },
    { titulo: 'Lectura', fechaLimite: en(25, '23:59'), horaDefinida: false },
  ], ZONA)!;
  assert.equal(a.titulo, 'Mañana tienes 4 cosas');
  assert.equal(a.cuerpo, 'Examen (08:00) · Quiz (10:00) · Informe y 1 más');
});
prueba('Resumen: solo de 20:00 a 20:59 en la hora del usuario', () => {
  assert.equal(esHoraDelResumen(en(24, '19:59'), ZONA), false);
  assert.equal(esHoraDelResumen(en(24, '20:00'), ZONA), true);
  assert.equal(esHoraDelResumen(en(24, '20:55'), ZONA), true);
  assert.equal(esHoraDelResumen(en(24, '21:00'), ZONA), false);
  assert.equal(claveManana(en(24, '20:10'), ZONA), 'manana:2026-11-24');
});
prueba('Preferencias: todo activado por defecto; cambio parcial; rechaza texto', () => {
  assert.deepEqual(leerPreferencias(null), AVISOS_POR_DEFECTO);
  const r = normalizarPreferencias({ manana: false }, AVISOS_POR_DEFECTO);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.avisos, { bloques: true, manana: false });
  assert.equal(normalizarPreferencias({ bloques: 'si' }, AVISOS_POR_DEFECTO).ok, false);
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
