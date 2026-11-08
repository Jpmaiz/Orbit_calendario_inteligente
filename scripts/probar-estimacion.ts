/**
 * Prueba la Fase 1 con la IA real, SIN servidor ni base de datos:
 * texto → la IA lee y califica (rúbrica) → el sistema arma fechas y calcula horas, dificultad e importancia.
 *
 * Uso (desde la raíz del proyecto):
 *   npx tsx --env-file=.env scripts/probar-estimacion.ts                  ← corre los textos de ejemplo
 *   npx tsx --env-file=.env scripts/probar-estimacion.ts "examen de redes el miércoles"
 *   npx tsx --env-file=.env scripts/probar-estimacion.ts --consistencia   ← mismo texto 5 veces: ¿califica igual?
 */
import { ia, modeloIA } from '@/lib/ia';
import { prepararItems } from '@/lib/borrador/prepararItems';
import { armarFechas } from '@/lib/borrador/construirBorrador';
import { estimar } from '@/lib/estimacion/rubrica';

const ZONA = 'America/La_Paz';
const MATERIAS = [
  'Redes de Computadoras II', 'Algoritmos', 'Ingeniería de Software',
  'Salud Mental I', 'Semiología', 'Anatomía Patológica', 'Cirugía I', 'Fisiopatología', 'Farmacología', 'Epidemiología',
];

const EJEMPLOS = [
  'tengo examen de redes el miercoles que viene',
  'final de redes 2 el 2 de diciembre: OSPF, EIGRP, NAT, VLANs y ACL, con subnetting',
  'defensa del sprint 3 de inge de software el viernes, grupal, 15 min, 10 diapositivas y demo',
  'tengo examen de salud mental el dia martes de atención primaria en la salud mental esta dividida en primaria secundaria y terciaria, ademas tengo que realizar una tarea para el hospital de igual manera para el martes es hacer una historia clinica de litiasis renal, ademas la doctora pidio estudiar todo examen físico de abdomen osea sera oral y nos dira inspección auscultacion percusion y palpacion, ademas de preguntarnos teoria de semiología de abdomen despues tengo que realizar otra tarea de anatomia patologica para el martes igual es una tabla comparativa de sindromes nefriticos vs sindromes nefroticos, ahora para el dia miercoles tengo programada una cirugia de 9 a 1pm en hospital viedma sera cirugia de apéndice nos encargo estudiar semiologia de apendice ademas de nudos para la cirugía, para el dia jueves simplemente tengo resolver unas preguntas para la materia de fisiopatología son 20pts de la 4ta competencia y para el viernes tengo examen de semiología teorica entra cardio y digestivo todo es de el libro de argente y Álvarez ultima edicion',
  'Buenos dias chicos la ultima actividad a entregar para el dia 10 de noviembre: es decir el dia del examen de la 4 unidad es: realizar un cuadro comparativo hecho a mano entre las siguientes patologias de ovario: Carcinoma seroso, Carcinoma mucinoso, Tumor de las celulas de la granulosa y Disgerminoma, en el cual ingresen las caracterisiticas prinicplaes diferenciales de cada uno, desde la etiologia hasta el diagnostico IMHQ., cualquier duda inbox , el trabajo debera ser entragado en fisico en dicha fecha al ingresar a rendir el examen NOTA sobre 20 puntos *entrega impostergable*',
];

const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-BO', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';

async function leer(texto: string) {
  const ahora = new Date();
  const leidos = (await ia.extraerItems(texto, { ahora, zonaHoraria: ZONA, materias: MATERIAS })).map((i) => ({ ...i, fechaReferencia: null }));
  return prepararItems(leidos);
}

async function mostrar(texto: string) {
  console.log(`\n» ${texto.length > 110 ? texto.slice(0, 110) + '…' : texto}`);
  const t0 = Date.now();
  const items = await leer(texto);
  console.log(`  ${items.length} ítem(s) · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  items.forEach((it, i) => {
    const base = armarFechas(it, new Date(), ZONA);
    const cuando = base.opcionesFecha?.length ? `${base.opcionesFecha[0].etiqueta}` : fecha(base.inicio);
    const materia = it.materia ?? (it.materiaSugerida ? `${it.materiaSugerida} (sugerida)` : '—');
    let linea = `  ${i}. [${it.clase}${it.tipo ? `/${it.tipo}` : ''}] ${it.titulo} · ${cuando} · ${materia}`;
    if (it.clase === 'tarea') {
      const e = estimar(it.tipo ?? 'tarea', it.estimacion);
      linea += `\n     → ${e.horas} h · dificultad ${e.dificultad ?? '—'} · importancia ${e.importancia} · ${e.origen}`;
      linea += `\n       ${e.razones.join(' · ')}`;
      const l = it.estimacion;
      if (l) {
        linea += `\n       factores: escala ${l.escala ?? '—'} · nivel ${l.nivelCognitivo} · temas ${l.temas.length}` +
          ` · volumen ${l.volumen ?? '—'} · partes ${l.partes} · grupal ${l.grupal} · formato ${l.formato ?? '—'} · claridad ${l.claridad}`;
      }
      if (e.supuestos.length) linea += `\n       supuestos: ${e.supuestos.join(' · ')}`;
    }
    if (it.venceCon !== null) linea += `\n     vence al empezar el ítem ${it.venceCon}`;
    if (base.supuestos.length) linea += `\n     fechas: ${base.supuestos.join(' · ')}`;
    if (it.descripcion) linea += `\n     ${it.descripcion.replace(/\n/g, ' | ')}`;
    console.log(linea);
  });
}

async function consistencia(texto: string, veces = 5) {
  console.log(`\nConsistencia (${veces} veces): ${texto}`);
  const firmas: string[] = [];
  for (let i = 0; i < veces; i++) {
    const items = await leer(texto);
    firmas.push(items.filter((x) => x.clase === 'tarea').map((x) => {
      const e = estimar(x.tipo ?? 'tarea', x.estimacion);
      return `${x.titulo}: ${e.horas} h, D${e.dificultad}`;
    }).join(' | '));
    console.log(`  ${i + 1}. ${firmas[i]}`);
  }
  const iguales = firmas.filter((f) => f === firmas[0]).length;
  console.log(`  → ${iguales} de ${veces} iguales a la primera`);
}

async function main() {
  console.log(`Modelo: ${modeloIA} · Hoy: ${fecha(new Date().toISOString())}`);
  const args = process.argv.slice(2);
  if (args[0] === '--consistencia') {
    await consistencia(args[1] ?? EJEMPLOS[4]);
    return;
  }
  for (const t of args.length ? [args.join(' ')] : EJEMPLOS) await mostrar(t);
}

main().catch((e) => {
  console.error('Error:', e?.message ?? e);
  process.exit(1);
});
