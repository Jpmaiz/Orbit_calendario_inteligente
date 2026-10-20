'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

export function CampoContrasena() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor="password" className="block text-sm font-medium">
        Contraseña
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Crea una contraseña"
          minLength={6}
          aria-describedby="ayuda-password"
          required
          className="min-h-12 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-[#F3FAF6] py-3 pr-14 pl-4 text-base text-[#173C33] placeholder:text-[#61756B] transition-colors hover:border-[#93B4A5] focus-visible:border-[#1F5D50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5D50]/30 focus-visible:ring-offset-2"
        />
        <button
          type="button"
          onClick={() => setVisible((actual) => !actual)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-controls="password"
          aria-pressed={visible}
          className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#1F5D50] transition-colors hover:bg-[#E7F8EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5D50]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
      <p id="ayuda-password" className="text-xs leading-5 text-[#566D63]">
        Usa al menos 6 caracteres.
      </p>
    </div>
  );
}

export function BotonRegistro() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-12 w-full rounded-xl bg-[#1F5D50] px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#174A3F] active:bg-[#123C33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5D50] focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Creando cuenta…' : 'Crear cuenta'}
    </button>
  );
}
