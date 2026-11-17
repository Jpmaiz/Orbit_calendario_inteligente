import PerfilVista from '@/components/dashboard/PerfilVista';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { cerrarSesion } from '../../(auth)/acciones';

/** Nombre y apodo salen de la base de Orbit (tabla usuarios), igual que en /dia: así se ven iguales en toda la app. */
async function cargarPerfil(id: string) {
  try {
    return await prisma.usuario.findUnique({ where: { id }, select: { nombre: true, apodo: true } });
  } catch {
    console.warn('No se pudo cargar el perfil.');
    return null;
  }
}

export default async function PaginaPerfil() {
  const usuario = await obtenerUsuario();
  const perfil = usuario ? await cargarPerfil(usuario.id) : null;
  const nombreSesion = [usuario?.user_metadata?.nombre, usuario?.user_metadata?.full_name]
    .find((valor): valor is string => typeof valor === 'string' && valor.trim().length > 0);
  const fotoUrl = [usuario?.user_metadata?.avatar_url, usuario?.user_metadata?.picture]
    .find((valor): valor is string => typeof valor === 'string' && /^https?:\/\//i.test(valor));
  return <PerfilVista nombre={perfil?.nombre?.trim() || nombreSesion?.trim() || null} apodo={perfil?.apodo ?? null}
    correo={usuario?.email ?? null} fotoUrl={fotoUrl ?? null}
    fechaActual={new Date().toISOString()} cerrarSesionAction={cerrarSesion} />;
}
