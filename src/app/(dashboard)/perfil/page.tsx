import PerfilVista from '@/components/dashboard/PerfilVista';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { cerrarSesion } from '../../(auth)/acciones';

export default async function PaginaPerfil() {
  const usuario = await obtenerUsuario();
  const nombre = [usuario?.user_metadata?.nombre, usuario?.user_metadata?.full_name]
    .find((valor): valor is string => typeof valor === 'string' && valor.trim().length > 0);
  return <PerfilVista nombre={nombre?.trim() ?? null} correo={usuario?.email ?? null}
    fechaActual={new Date().toISOString()} cerrarSesionAction={cerrarSesion} />;
}
