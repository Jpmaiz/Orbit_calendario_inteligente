import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export type UsuarioSesion = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

/**
 * Usuario de la sesión, verificado.
 *
 * Usa getClaims(): con las claves de firma asimétricas de Supabase verifica el JWT en el servidor con las
 * claves públicas (JWKS, en caché), SIN un viaje al servidor de Auth en cada pedido. Antes, getUser() hacía
 * ese viaje (Auth está en São Paulo) en cada página y en cada /api: era lo que más tardaba.
 * Si el proyecto usa la clave antigua (HS256), getClaims() cae solo en getUser(): sigue siendo seguro.
 */
export async function obtenerUsuario(): Promise<UsuarioSesion | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (error || !c?.sub) return null;
  return {
    id: c.sub,
    email: typeof c.email === 'string' ? c.email : null,
    user_metadata: (c.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
}