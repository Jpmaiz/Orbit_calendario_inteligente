import { NextRequest, NextResponse } from 'next/server';
import { ia } from '@/lib/ia/gemini';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';

export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const texto = (body as { texto?: unknown }).texto;
  if (typeof texto !== 'string' || texto.trim() === '') {
    return NextResponse.json({ error: 'Falta el texto' }, { status: 400 });
  }

  try {
    const inicio = Date.now();
    const interpretacion = await ia.interpretarTexto(texto);
    const latencia = Date.now() - inicio;

    await prisma.interpretacionIA.create({
      data: {
        usuarioId: user.id, // del login, no del body
        tipoEntrada: 'texto',
        entradaOriginal: texto,
        respuestaIa: interpretacion as object,
        confianza: interpretacion.confianza,
        modeloUsado: 'gemini-flash-latest',
        tiempoRespuestaMs: latencia,
        estado: 'pendiente',
      },
    });

    return NextResponse.json({ interpretacion });
  } catch (error) {
    console.error('Error en /api/ia:', error);
    return NextResponse.json({ error: 'Error al interpretar el texto' }, { status: 500 });
  }
}