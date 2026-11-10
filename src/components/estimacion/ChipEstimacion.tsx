'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Estimado } from '@/tipos/tarea';
import IndicadorEstimacion from './IndicadorEstimacion';
import { formatearHoras } from './estimacionFrontend';

const colores = { ligera: '#82AB95', media: '#C5A355', pesada: '#C98B7A' };

/**
 * Chip "~5 h" del borrador. Las razones solo se ven si el usuario las pide (guía v2.8, regla 3):
 * se abren al pasar el mouse o al tocar el chip (tocar las deja fijas hasta tocar de nuevo o fuera).
 */
export default function ChipEstimacion({ estimado, razones }: { estimado: Estimado; razones: string[] }) {
  const id = useId();
  const [modo, establecerModo] = useState<'hover' | 'fijo' | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modo !== 'fijo') return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) establecerModo(null); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [modo]);

  const horas = formatearHoras(estimado.horas);
  if (horas === null) return null;
  if (!razones.length) return <IndicadorEstimacion estimado={estimado} />;

  return (
    <div ref={caja} className="relative"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') establecerModo((m) => m ?? 'hover'); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') establecerModo((m) => (m === 'hover' ? null : m)); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && modo) { e.preventDefault(); e.stopPropagation(); establecerModo(null); boton.current?.focus(); }
      }}>
      <button ref={boton} type="button" aria-expanded={!!modo} aria-controls={id}
        aria-label={`${horas.replace('~', 'Unas ')}${estimado.carga ? ', carga ' + estimado.carga : ''}. Ver por qué`}
        onClick={() => establecerModo((m) => (m === 'fijo' ? null : 'fijo'))}
        className="group flex min-h-11 items-center focus-visible:outline-none">
        <span className={'inline-flex items-center gap-1.5 rounded-full border bg-white py-1 pl-2.5 pr-2 text-[13px] font-medium text-[#263D34] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-[#28746B] '
          + (modo ? 'border-[#28746B]' : 'border-[#E3E8DE] group-hover:border-[#C9D3CB]')}>
          {estimado.carga && <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: colores[estimado.carga] }} />}
          {horas}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="#647168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        </span>
      </button>
      {modo && <div id={id} className="orbit-aparece absolute left-0 top-full z-20 w-64 max-w-[calc(100vw-5rem)] rounded-2xl bg-[#263D34] px-3.5 py-3 text-white shadow-[0_10px_28px_rgba(38,61,52,.25)]">
        <span aria-hidden="true" className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 bg-[#263D34]" />
        <p className="relative text-[13px] font-semibold">Por qué {horas}</p>
        <ul className="relative mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] leading-snug text-[#E4ECE6]">
          {razones.map((razon) => <li key={razon}>{razon}</li>)}
        </ul>
        <p className="relative mt-2 text-xs leading-snug text-[#B9C8BE]">Es una estimación. Orbit la ajusta con el tiempo.</p>
      </div>}
    </div>
  );
}
