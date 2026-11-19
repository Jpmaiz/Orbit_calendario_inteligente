/**
 * Pruebas del perfil (sin base de datos ni IA): "Mi ritmo", "Cuéntale a Orbit tu semana",
 * "Lo que Orbit sabe de ti" y "Tu semestre a la vista".
 *
 * Uso: npx tsx scripts/probar-ritmo.ts
 */
import assert from 'node:assert/strict';
import { leerRitmo, normalizarRitmo, RITMO_POR_DEFECTO } from '@/lib/usuarios/ritmo';
import { interpretarRespuesta, resumirRitmo } from '@/lib/usuarios/ritmoTexto';
import { describirAprendizaje } from '@/lib/aprendizaje/describir';
import { resumirSemestre } from '@/lib/agenda/semestre';
import { huecosLibres, CONFIG_HUECOS } from '@/lib/plan/huecos';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';

let fallas = 0, total = 0;
function prueba(nombre: string, fn: () => void) {
  total++;
  try { fn(); console.log(`✓ ${nombre}`); } catch (e) { fallas++; console.log(`✗ ${nombre}: ${(e as Error).message}`); }
}
const ZONA = 'America/La_Paz';

// ── Mi ritmo ──
prueba('Sin nada guardado: los valores de siempre', () => {
  assert.deepEqual(leerRitmo(null), RITMO_POR_DEFECTO);
  assert.deepEqual(leerRitmo({ desde: 'malo' }), RITMO_POR_DEFECTO);
});
prueba('Cambio parcial: conserva lo demás y redondea a media hora', () => {
  const r = normalizarRitmo({ hasta: '21:00', maxHorasDia: 3.2 }, RITMO_POR_DEFECTO);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.ritmo, { ...RITMO_POR_DEFECTO, hasta: '21:00', maxHorasDia: 3 });
});
prueba('Rechaza lo que no tiene sentido', () => {
  assert.equal(normalizarRitmo({ desde: '20:00', hasta: '21:00' }, RITMO_POR_DEFECTO).ok, false); // menos de 2 h
  assert.equal(normalizarRitmo({ maxHorasDia: 12 }, RITMO_POR_DEFECTO).ok, false);
  assert.equal(normalizarRitmo({ diasLibres: [1, 2, 3, 4, 5, 6, 7] }, RITMO_POR_DEFECTO).ok, false);
  assert.equal(normalizarRitmo({ franja: 'madrugada' }, RITMO_POR_DEFECTO).ok, false);
});
prueba('El horario del ritmo recorta los huecos (08:00–21:00)', () => {
  const dia = { y: 2026, m: 11, d: 20 };
  const desde = instanteEnZona(dia, '00:00', ZONA), hasta = instanteEnZona(dia, '23:59', ZONA);
  const [d] = huecosLibres(desde, hasta, [], ZONA, desde, { ...CONFIG_HUECOS, franjaInicio: '08:00', franjaFin: '21:00' });
  assert.equal(d.libresMin, 13 * 60);
});

// ── Cuéntale a Orbit tu semana ──
const respuestaIA = {
  ritmo: { desde: '08:00', hasta: '25:00', maxHorasDia: 3, diasLibres: [7], franja: 'noche' },
  compromisos: [
    { titulo: 'trabajo', diasSemana: [2, 4], hora: '18:00', horaFin: '21:00' },
    { titulo: 'Gimnasio', diasSemana: [9], hora: '07:00', horaFin: '08:00' }, // día inválido → fuera
    { titulo: 'Fútbol', diasSemana: [6], hora: '10:00', horaFin: '09:00' },   // fin antes → fuera
  ],
};
const leido = interpretarRespuesta(respuestaIA, RITMO_POR_DEFECTO);
prueba('Aplica los campos válidos y descarta el inválido sin perder los demás', () => {
  assert.equal(leido.ritmo.desde, '08:00');
  assert.equal(leido.ritmo.hasta, '22:30'); // "25:00" no es una hora: queda la anterior
  assert.equal(leido.ritmo.maxHorasDia, 3);
  assert.deepEqual(leido.ritmo.diasLibres, [7]);
  assert.equal(leido.ritmo.franja, 'noche');
  assert.deepEqual(leido.cambios, ['desde', 'maxHorasDia', 'diasLibres', 'franja']);
});
prueba('Compromisos: solo los válidos, con mayúscula inicial', () => {
  assert.deepEqual(leido.compromisos, [{ titulo: 'Trabajo', diasSemana: [2, 4], hora: '18:00', horaFin: '21:00' }]);
});
prueba('Resumen para confirmar', () => {
  assert.deepEqual(resumirRitmo(leido.ritmo, leido.cambios, leido.compromisos), [
    'Estudias de 08:00 a 22:30', 'Máximo 3 h de estudio por día', 'Sin estudio: domingo',
    'Rindes mejor en la noche', 'Trabajo: mar y jue, 18:00–21:00',
  ]);
});
prueba('Si la IA no devuelve nada útil: sin cambios', () => {
  const r = interpretarRespuesta({ ritmo: {}, compromisos: [] }, RITMO_POR_DEFECTO);
  assert.equal(r.cambios.length + r.compromisos.length, 0);
});

