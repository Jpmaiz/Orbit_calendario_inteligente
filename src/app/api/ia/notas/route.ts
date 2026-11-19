import { NextRequest, NextResponse } from 'next/server';
import { ia } from '@/lib/ia';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { notasDeIA, type Nota } from '@/lib/borrador/notas';

const MAX_TEXTO = 500;
/** Si la IA tarda más, se devuelve el texto tal cual en "otros": el usuario no espera. */
const ESPERA_MAX_MS = 6000;

function promptNotas(texto: string, titulo: string | null): string {
  return `Ordenas las notas que un estudiante universitario escribió sobre una actividad${titulo ? ` («${titulo}»)` : ''}.
Reparte el texto en notas cortas, cada una en UNA categoría:
- "llevar": cosas físicas que hay que llevar o tener listas (bata, el trabajo impreso, calculadora).
- "temas": contenidos que hay que estudiar o cubrir. Una nota por tema.
- "bibliografia": libros, artículos o fuentes.
- "duracion": cuánto dura la actividad al hacerla ("15 min por grupo"). No es el tiempo de estudio.
- "otros": cualquier otro dato útil (lugar, con quién, condiciones de entrega).
Reglas: usa las palabras del estudiante, no inventes ni agregues nada, mayúscula inicial y sin punto final.
Ignora saludos y relleno. Máximo 15 notas.
Devuelve SOLO un JSON: { "notas": [ { "categoria": "llevar" | "temas" | "bibliografia" | "duracion" | "otros", "texto": string } ] }

Texto del estudiante: """${texto}"""`;
}

/**
 * POST /api/ia/notas   Body: { texto, titulo? }
 * "Añade algo más" en Detalles: la IA reparte lo que escribió el usuario en las categorías de las notas.
 * NO guarda nada: el front agrega las notas a la tarjeta y se guardan al confirmar (o con PATCH { notas }).
 * Si la IA falla o tarda más de 6 s, devuelve el texto como una nota "otros" (ia: false).
 * 200 { notas: [{ categoria, texto }], ia: boolean }
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: { texto?: unknown; titulo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  if (!texto || texto.length > MAX_TEXTO) {
    return NextResponse.json({ error: `El texto debe tener entre 1 y ${MAX_TEXTO} caracteres` }, { status: 400 });
  }
  const titulo = typeof body.titulo === 'string' && body.titulo.trim() ? body.titulo.trim().slice(0, 200) : null;
  const sinIA: Nota[] = [{ categoria: 'otros', texto }];

  try {
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const crudo = await Promise.race([
      ia.jsonDeTexto(promptNotas(texto, titulo)),
      new Promise<null>((r) => { reloj = setTimeout(() => r(null), ESPERA_MAX_MS); }),
    ]).finally(() => clearTimeout(reloj));
    const notas = crudo ? notasDeIA((crudo as { notas?: unknown }).notas) : [];
    return NextResponse.json(notas.length ? { notas, ia: true } : { notas: sinIA, ia: false });
  } catch (error) {
    console.error('Error en /api/ia/notas:', error);
    return NextResponse.json({ notas: sinIA, ia: false });
  }
}
