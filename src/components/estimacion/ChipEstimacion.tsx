'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Estimado } from '@/tipos/tarea';
import IndicadorEstimacion from './IndicadorEstimacion';
import { formatearHoras } from './estimacionFrontend';

const colores = { ligera: '#82AB95', media: '#C5A355', pesada: '#C98B7A' };

export type AvisoTiempo = { texto: string; accion?: { etiqueta: string; alHacer: () => void } };

/**
 * Chip "~5 h" (borrador y tarjetas de tarea). Las razones solo se ven si el usuario las pide (guía v2.9, regla 3):
 * se abren solo al tocar el chip y se cierran solas a los 1,5 s (la cuenta se pausa con el puntero o el foco dentro).
 * aviso: "Hasta mañana a las 09:00 te queda ~1 h libre. Te faltarían ~4 h 30" (borde ámbar si hay aviso).
 */
export default function ChipEstimacion({ estimado, razones, aviso }: { estimado: Estimado; razones: string[]; aviso?: AvisoTiempo | null }) {
  const id = useId();
  const [abierta, establecerAbierta] = useState(false);
  const [dentro, establecerDentro] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // Máximo 1,5 s en pantalla; si el puntero o el foco están en la burbuja (p. ej. para tocar "Planificar"), espera.
  useEffect(() => {
    if (!abierta || dentro) return;
    const reloj = setTimeout(() => establecerAbierta(false), 1500);
    return () => clearTimeout(reloj);
  }, [abierta, dentro]);
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) establecerAbierta(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierta]);

  const horas = formatearHoras(estimado.horas);
  if (horas === null) return null;
  if (!razones.length && !aviso) return <IndicadorEstimacion estimado={estimado} />;

  return (
    <div ref={caja} className="relative" onKeyDown={(e) => {
      if (e.key === 'Escape' && abierta) { e.preventDefault(); e.stopPropagation(); establecerAbierta(false); boton.current?.focus(); }
    }}>
      <button ref={boton} type="button" aria-expanded={abierta} aria-controls={id}
        aria-label={`${horas.replace('~', 'Unas ')}${estimado.carga ? ', carga ' + estimado.carga : ''}. Ver por qué`}
        onClick={() => { establecerDentro(false); establecerAbierta(!abierta); }}
        className="group flex min-h-11 items-center focus-visible:outline-none">
        <span className={'inline-flex items-center gap-1.5 rounded-full border bg-white py-1 pl-2.5 pr-2 text-[13px] font-medium text-[#263D34] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-[#28746B] '
          + (abierta ? 'border-[#28746B]' : aviso ? 'border-[#E3C98F]' : 'border-[#E3E8DE] group-hover:border-[#C9D3CB]')}>
          {estimado.carga && <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: colores[estimado.carga] }} />}
          {horas}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="#647168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        </span>
      </button>
      {abierta && <div id={id} onPointerEnter={() => establecerDentro(true)} onPointerLeave={() => establecerDentro(false)}
        onFocus={() => establecerDentro(true)} onBlur={() => establecerDentro(false)} className="orbit-aparece absolute left-0 top-full z-20 w-64 max-w-[calc(100vw-5rem)] rounded-2xl bg-[#263D34] px-3.5 py-3 text-white shadow-[0_10px_28px_rgba(38,61,52,.25)]">
        <span aria-hidden="true" className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 bg-[#263D34]" />
        {razones.length > 0 && <>
          <p className="relative text-[13px] font-semibold">Por qué {horas}</p>
          <ul className="relative mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] leading-snug text-[#E4ECE6]">
            {razones.map((razon) => <li key={razon}>{razon}</li>)}
          </ul>
        </>}
        {aviso ? <div className={'relative space-y-2 ' + (razones.length ? 'mt-2.5 border-t border-white/15 pt-2.5' : '')}>
          <p className="flex gap-2 text-[13px] leading-snug text-[#F5E6C4]">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E3C98F]" />{aviso.texto}
          </p>
          {aviso.accion && <button type="button" onClick={() => { establecerAbierta(false); aviso.accion!.alHacer(); }}
            className="min-h-10 rounded-[10px] bg-white px-3 text-[13px] font-semibold text-[#263D34] hover:bg-[#EEF4F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {aviso.accion.etiqueta}
          </button>}
        </div> : <p className="relative mt-2 text-xs leading-snug text-[#B9C8BE]">Es una estimación. Orbit la ajusta con el tiempo.</p>}
      </div>}
    </div>
  );
}
