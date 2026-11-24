'use client';
import { useEnLinea } from './useEnLinea';

/** Nota corta junto a un botón que cambia datos. Solo aparece sin conexión. */
export default function NecesitasInternet({ className = '' }: { className?: string }) {
  const enLinea = useEnLinea();
  if (enLinea) return null;
  return <p role="status" className={'orbit-aparece inline-flex items-center gap-1.5 text-xs text-[#8A958D] ' + className}>
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5a10 10 0 0 1 4.2-2.3M2 8.8a15 15 0 0 1 4.3-2.6M15 10.4a10 10 0 0 1 4 2.1M18 6.4a15 15 0 0 1 4 2.4M8.6 16a5 5 0 0 1 6.8 0M12 20h.01M3 3l18 18" />
    </svg>
    Necesitas internet para esto
  </p>;
}
