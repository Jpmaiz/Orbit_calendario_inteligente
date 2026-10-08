import Link from 'next/link';
import { cerrarSesion } from '../(auth)/acciones';

export default function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold">Orbit 🪐</span>
          <Link href="/dia" className="text-gray-300 hover:text-white">
            Día
          </Link>
          <Link href="/semana" className="text-gray-300 hover:text-white">
            Semana
          </Link>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-white"
          >
            Cerrar sesión
          </button>
        </form>
      </nav>
      <main className="p-6 max-w-3xl mx-auto">{children}</main>
    </div>
  );
}