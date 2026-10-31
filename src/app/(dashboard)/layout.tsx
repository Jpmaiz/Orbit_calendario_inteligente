import { cerrarSesion } from '../(auth)/acciones';
import ProveedorPeriodos from '@/components/periodos/ProveedorPeriodos';
import ConfiguracionPeriodo from '@/components/periodos/ConfiguracionPeriodo';
import ControlesDashboard from '@/components/dashboard/ControlesDashboard';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { asegurarPerfil } from '@/lib/usuarios/perfil';

export default async function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  // Una sesión abierta cuya cuenta quedó sin perfil local se repara aquí (una vez por carga de página)
  const usuario = await obtenerUsuario();
  if (usuario) await asegurarPerfil(usuario);

  return (
    <ProveedorPeriodos>
      <div className="min-h-dvh bg-[#F6F7F2] font-sans text-[#263D34] selection:bg-[#DCE8D5]">
        <main id="contenido-principal" className="mx-auto w-full min-w-0 max-w-none px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 md:max-w-3xl md:px-6 md:pt-10 lg:max-w-5xl lg:px-8 lg:pt-12">
          <ConfiguracionPeriodo />
          {children}
        </main>
        <ControlesDashboard ubicacion="navegacion" cerrarSesionAction={cerrarSesion} />
      </div>
    </ProveedorPeriodos>
  );
}
