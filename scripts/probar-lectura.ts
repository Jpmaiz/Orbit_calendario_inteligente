/**
 * Pruebas de lectura SIN IA: lo que hace el código con lo que copió la IA.
 * Casos reales detectados el 7/11/2026 con un horario SIAAN de Medicina (UCB) y mensajes de docentes.
 *
 * Uso: npx tsx scripts/probar-lectura.ts
 */
import assert from 'node:assert/strict';
import { leerCasilla, grillaACeldas, type GrillaLeida } from '@/lib/horario/grilla';
import { agruparClases, type MateriaLeida } from '@/lib/horario/celdas';
import { quitarDatosPersonales } from '@/lib/privacidad';
import { prepararItems } from '@/lib/borrador/prepararItems';
import { CAMPOS_VACIOS, type ItemExtraido } from '@/lib/ia/extraccion';

let fallas = 0;
function prueba(nombre: string, f: () => void) {
  try {
    f();
    console.log(`✓ ${nombre}`);
  } catch (e) {
    fallas++;
    console.log(`✗ ${nombre}: ${(e as Error).message}`);
  }
}

// ───────── 1. Casillas ─────────
prueba('Paralelo con guion "[4-B]"', () => {
  const c = leerCasilla('CIR-243 [4-B] Aula: T2-GCI1-C/PB-4');
  assert.deepEqual(c, { codigo: 'CIR-243', materia: null, aula: 'T2-GCI1-C/PB-4', paralelo: '4-B', horario: null });
});
prueba('Horario escrito en la casilla "(14:15-16:30)"', () => {
  const c = leerCasilla('SEM-223 [4-B] Aula: T2-GSE1-C/PB-2 (14:15-16:30)');
  assert.equal(c?.aula, 'T2-GSE1-C/PB-2');
  assert.deepEqual(c?.horario, { inicio: '14:15', fin: '16:30' });
});
prueba('Casilla clásica sigue igual', () => {
  assert.deepEqual(leerCasilla('SIS-233 [1] Aula: LRED/A1-3'),
    { codigo: 'SIS-233', materia: null, aula: 'LRED/A1-3', paralelo: '1', horario: null });
});

