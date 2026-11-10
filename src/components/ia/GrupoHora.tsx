'use client';

import { useState } from 'react';

export type CampoHora = { etiqueta: string; valor: string; cambiar: (hora: string) => void; minimo?: string };

const HORAS = Array.from({ length: 36 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';

/** Una o dos horas (Desde/Hasta) con una lista de horas cada 30 min, en vez del selector nativo. */
export default function GrupoHora({ campos }: { campos: CampoHora[] }) {
  const [abierto, establecerAbierto] = useState<number | null>(null);
  const actual = abierto === null ? null : campos[abierto];
  const lista = actual
    ? [...new Set([...HORAS, ...(actual.valor ? [actual.valor] : [])])].sort().filter((h) => !actual.minimo || h > actual.minimo)
    : [];

  function elegir(hora: string) {
    if (abierto === null) return;
    campos[abierto].cambiar(hora);
    // Al elegir "Desde", se abre "Hasta" si todavía está vacío.
    const siguiente = abierto + 1 < campos.length && !campos[abierto + 1].valor ? abierto + 1 : null;
    establecerAbierto(siguiente);
  }

  return (
    <div className="space-y-2" onKeyDown={(e) => {
      if (e.key === 'Escape' && abierto !== null) { e.preventDefault(); e.stopPropagation(); establecerAbierto(null); }
    }}>
      <div className={'grid gap-2 ' + (campos.length > 1 ? 'grid-cols-2' : 'max-w-[12rem] grid-cols-1')}>
        {campos.map((campo, i) => <button type="button" key={campo.etiqueta} aria-expanded={abierto === i}
          aria-label={`${campo.etiqueta}: ${campo.valor || 'sin elegir'}`} onClick={() => establecerAbierto(abierto === i ? null : i)}
          className={'flex min-h-[52px] flex-col items-start justify-center rounded-xl border bg-white px-3.5 text-left transition-colors ' + foco + ' '
            + (abierto === i ? 'border-[#28746B]' : 'border-[#E3E8DE] hover:border-[#C9D3CB]')}>
          <span className="text-[11px] text-[#647168]">{campo.etiqueta}</span>
          <span className="text-[15px] font-semibold tabular-nums text-[#263D34]">{campo.valor || '--:--'}</span>
        </button>)}
      </div>
      {actual && <div role="group" aria-label={actual.etiqueta} className="orbit-aparece grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto rounded-2xl border border-[#E3E8DE] bg-white p-2">
        {lista.map((hora) => {
          const elegida = hora === actual.valor;
          return <button type="button" key={hora} aria-pressed={elegida} onClick={() => elegir(hora)}
            className={'min-h-11 rounded-[10px] text-[13px] tabular-nums transition-colors ' + foco + ' '
              + (elegida ? 'bg-[#35695D] font-semibold text-white' : 'bg-[#F4F6F1] text-[#263D34] hover:bg-[#EEF4F0]')}>{hora}</button>;
        })}
      </div>}
    </div>
  );
}