// ── Lo que Orbit sabe de ti ──
const ahora = new Date('2026-11-18T16:00:00Z');
const s = (tipo: string, razon: number) => ({ razon, peso: 1, materiaId: null, tipoTarea: tipo, creadoEn: new Date('2026-11-10T12:00:00Z') });
prueba('Sin datos: "todavía te está conociendo"', () => {
  const d = describirAprendizaje({ horas: [], franjas: [] }, ahora);
  assert.equal(d.conociendo, true);
  assert.match(d.frases[0], /te está conociendo/);
});
prueba('Exámenes que toman más: en palabras, sin números', () => {
  const d = describirAprendizaje({ horas: [s('examen', 1.6), s('examen', 1.5), s('examen', 1.4)], franjas: [] }, ahora);
  assert.equal(d.conociendo, false);
  assert.match(d.frases[0], /exámenes te suelen tomar más/);
  assert.ok(d.frases.every((f) => !/\d/.test(f)));
});
prueba('Franja aprendida', () => {
  const v = (voto: number) => ({ franja: 'noche' as const, voto, peso: 0.5, creadoEn: new Date('2026-11-15T12:00:00Z') });
  const d = describirAprendizaje({ horas: [], franjas: [v(1), v(1), v(1)] }, ahora);
  assert.match(d.frases.join(' '), /estudiar en la noche/);
});

// ── Tu semestre a la vista ──
const t = (id: string, tipo: string, fecha: string, horas: number, materia: string | null, planMin = 0) => ({
  id, titulo: id, tipo, estado: 'pendiente', fechaLimite: fecha, estimado: { horas }, plan: planMin ? { minutos: planMin } : null,
  materia: materia ? { nombre: materia, color: '#000' } : null,
});
const semestre = resumirSemestre([
  t('Examen Redes', 'examen', '2026-11-27T13:00:00Z', 8, 'Redes', 120),
  t('Proyecto', 'proyecto', '2026-11-28T03:59:00Z', 12, 'Taller'),
  t('Tarea', 'tarea', '2026-11-20T03:59:00Z', 2, 'Redes'),
  { ...t('Vieja', 'tarea', '2026-11-10T03:59:00Z', 5, 'Redes'), estado: 'completada' },
], ahora, ZONA);
prueba('Semana más pesada con mensaje para anticiparse', () => {
  assert.equal(semestre.semanaPesada?.desde, '2026-11-23');
  assert.equal(semestre.semanaPesada?.horas, 20);
  assert.match(semestre.semanaPesada?.mensaje ?? '', /23 al 29 nov.*~20 h.*empezar antes/);
});
prueba('Materia con más carga, horas por planificar y próximo examen', () => {
  assert.equal(semestre.materiaMasPesada?.nombre, 'Taller');
  assert.equal(semestre.porPlanificarHoras, 20); // 8 − 2 + 12 + 2
  assert.equal(semestre.proximoExamen?.titulo, 'Examen Redes');
});

console.log(fallas ? `\n${fallas} de ${total} prueba(s) fallaron` : `\nTodas las pruebas pasaron (${total})`);
process.exit(fallas ? 1 : 0);
