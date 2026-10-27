import { prisma } from '@/lib/prisma/cliente';

/** Lo mínimo que necesitamos de un usuario de Supabase Auth. */
type CuentaSupabase = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Nombre del perfil: el que se dio al registrarse, el guardado en Supabase, o la parte del correo antes de @. */
function nombreDe(cuenta: CuentaSupabase, nombre?: string | null): string {
  const meta = cuenta.user_metadata ?? {};
  const candidatos = [nombre, meta.nombre, meta.full_name, cuenta.email?.split('@')[0]];
  const elegido = candidatos.find((c): c is string => typeof c === 'string' && c.trim() !== '');
  return (elegido ?? 'Estudiante').trim().slice(0, 100);
}

/**
 * Garantiza que una cuenta de Supabase tenga su perfil local (tabla usuarios).
 *
 * - IDEMPOTENTE: se puede llamar las veces que sea; si el perfil ya existe, no cambia nada.
 * - NUNCA lanza: si falla, lo registra y devuelve false. El registro o el login no se rompen
 *   por esto; el perfil se vuelve a intentar en el siguiente punto de entrada.
 *
 * Se llama en: registro, inicio de sesión, confirmación de correo y entrada al dashboard.
 * Así una cuenta que quedó sin perfil (por ejemplo, porque falló la base justo al registrarse)
 * se repara sola la próxima vez que esa persona entra.
 */
export async function asegurarPerfil(cuenta: CuentaSupabase, nombre?: string | null): Promise<boolean> {
  if (!cuenta.email) {
    console.error('asegurarPerfil: la cuenta no tiene email', cuenta.id);
    return false;
  }
  try {
    await prisma.usuario.upsert({
      where: { id: cuenta.id },
      update: {}, // si ya existe, no se toca
      create: { id: cuenta.id, email: cuenta.email, nombre: nombreDe(cuenta, nombre) },
    });
    return true;
  } catch (error) {
    console.error('asegurarPerfil: no se pudo crear el perfil local de', cuenta.id, error);
    return false;
  }
}
