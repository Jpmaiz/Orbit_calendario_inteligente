import Link from 'next/link';
import { BotonRegistro, CampoContrasena } from './ControlesRegistro';
import { registrarse } from '../acciones';

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

export default async function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main lang="es" className="flex min-h-svh flex-col items-center justify-center bg-[#E7F8EF] px-4 py-8 font-sans text-[#173C33] sm:px-6 sm:py-12">
      <div className="w-full max-w-[460px] space-y-7 sm:space-y-8">
        <header className="space-y-3 text-center">
          <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1F5D50] text-white shadow-sm">
            <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
              <ellipse cx="16" cy="16" rx="13" ry="6" transform="rotate(-35 16 16)" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="3" fill="currentColor" />
              <circle cx="25" cy="7" r="2" fill="currentColor" />
            </svg>
          </span>
          <h1 className="text-4xl font-semibold tracking-[0.12em]">ORBIT</h1>
          <p className="text-sm text-[#566D63]">Tu tiempo en órbita</p>
        </header>

        <section aria-labelledby="titulo-registro" className="space-y-6 rounded-3xl border border-[#DCEDE3] bg-white px-5 py-7 shadow-[0_16px_48px_-16px_rgba(31,93,80,0.2)] sm:px-9 sm:py-9">
          <div className="space-y-2 text-center">
            <h2 id="titulo-registro" className="text-2xl font-semibold tracking-tight">Crea tu cuenta</h2>
            <p className="text-sm leading-6 text-[#566D63]">
              Empieza a organizar tus tareas y tu tiempo con ORBIT.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 break-words text-rose-800"
            >
              {traducirError(error)}
            </div>
          )}

          <form action={registrarse} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="nombre" className="block text-sm font-medium">
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="name"
                placeholder="Tu nombre"
                required
                className="min-h-12 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-[#F3FAF6] px-4 py-3 text-base text-[#173C33] placeholder:text-[#61756B] transition-colors hover:border-[#93B4A5] focus-visible:border-[#1F5D50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5D50]/30 focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="correo@ejemplo.com"
                required
                className="min-h-12 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-[#F3FAF6] px-4 py-3 text-base text-[#173C33] placeholder:text-[#61756B] transition-colors hover:border-[#93B4A5] focus-visible:border-[#1F5D50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5D50]/30 focus-visible:ring-offset-2"
              />
            </div>

            <CampoContrasena />

            <BotonRegistro />
          </form>

          <p className="border-t border-[#E5EFE9] pt-6 text-center text-sm leading-7 text-[#566D63]">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="inline-block rounded-sm font-semibold text-[#1F5D50] underline-offset-4 transition-colors hover:text-[#174A3F] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5D50] focus-visible:ring-offset-4">
              Inicia sesión
            </Link>
          </p>
        </section>

        <footer className="hidden text-center text-xs text-[#566D63] sm:block">
          © 2026 ORBIT
        </footer>
      </div>
    </main>
  );
}