// ───────── 2. Horario de Medicina completo (dos páginas, la 2.ª sin fila de días) ─────────
const D = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const v = (...celdas: string[]) => [...celdas, ...Array(6 - celdas.length).fill('')];
const grilla: GrillaLeida = {
  dias: D,
  filas: [
    { horario: '07:15 - 08:00', celdas: v('SME-223 [4] Aula: A2-1', 'CIR-243 [4] Aula: A4-4') },
    { horario: '08:00 - 08:45', celdas: v('SME-223 [4] Aula: A2-1', 'CIR-243 [4] Aula: A4-4') },
    { horario: '09:00 - 09:45', celdas: v('CIR-243 [4-B] Aula: T2-GCI1-C/PB-4', '', '', '', '', 'FAR-223 [4-B] Aula: T2/A1-2') },
    { horario: '09:45 - 10:30', celdas: v('CIR-243 [4-B] Aula: T2-GCI1-C/PB-4', '', '', '', '', 'FAR-223 [4-B] Aula: T2/A1-2') },
    { horario: '10:45 - 11:30', celdas: v() },
    { horario: '14:15 - 15:00', celdas: v('', 'SEM-223 [4-B] Aula: T2-GSE1-C/PB-2', 'ANP-223 [4-B] Aula: T2-LAP2/C1-3') },
    { horario: '15:00 - 15:45', celdas: v('', 'SEM-223 [4-B] Aula: T2-GSE1-C/PB-2 (14:15-16:30)', 'ANP-223 [4-B] Aula: T2-LAP2/C1-3') },
    { horario: '16:00 - 16:45', celdas: v('', 'SEM-223 [4-B] Aula: T2-GSE1-C/PB-2 (14:15-16:30)') },
    { horario: '17:45 - 18:30', celdas: v('SEM-223 [4] Aula: A4-4', 'EPI-253 [4] Aula: A4-4', 'EPI-253 [4-B] Aula: A3-5', 'FAR-223 [4] Aula: A4-4', 'SEM-223 [4] Aula: A4-4') },
    { horario: '18:30 - 19:15', celdas: v('SEM-223 [4] Aula: A4-4', 'EPI-253 [4] Aula: A4-4', 'EPI-253 [4-B] Aula: A3-5', 'FAR-223 [4] Aula: A4-4', 'SEM-223 [4] Aula: A4-4') },
    { horario: '19:30 - 20:15', celdas: v('FAR-223 [4] Aula: A4-4', 'ANP-223 [4] Aula: A3-8', 'FSP-223 [4] Aula: A4-4', '', 'FSP-223 [4] Aula: A4-4') },
    { horario: '20:15 - 21:00', celdas: v('FAR-223 [4] Aula: A4-4', 'ANP-223 [4] Aula: A3-8', 'FSP-223 [4] Aula: A4-4', '', 'FSP-223 [4] Aula: A4-4') },
  ],
};
const materias: MateriaLeida[] = [
  { codigo: 'ANP-223', nombre: 'Anatomía Patológica', paralelo: '4', docente: 'Docente A' },
  { codigo: 'CIR-243', nombre: 'Cirugía I', paralelo: '4', docente: 'Docente B' },
  { codigo: 'FAR-223', nombre: 'Farmacología', paralelo: '4', docente: 'Docente C' },
  { codigo: 'FSP-223', nombre: 'Fisiopatología', paralelo: '4', docente: 'Docente D' },
  { codigo: 'SEM-223', nombre: 'Semiología', paralelo: '4', docente: 'Docente E' },
  { codigo: 'EPI-253', nombre: 'Epidemiología', paralelo: '4', docente: 'Docente F' },
  { codigo: 'SME-223', nombre: 'Salud Mental I', paralelo: '4', docente: 'Docente G' },
  { codigo: 'ANP-223', nombre: 'Anatomía Patológica', paralelo: '4-B', docente: 'Docente A' },
  { codigo: 'CIR-243', nombre: 'Cirugía I', paralelo: '4-B', docente: null },
  { codigo: 'FAR-223', nombre: 'Farmacología', paralelo: '4-B', docente: 'Docente H' },
  { codigo: 'SEM-223', nombre: 'Semiología', paralelo: '4-B', docente: 'Docente I' },
  { codigo: 'EPI-253', nombre: 'Epidemiología', paralelo: '4-B', docente: 'Docente J' },
];
const clases = agruparClases(grillaACeldas(grilla).celdas, materias);
const DIA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const describir = (c: (typeof clases)[number]) =>
  `${c.codigo}${c.practica ? ' práctica' : ''} ${c.diasSemana.map((d) => DIA[d]).join('+')} ${c.hora}–${c.horaFin}`;

prueba('Medicina: 13 clases (7 materias, 15 bloques)', () => {
  assert.equal(clases.length, 13, clases.map(describir).join(' | '));
  assert.equal(clases.reduce((s, c) => s + c.diasSemana.length, 0), 15);
});
prueba('Semiología práctica termina 16:30 (hora escrita en la casilla)', () => {
  const sem = clases.find((c) => c.codigo === 'SEM-223' && c.practica);
  assert.equal(`${sem?.hora}–${sem?.horaFin}`, '14:15–16:30');
});
prueba('Prácticas: CIR, SEM, FAR, EPI, ANP (no Salud Mental ni Fisiopatología)', () => {
  assert.deepEqual(clases.filter((c) => c.practica).map((c) => c.codigo).sort(), ['ANP-223', 'CIR-243', 'EPI-253', 'FAR-223', 'SEM-223']);
});
prueba('Docente de la práctica, no el de la teoría', () => {
  assert.equal(clases.find((c) => c.codigo === 'FAR-223' && c.practica)?.docente, 'Docente H');
  assert.equal(clases.find((c) => c.codigo === 'FAR-223' && !c.practica)?.docente, 'Docente C');
});
prueba('Semiología teoría: Lun y Vie 17:45–19:15 en una sola clase', () => {
  const t = clases.find((c) => c.codigo === 'SEM-223' && !c.practica);
  assert.deepEqual(t?.diasSemana, [1, 5]);
});

