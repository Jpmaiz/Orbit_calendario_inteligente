import Link from 'next/link';
import { iniciarSesion } from '../acciones';

export default function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mensaje?: string }>;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Orbit 🪐</h1>
          <p className="text-gray-400 mt-1">Iniciá sesión</p>
        </div>

        <form action={iniciarSesion} className="space-y-4">
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
            placeholder="Contraseña"
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
          >
            Entrar
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm">
          ¿No tenés cuenta?{' '}
          <Link href="/registro" className="text-indigo-400 hover:underline">
            Registrate
          </Link>
        </p>
      </div>
    </main>
  );
}