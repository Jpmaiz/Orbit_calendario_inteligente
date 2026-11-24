import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { avisosConfigurados } from '@/lib/avisos/enviar';
import { procesarAvisos } from '@/lib/avisos/procesar';

export const maxDuration = 60;

const igual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * POST /api/avisos/enviar  (solo Supabase Cron, cada 5 min) Header: Authorization: Bearer <AVISOS_SECRETO>
 * Manda los avisos que tocan ahora (src/lib/avisos/procesar.ts). 200 { usuarios, bloques, resumenes }
 */
export async function POST(req: NextRequest) {
  const secreto = process.env.AVISOS_SECRETO;
  if (!secreto) return NextResponse.json({ error: 'Falta AVISOS_SECRETO' }, { status: 503 });
  if (!igual(req.headers.get('authorization') ?? '', `Bearer ${secreto}`)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!avisosConfigurados()) return NextResponse.json({ error: 'Faltan las claves VAPID' }, { status: 503 });
  try {
    return NextResponse.json(await procesarAvisos());
  } catch (error) {
    console.error('Error POST /api/avisos/enviar:', error);
    return NextResponse.json({ error: 'Error al enviar los avisos' }, { status: 500 });
  }
}
