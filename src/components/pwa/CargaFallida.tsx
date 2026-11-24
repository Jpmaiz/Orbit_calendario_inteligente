'use client';
import { useEnLinea } from './useEnLinea';
import { SIN_RED } from './errorRed';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';

/** Órbita punteada con el satélite quieto: «en pausa». */
export function OrbitaEnPausa({ className = 'h-4 w-4' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={'shrink-0 ' + className}>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.8" strokeDasharray="2.2 3.2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    <circle cx="17.7" cy="6.3" r="2.4" fill="currentColor" className="orbit-respira" />
  </svg>;
}

/**
 * Lo que no se pudo cargar. Sin conexión: una línea tranquila (los hooks de carga vuelven a pedir solos al volver internet).
 * Con conexión: el mensaje y «Reintentar». Nunca muestra «Failed to fetch».
 */
export default function CargaFallida({ texto, error, recargar, className = '' }: {
  texto: string; error?: string | null; recargar?: () => void; className?: string;
}) {
  const enLinea = useEnLinea();
  const sinRed = !enLinea || error === SIN_RED;
  if (sinRed) return <p role="status" className={'flex items-center gap-2 text-[13px] text-[#8A958D] ' + className}>
    <OrbitaEnPausa />Se carga cuando vuelvas a tener internet.
  </p>;
  return <p role="alert" className={'text-sm text-[#647168] ' + className}>
    {texto}{' '}
    {recargar && <button type="button" onClick={recargar} className={'min-h-11 font-semibold text-[#35695D] underline underline-offset-4 ' + foco}>Reintentar</button>}
  </p>;
}
