import { NextRequest, NextResponse } from 'next/server';
import { ia, modeloIA } from '@/lib/ia';
import type { ImagenEntrada } from '@/lib/ia/adaptador';
import { leerImagenes } from '@/lib/ia/imagen';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { diaEnZona } from '@/lib/periodos/periodos';
import { cargarContexto, construirBorrador } from '@/lib/borrador/construirBorrador';

// Un horario se lee dos veces (lectura + revisión): puede tardar más que un texto
export const maxDuration = 60;

const MAX_IMAGENES = 3;
const MAX_BYTES_IMAGEN = 4 * 1024 * 1024; // 4 MB por imagen (el front debe comprimir antes)
const MAX_TEXTO_ADJUNTO = 15_000;
const DIA_MS = 86_400_000;

/**
 * POST /api/ia/extraer-imagen
 * Body: { imagenes: string[], textoAdjunto?: string }
 *   - imagenes: 1 a 3, en base64 o data URL (JPEG, PNG o WebP). Un PDF llega como sus páginas convertidas a imagen.
 *   - textoAdjunto: texto extraído del PDF (opcional). Ayuda a no equivocarse en siglas y horas.
 *
 * Mismo resultado que /api/ia/extraer (borrador → revisar → confirmar), más "documento":
 * qué tipo de imagen era, desde qué fecha se calcularon las fechas relativas, el periodo
 * que trae el documento y el resultado de la segunda revisión (horarios).
 *
 * La imagen NO se guarda: se procesa y se descarta.
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const imagenes = validarImagenes(body.imagenes);
  if (typeof imagenes === 'string') {
    return NextResponse.json({ error: imagenes }, { status: 400 });
  }
  const textoAdjunto =
    typeof body.textoAdjunto === 'string' && body.textoAdjunto.trim()
      ? body.textoAdjunto.trim().slice(0, MAX_TEXTO_ADJUNTO)
      : null;

  try {
    const ahora = new Date();
    const ctx = await cargarContexto(user.id, ahora);

    // 1) La IA percibe (y revisa, si es un horario)
    const inicio = Date.now();
    const r = await leerImagenes(ia, imagenes, {
      ahora, zonaHoraria: ctx.zona, materias: ctx.materias.map((m) => m.nombre),
    }, textoAdjunto);
    const latencia = Date.now() - inicio;
    const { lectura } = r;
    const advertencias = [...r.avisos];

    // 2) Fecha de referencia: en una captura, "mañana" se cuenta desde el día de los mensajes
    let referencia: Date | undefined;
    let fechaReferencia: { fecha: string; origen: 'documento' | 'hoy' } | null = null;
    // Ítems con "mañana" / "el lunes" que no dicen de qué día es el mensaje
    const usaRelativas = r.items.some((i) => i.fechaDicha && i.fechaDicha.tipo !== 'exacta' && !i.fechaReferencia);
    if (lectura.fechaDocumento) {
      const d = diaEnZona(lectura.fechaDocumento, '12:00', ctx.zona);
      if (d && d.getTime() <= ahora.getTime() + DIA_MS) {
        referencia = d;
        fechaReferencia = { fecha: lectura.fechaDocumento, origen: 'documento' };
      }
    }
    if (!fechaReferencia && usaRelativas) {
      fechaReferencia = { fecha: new Intl.DateTimeFormat('en-CA', { timeZone: ctx.zona }).format(ahora), origen: 'hoy' };
      if (lectura.tipoDocumento === 'captura_chat') {
        // No se ve de qué día son los mensajes: se asume hoy y se pregunta
        advertencias.push('No se ve la fecha de los mensajes. Calculé las fechas como si fueran de hoy: confírmalo.');
      }
    }

    // 3) Periodo impreso en el documento (horario de la U): da la vigencia de las clases
    let periodoDetectado = null;
    let vigencia = null;
    if (lectura.periodo) {
      const desde = diaEnZona(lectura.periodo.inicio, '00:00', ctx.zona);
      const hasta = diaEnZona(lectura.periodo.fin, '23:59', ctx.zona);
      const duracionDias = desde && hasta ? (hasta.getTime() - desde.getTime()) / DIA_MS : 0;
      if (desde && hasta && duracionDias > 7 && duracionDias < 400) {
        const nombre = lectura.periodo.nombre ?? `${lectura.periodo.inicio} a ${lectura.periodo.fin}`;
        // ¿Ya lo tiene cargado? (cualquier periodo del usuario que se cruce con estas fechas)
        const existente = await prisma.periodoAcademico.findFirst({
          where: { usuarioId: user.id, eliminadoEn: null, inicio: { lte: hasta }, fin: { gte: desde } },
          select: { id: true, nombre: true, inicio: true, fin: true },
        });
        periodoDetectado = { nombre, inicio: desde.toISOString(), fin: hasta.toISOString(), existente };
        vigencia = { desde: desde.toISOString(), hasta: hasta.toISOString(), periodo: nombre };
      }
    }

    // 4) El sistema decide (igual que con texto)
    const borrador = await construirBorrador(user.id, r.items, ctx, { ahora, referencia, vigencia });

    // Se guarda lo LEÍDO (sin la imagen ni el texto del PDF, que pueden tener datos personales)
    const registro = await prisma.interpretacionIA.create({
      data: {
        usuarioId: user.id,
        tipoEntrada: 'imagen',
        entradaOriginal: `[${lectura.tipoDocumento}] ${imagenes.length} imagen(es)${textoAdjunto ? ' + texto del PDF' : ''}`,
        respuestaIa: {
          tipoDocumento: lectura.tipoDocumento,
          fechaDocumento: lectura.fechaDocumento,
          periodo: lectura.periodo,
          materias: lectura.materias,
          celdas: lectura.celdas,
          revision: r.revision,
          items: r.items,
        } as object,
        confianza: r.items.length ? r.items.reduce((s, i) => s + i.confianza, 0) / r.items.length : null,
        modeloUsado: modeloIA,
        tiempoRespuestaMs: latencia,
        estado: 'pendiente',
      },
    });

    const { periodo } = ctx;
    return NextResponse.json({
      interpretacionId: registro.id, // se reenvía a /api/ia/confirmar
      items: borrador,
      periodo: periodo ? { nombre: periodo.nombre, inicio: periodo.inicio, fin: periodo.fin } : null,
      documento: {
        tipo: lectura.tipoDocumento,
        fechaReferencia,
        periodoDetectado,
        revision: r.revision,
      },
      advertencias,
    });
  } catch (error) {
    console.error('Error en /api/ia/extraer-imagen:', error);
    return NextResponse.json({ error: 'Error al leer la imagen' }, { status: 500 });
  }
}

/** Valida formato real (por los primeros bytes, no por lo que dice el nombre) y tamaño. */
function validarImagenes(v: unknown): ImagenEntrada[] | string {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_IMAGENES) {
    return `Envía entre 1 y ${MAX_IMAGENES} imágenes`;
  }
  const salida: ImagenEntrada[] = [];
  for (const [i, x] of v.entries()) {
    if (typeof x !== 'string') return `Imagen ${i + 1}: formato inválido`;
    const base64 = x.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) return `Imagen ${i + 1}: no es base64 válido`;
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > MAX_BYTES_IMAGEN) return `Imagen ${i + 1}: pesa más de 4 MB. Redúcela antes de enviarla.`;
    const mime = detectarFormato(bytes);
    if (!mime) return `Imagen ${i + 1}: solo se aceptan JPEG, PNG o WebP`;
    salida.push({ mime, base64 });
  }
  return salida;
}

function detectarFormato(b: Buffer): ImagenEntrada['mime'] | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
