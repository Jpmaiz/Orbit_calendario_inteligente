import Link from 'next/link';
import { iniciarSesion } from '../acciones';

function traducirError(error: string): string {
  switch (error) {
    case 'Invalid login credentials':
      return 'Email o contraseña incorrectos';
    case 'User already registered':
      return 'Ese email ya tiene una cuenta';
    case 'Password should be at least 6 characters':
      return 'La contraseña debe tener al menos 6 caracteres';
    default:
      return error;
  }
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mensaje?: string }>;
}) {
  const { error, mensaje } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10 text-gray-100 sm:py-12">
      <div className="w-full max-w-md space-y-7 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-8 shadow-xl shadow-black/20 sm:px-8">
        <header className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
              <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
                <ellipse cx="16" cy="16" rx="13" ry="6" transform="rotate(-35 16 16)" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="3" fill="currentColor" />
                <circle cx="25" cy="7" r="2" fill="currentColor" />
              </svg>
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Orbit</h1>
          </div>
          <p className="text-base font-medium text-gray-300">Inicia sesión</p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200 break-words"
          >
            {traducirError(error)}
          </div>
        )}

        {mensaje && (
          <div
            role="status"
            className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm leading-6 text-green-200 break-words"
          >
            {mensaje}
          </div>
        )}

        <form action={iniciarSesion} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@universidad.edu"
              required
              className="w-full rounded-xl border border-gray-700 bg-gray-950/60 px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 transition-colors hover:border-gray-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/25"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-200">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña"
              required
              className="w-full rounded-xl border border-gray-700 bg-gray-950/60 px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 transition-colors hover:border-gray-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/25"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Entrar
          </button>
        </form>

        <p className="border-t border-gray-800 pt-6 text-center text-sm leading-6 text-gray-400">
          ¿Aún no tienes una cuenta?{' '}
          <Link href="/registro" className="rounded-sm font-medium text-indigo-300 underline-offset-4 transition-colors hover:text-indigo-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-4 focus-visible:ring-offset-gray-900">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  );
}
