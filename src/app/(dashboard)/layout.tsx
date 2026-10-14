import { cerrarSesion } from '../(auth)/acciones';
import ControlesDashboard from '@/components/dashboard/ControlesDashboard';

export default function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#F6F7F2] font-sans text-[#263D34] selection:bg-[#DCE8D5]">
      <main id="contenido-principal" className="mx-auto w-full min-w-0 max-w-none px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-6 md:max-w-3xl md:px-6 md:pt-10 lg:max-w-5xl lg:px-8 lg:pt-12">
        {children}
      </main>
      <ControlesDashboard ubicacion="navegacion" cerrarSesionAction={cerrarSesion} />
    </div>
  );
}
