import { NextResponse } from 'next/server';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { avisosConfigurados, enviarAUsuario } from '@/lib/avisos/enviar';

/** POST /api/avisos/prueba → manda un aviso de prueba a los dispositivos del usuario. 200 { enviados } · 409 sin dispositivos */
export async function POST() {
  const user = await obtenerUsuario();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!avisosConfigurados()) return NextResponse.json({ error: 'Los avisos no están configurados en el servidor' }, { status: 503 });
  try {
    const enviados = await enviarAUsuario(user.id, {
      titulo: 'Listo: los avisos de Orbit funcionan',
      cuerpo: 'Te avisaré antes de cada bloque de estudio y la noche antes de lo que vence.',
      url: '/perfil',
      tag: 'prueba',
    }, 300);
    if (!enviados) return NextResponse.json({ error: 'Ningún dispositivo tiene los avisos activados' }, { status: 409 });
    return NextResponse.json({ enviados });
  } catch (error) {
    console.error('Error POST /api/avisos/prueba:', error);
    return NextResponse.json({ error: 'No se pudo mandar la prueba' }, { status: 500 });
  }
}