// ───────── 3. Datos personales del texto del PDF ─────────
prueba('Se quitan carnet, registro y nombre; quedan siglas, horas y docentes', () => {
  const pdf = `Número de Registro: 202260001897 Carrera: MEDICINA
Primer Apellido: PEREZ Doc. de Identidad: 1234567 COCHABAMBA
Segundo Apellido: QUISPE Nacionalidad: BOLIVIANA
Nombre: ANA MARIA
A-2026 CIR-243 CIRUGÍA I 4 4 REYNOLDS VILLARROEL KARINA
07:15 - 08:00 SME-223 [4] Aula: A2-1
UCB SEDE COCHABAMBA Usuario: PEREZ QUISPE ANA MARIA Página 1 de 2`;
  const limpio = quitarDatosPersonales(pdf);
  for (const dato of ['202260001897', '1234567', 'PEREZ', 'QUISPE', 'ANA MARIA']) assert.ok(!limpio.includes(dato), `quedó "${dato}"`);
  for (const dato of ['CIR-243', '07:15 - 08:00', 'SME-223 [4]', 'REYNOLDS VILLARROEL KARINA', 'MEDICINA', 'Página 1 de 2']) {
    assert.ok(limpio.includes(dato), `se perdió "${dato}"`);
  }
});

// ───────── 4. Ítems de mensajes ─────────
const item = (x: Partial<ItemExtraido>): ItemExtraido => ({
  ...CAMPOS_VACIOS, clase: 'tarea', titulo: 'X', tipo: 'tarea', fechaDicha: null, fechaFinDicha: null, hora: null, horaFin: null,
  diasSemana: [], materia: null, codigoMateria: null, descripcion: null, ubicacion: null, confianza: 0.9, evidencia: '',
  fechaReferencia: null, ...x,
});
prueba('Evento con preparación → tarea "Preparación" que vence al empezar el evento', () => {
  const lista = prepararItems([
    item({ clase: 'evento', tipo: null, titulo: 'Cirugía de Apéndice', fechaDicha: { tipo: 'diaSemana', dia: 3, semana: 'sin_especificar' }, hora: '09:00', horaFin: '13:00',
      preparacion: { titulo: null, estimacion: { escala: null, temas: [{ nombre: 'Semiología de apéndice', amplitud: 'normal' }, { nombre: 'Nudos', amplitud: 'normal' }],
        cantidades: { paginasLeer: null, paginasEscribir: null, ejercicios: null, diapositivas: null, minutosExposicion: null },
        volumen: null, nivelCognitivo: 2, partes: false, grupal: false, formato: 'practico', claridad: 'alta', impostergable: false } } }),
    item({ titulo: 'Preguntas de Fisiopatología' }),
  ]);
  assert.equal(lista.length, 3);
  assert.equal(lista[1].titulo, 'Preparación: Cirugía de Apéndice');
  assert.equal(lista[1].venceCon, 0);
  assert.equal(lista[1].hora, '09:00');
  assert.equal(lista[1].descripcion, 'Temas: Semiología de apéndice, Nudos');
});
prueba('"Entregar al ingresar al examen": toma la fecha y hora del examen; índices se reacomodan', () => {
  const lista = prepararItems([
    item({ titulo: 'Cuadro comparativo', tipo: 'entrega', venceCon: 1, preparativos: ['Llevar el cuadro en físico'] }),
    item({ titulo: 'Examen de la 4.ª Unidad', tipo: 'examen', fechaDicha: { tipo: 'exacta', fecha: '2026-11-10' }, hora: null }),
  ]);
  assert.deepEqual(lista[0].fechaDicha, { tipo: 'exacta', fecha: '2026-11-10' });
  assert.equal(lista[0].venceCon, 1);
  assert.equal(lista[0].hora, null);
  assert.equal(lista[0].descripcion, 'Llevar: Llevar el cuadro en físico');
});

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallas ? 1 : 0);
