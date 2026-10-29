/**
 * Prueba la lectura de imágenes con la IA real, SIN servidor ni base de datos.
 * Muestra qué leyó la IA, la segunda revisión (horarios) y las fechas que calcula el sistema.
 *
 * Uso (desde la raíz del proyecto):
 *   npx tsx --env-file=.env scripts/probar-imagen.ts pruebas-ia/horario-foto.jpg
 *   npx tsx --env-file=.env scripts/probar-imagen.ts pruebas-ia/horario-pdf.png pruebas-ia/horario-pdf.txt
 *
 * El segundo archivo (opcional) es el texto extraído del PDF.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { ia, modeloIA } from '@/lib/ia';
import type { ImagenEntrada } from '@/lib/ia/adaptador';
import { leerImagenes } from '@/lib/ia/imagen';
import { armarFechas, referenciaDe } from '@/lib/borrador/construirBorrador';
import { diaEnZona } from '@/lib/periodos/periodos';

const ZONA = 'America/La_Paz';
const MIME: Record<string, ImagenEntrada['mime']> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const local = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-BO', {
        timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso))
    : '—';

async function main() {
  const [ruta, rutaTexto] = process.argv.slice(2);
  const mime = ruta ? MIME[extname(ruta).toLowerCase()] : undefined;
  if (!ruta || !mime) {
    console.log('Uso: npx tsx --env-file=.env scripts/probar-imagen.ts <imagen.jpg|png|webp> [texto.txt]');
    process.exit(1);
  }
  const imagen: ImagenEntrada = { mime, base64: readFileSync(ruta).toString('base64') };
  const textoAdjunto = rutaTexto ? readFileSync(rutaTexto, 'utf8') : null;
  const ahora = new Date();

  console.log(`\nModelo: ${modeloIA} · Imagen: ${ruta}${textoAdjunto ? ' + texto del PDF' : ''}\n`);
  const t0 = Date.now();
  const r = await leerImagenes(ia, [imagen], { ahora, zonaHoraria: ZONA, materias: [] }, textoAdjunto);
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);

  const { lectura } = r;
  console.log(`Tipo: ${lectura.tipoDocumento} · Fecha del documento: ${lectura.fechaDocumento ?? '—'} · ${segundos} s`);
  if (lectura.periodo) console.log(`Periodo: ${lectura.periodo.nombre ?? ''} ${lectura.periodo.inicio} → ${lectura.periodo.fin}`);
  if (lectura.tipoDocumento === 'horario') {
    console.log(`Celdas leídas: ${lectura.celdas.length} · Materias en tabla: ${lectura.materias.length}`);
    console.log(
      `Segunda lectura: ${r.revision.hecha ? `sí · coinciden ${r.revision.coinciden} casillas · conflictos ${r.revision.conflictos}` : 'no'}`,
    );
    for (const c of r.revision.correcciones) console.log(`  árbitro (lect. 1 / lect. 2 → final): ${c}`);
  }

  console.log('\nÍTEMS DEL BORRADOR');
  const referenciaDoc = lectura.fechaDocumento ? diaEnZona(lectura.fechaDocumento, '12:00', ZONA) ?? undefined : undefined;
  for (const [i, item] of r.items.entries()) {
    const base = armarFechas(item, referenciaDe(item, { ahora, referencia: referenciaDoc }, ZONA), ZONA);
    const cuando =
      item.clase === 'evento_fijo'
        ? `${item.diasSemana.map((d) => DIAS[d - 1]).join(', ')} ${item.hora}–${item.horaFin}`
        : `${local(base.inicio)}${base.fin ? ` → ${local(base.fin)}` : ''}`;
    console.log(
      `${String(i + 1).padStart(2)}. [${item.clase}${item.tipo ? `/${item.tipo}` : ''}] ${item.titulo}\n` +
        `    ${cuando}` +
        `${item.codigoMateria ? ` · ${item.codigoMateria}` : ''}${item.ubicacion ? ` · ${item.ubicacion}` : ''}` +
        ` · confianza ${item.confianza}` +
        `${item.fechaReferencia ? ` · dicho el ${item.fechaReferencia}` : ''}` +
        `${base.supuestos.length ? ` · supuestos: ${base.supuestos.join(', ')}` : ''}` +
        `${base.faltantes.length ? ` · FALTA: ${base.faltantes.join(', ')}` : ''}`,
    );
  }
  if (r.avisos.length) {
    console.log('\nAVISOS');
    for (const a of r.avisos) console.log(`  - ${a}`);
  }
}

main().catch((e) => {
  console.error('Error:', e?.message ?? e);
  process.exit(1);
});
