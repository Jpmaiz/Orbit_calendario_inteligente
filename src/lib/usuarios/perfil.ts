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
export const MAX_APODO = 40;

/** Lo que se muestra en toda la app: el apodo si lo tiene, si no el nombre de registro. */
export function nombreVisible(u: { nombre: string; apodo: string | null }): string {
  return u.apodo?.trim() || u.nombre;
}

/** Valida el apodo que manda el perfil. "" o null = quitarlo (vuelve al nombre). undefined = no vino. */
export function normalizarApodo(v: unknown): { ok: true; apodo: string | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, apodo: null };
  if (typeof v !== 'string') return { ok: false, error: 'apodo debe ser texto (o null para quitarlo)' };
  const apodo = v.replace(/\s+/g, ' ').trim();
  if (apodo.length > MAX_APODO) return { ok: false, error: `El apodo puede tener hasta ${MAX_APODO} caracteres` };
  return { ok: true, apodo: apodo || null };
}

/** Perfiles ya verificados en este proceso: el layout no repite el upsert en cada página. */
const asegurados = new Set<string>();

export async function asegurarPerfil(cuenta: CuentaSupabase, nombre?: string | null): Promise<boolean> {
  if (asegurados.has(cuenta.id)) return true;
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
    asegurados.add(cuenta.id);
    return true;
  } catch (error) {
    console.error('asegurarPerfil: no se pudo crear el perfil local de', cuenta.id, error);
    return false;
  }
}
