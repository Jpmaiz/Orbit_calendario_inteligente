import Link from 'next/link';
import { registrarse } from '../acciones';

export default function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Orbit 🪐</h1>
          <p className="text-gray-400 mt-1">Creá tu cuenta</p>
        </div>

        <form action={registrarse} className="space-y-4">
          <input
            name="nombre"
            type="text"
            placeholder="Tu nombre"
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña (mínimo 6)"
            minLength={6}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
          >
            Crear cuenta
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-indigo-400 hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}