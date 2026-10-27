import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { asegurarPerfil } from '@/lib/usuarios/perfil';

// Enlace del correo de confirmación: crea la sesión y lleva directo al dashboard
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Este camino no pasa por el login: aquí también se repara el perfil si falta
      if (data.user) {
        await asegurarPerfil(data.user);
      }
      return NextResponse.redirect(`${origin}/dia`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
