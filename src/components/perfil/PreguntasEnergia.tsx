'use client';

import { useState, type CSSProperties } from 'react';
import { guardarRitmo, type MomentoEnergia, type Momento, type Ritmo } from './contratoPerfil';
import { mensajeError } from '../pwa/errorRed';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const PREGUNTAS = ['¿Cuándo te concentras mejor?', '¿Cuándo te cuesta más?'];

/**
 * Las dos preguntas de la primera vez, una por pantalla y solo con botones. Se pueden saltar.
 * Guardar: energia { mejor: alta, cuesta: baja } + energiaPreguntada. «No sé» = no se manda ese momento.
 */
export default function PreguntasEnergia({ momentos, alTerminar }: { momentos: MomentoEnergia[]; alTerminar: (ritmo: Ritmo) => void }) {
  const [paso, establecerPaso] = useState<0 | 1>(0);
  const [mejor, establecerMejor] = useState<Momento | null>(null);
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);
  const opciones = momentos.filter((m) => m.disponible);

  async function guardar(cuesta: Momento | null, saltar = false) {
    establecerGuardando(true);
    establecerError(null);
    try {
      const energia: Partial<Record<Momento, 'alta' | 'baja'>> = {};
      if (!saltar && mejor) energia[mejor] = 'alta';
      if (!saltar && cuesta) energia[cuesta] = 'baja';
      alTerminar(await guardarRitmo({ ...(Object.keys(energia).length ? { energia } : {}), energiaPreguntada: true }));
    } catch (e) {
      establecerError(mensajeError(e, 'No pude guardar. Inténtalo de nuevo.'));
      establecerGuardando(false);
    }
  }

  function elegir(m: Momento | null) {
    if (paso === 0) { establecerMejor(m); establecerPaso(1); return; }
    void guardar(m);
  }

  return <div className="orbit-aparece flex flex-col gap-3 rounded-[20px] p-4" style={{ background: 'linear-gradient(150deg, #E7F1EA, #F6F9F4)' }}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11.5px] font-semibold text-[#4C6A5D]">Para conocerte · {paso + 1} de 2</span>
      <span aria-hidden="true" className="flex gap-1">{[0, 1].map((i) => <span key={i} className={'h-1.5 w-5 rounded-full ' + (i <= paso ? 'bg-[#35695D]' : 'bg-[#CFDDD3]')} />)}</span>
    </div>
    <h3 key={paso} className="orbit-aparece text-[17px] font-bold tracking-[-0.01em]" aria-live="polite">{PREGUNTAS[paso]}</h3>
    <div key={'o' + paso} className="grid grid-cols-2 gap-2">
      {opciones.map((m, i) => {
        const tomado = paso === 1 && m.momento === mejor;
        return <button key={m.momento} type="button" disabled={tomado || guardando} onClick={() => elegir(m.momento)}
          className={'orbit-aparece flex min-h-[52px] flex-col items-start justify-center rounded-2xl bg-white px-3.5 text-left shadow-[inset_0_0_0_1px_#DCE3D8] transition-colors hover:bg-[#F1F6F2] disabled:opacity-45 disabled:hover:bg-white ' + foco}
          style={{ ['--i' as string]: i } as CSSProperties}>
          <span className="text-[14.5px] font-semibold">{m.nombre}</span>
          <span className="text-[11.5px] tabular-nums text-[#647168]">{tomado ? 'ya lo elegiste' : `${m.desde}–${m.hasta}`}</span>
        </button>;
      })}
      <button type="button" disabled={guardando} onClick={() => elegir(null)}
        className={'min-h-[52px] rounded-2xl px-3.5 text-left text-[14.5px] font-semibold text-[#647168] shadow-[inset_0_0_0_1px_#DCE3D8] hover:bg-white ' + (opciones.length % 2 === 0 ? 'col-span-2 ' : '') + foco}>No sé</button>
    </div>
    {error && <p role="status" className="text-[13px] text-[#647168]">{error}</p>}
    <div className="flex items-center justify-between">
      {paso === 1 ? <button type="button" disabled={guardando} onClick={() => establecerPaso(0)} className={'min-h-10 rounded-lg text-[13px] font-semibold text-[#35695D] ' + foco}>← Atrás</button> : <span />}
      <button type="button" disabled={guardando} onClick={() => guardar(null, true)} className={'min-h-10 rounded-lg text-[13px] font-semibold text-[#647168] underline underline-offset-4 ' + foco}>
        {guardando ? 'Guardando…' : 'Saltar'}
      </button>
    </div>
  </div>;
}
