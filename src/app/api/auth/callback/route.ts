import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/servidor';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dia`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}