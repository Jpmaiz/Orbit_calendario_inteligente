import { NextRequest, NextResponse } from 'next/server';
import { ia } from '@/lib/ia';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { ritmoDeUsuario } from '@/lib/usuarios/zona';
import { interpretarRespuesta, promptRitmo, resumirRitmo } from '@/lib/usuarios/ritmoTexto';

const MAX_TEXTO = 800;
const ESPERA_MAX_MS = 10_000;

/**
 * POST /api/perfil/ritmo/interpretar  Body: { texto }
 * "Cuéntale a Orbit tu semana": "trabajo martes y jueves de 6 a 9 de la noche, los domingos descanso, rindo más de noche".
 * La IA lo convierte en una PROPUESTA. No guarda nada: el front la muestra y, si el usuario acepta, guarda con
 * PATCH /api/perfil { ritmo } y crea cada compromiso con POST /api/eventos (clase fija sin materia = tiempo ocupado).
 * 200 { ritmo, cambios: ["desde", ...], compromisos: [{ titulo, diasSemana, hora, horaFin }], resumen: [string] }
 * 422 si no se entendió nada útil.
 */
export async function POST(req: NextRequest) {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let body: { texto?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  if (!texto || texto.length > MAX_TEXTO) {
    return NextResponse.json({ error: `El texto debe tener entre 1 y ${MAX_TEXTO} caracteres` }, { status: 400 });
  }
  try {
    const actual = await ritmoDeUsuario(user.id);
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const crudo = await Promise.race([
      ia.jsonDeTexto(promptRitmo(texto)),
      new Promise<null>((r) => { reloj = setTimeout(() => r(null), ESPERA_MAX_MS); }),
    ]).finally(() => clearTimeout(reloj));
    const { ritmo, cambios, compromisos } = interpretarRespuesta(crudo, actual);
    if (!cambios.length && !compromisos.length) {
      return NextResponse.json({ error: 'No encontré horarios ni preferencias en el texto. Prueba con días y horas, o ajústalo a mano.' }, { status: 422 });
    }
    return NextResponse.json({ ritmo, cambios, compromisos, resumen: resumirRitmo(ritmo, cambios, compromisos) });
  } catch (error) {
    console.error('Error en /api/perfil/ritmo/interpretar:', error);
    return NextResponse.json({ error: 'No pude leerlo ahora. Inténtalo de nuevo o ajústalo a mano.' }, { status: 502 });
  }
}
