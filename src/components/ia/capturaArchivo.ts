/**
 * Prepara una foto, captura o PDF para /api/ia/extraer-imagen. Todo ocurre en el navegador:
 * - Imagen (JPEG, PNG, WebP; en iPhone la foto HEIC llega como JPEG): se achica a 2000 px y se pasa a JPEG.
 * - PDF: cada página (máx. 3) se dibuja con pdf.js y se pasa a JPEG; además se saca su texto (textoAdjunto),
 *   que la IA usa como respaldo para no equivocarse en siglas, aulas y fechas.
 * El archivo original nunca se sube al servidor.
 */

const LADO_MAX = 2000;      // px: suficiente para leer un horario; una foto de celular pesa 10 veces menos
const CALIDAD = 0.85;
const MAX_PAGINAS = 3;
const MAX_TEXTO = 15_000;

export type ArchivoPreparado = { imagenes: string[]; textoAdjunto: string | null; paginasOmitidas: number };

const esPdf = (a: File) => a.type === 'application/pdf' || /\.pdf$/i.test(a.name);

function lienzo(ancho: number, alto: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(ancho));
  c.height = Math.max(1, Math.round(alto));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite procesar imágenes.');
  ctx.fillStyle = '#ffffff'; // fondo blanco: un PDF o PNG transparente no queda negro en JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  return { c, ctx };
}

const aJpeg = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', CALIDAD);

async function prepararImagen(archivo: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' }); // respeta la rotación de la foto
  } catch {
    throw new Error('No se pudo abrir la imagen. Usa una foto JPEG o PNG, o el PDF.');
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const { c, ctx } = lienzo(bitmap.width * escala, bitmap.height * escala);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return aJpeg(c);
}

async function prepararPdf(archivo: File): Promise<ArchivoPreparado> {
  const pdfjs = await import('pdfjs-dist'); // se carga solo cuando alguien sube un PDF
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  const carga = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  const doc = await carga.promise;
  const total = doc.numPages;
  const paginas = Math.min(total, MAX_PAGINAS);
  const imagenes: string[] = [];
  const textos: string[] = [];

  for (let n = 1; n <= paginas; n++) {
    const pagina = await doc.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: Math.min(3, LADO_MAX / Math.max(base.width, base.height)) });
    const { c, ctx } = lienzo(viewport.width, viewport.height);
    await pagina.render({ canvasContext: ctx, canvas: c, viewport } as Parameters<typeof pagina.render>[0]).promise;
    imagenes.push(aJpeg(c));

    // Texto real del PDF (si es escaneado, viene vacío y solo va la imagen)
    const contenido = await pagina.getTextContent();
    textos.push(
      contenido.items
        .map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .trim(),
    );
  }
  await carga.destroy(); // libera la memoria del PDF

  const texto = textos.filter(Boolean).join('\n\n').slice(0, MAX_TEXTO);
  return { imagenes, textoAdjunto: texto || null, paginasOmitidas: total - paginas };
}

export async function prepararArchivo(archivo: File): Promise<ArchivoPreparado> {
  if (esPdf(archivo)) return prepararPdf(archivo);
  if (!archivo.type.startsWith('image/')) throw new Error('Sube una imagen (foto o captura) o un PDF.');
  return { imagenes: [await prepararImagen(archivo)], textoAdjunto: null, paginasOmitidas: 0 };
}

/** "Horario leído dos veces: 30 casillas coinciden." — para mostrar cómo se verificó la lectura. */
export function resumenDocumento(datos: unknown): string | null {
  const d = (datos as { documento?: Record<string, unknown> } | null)?.documento;
  if (!d) return null;
  const tipos: Record<string, string> = {
    horario: 'Horario', afiche: 'Afiche', captura_chat: 'Captura de chat', pizarra: 'Pizarra', otro: 'Imagen',
  };
  const tipo = tipos[String(d.tipo)] ?? 'Imagen';
  const r = d.revision as { hecha?: boolean; coinciden?: number; conflictos?: number } | undefined;
  if (d.tipo === 'horario' && r?.hecha) {
    return r.conflictos
      ? `${tipo} leído dos veces: ${r.coinciden} casillas coinciden y ${r.conflictos} se revisaron de nuevo (marcadas para que las mires).`
      : `${tipo} leído dos veces de forma independiente: las ${r.coinciden} casillas coinciden.`;
  }
  const ref = d.fechaReferencia as { fecha?: string; origen?: string } | null | undefined;
  return ref?.origen === 'documento' ? `${tipo} · fechas calculadas desde el ${ref.fecha}.` : `${tipo} leído.`;
}
