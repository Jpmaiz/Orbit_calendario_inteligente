'use client';

import type { MomentoEnergia, Nivel } from './contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
/** Cada nivel con su palabra, su color y cuántas barras se llenan (la forma dice el nivel, no solo el color). */
const NIVEL: Record<Nivel, { texto: string; barras: number; fondo: string; tinta: string; barra: string }> = {
  alta: { texto: 'Rindes más', barras: 3, fondo: '#DCEBE2', tinta: '#1F5D50', barra: '#35695D' },
  normal: { texto: 'Normal', barras: 2, fondo: '#F1F4EE', tinta: '#4C5A51', barra: '#7FAE97' },
  baja: { texto: 'Te cuesta', barras: 1, fondo: '#FCF2DE', tinta: '#7A5A1C', barra: '#C9973C' },
};
export const SIGUIENTE: Record<Nivel, Nivel> = { alta: 'normal', normal: 'baja', baja: 'alta' };

/** Los 4 momentos del día: un toque cicla Rindes más → Normal → Te cuesta. Lo que queda fuera del horario se ve apagado. */
export default function MapaEnergia({ momentos, alCambiar }: { momentos: MomentoEnergia[]; alCambiar: (m: MomentoEnergia) => void }) {
  return <div role="group" aria-label="Tu energía en el día" className="grid grid-cols-4 gap-2">
    {momentos.map((m) => {
      const n = NIVEL[m.nivel];
      if (!m.disponible) return <div key={m.momento} className="flex min-h-[104px] flex-col justify-between rounded-2xl bg-[#F3F5F0] p-2.5 text-[#A1AAA3]"
        aria-label={`${m.nombre}: fuera de tu horario de estudio`}>
        <span className="text-[13px] font-semibold">{m.nombre}</span>
        <span className="text-[11px] leading-tight">fuera de tu horario</span>
      </div>;
      return <button key={m.momento} type="button" onClick={() => alCambiar(m)}
        aria-label={`${m.nombre}, de ${m.desde} a ${m.hasta}: ${n.texto.toLowerCase()}${m.aprendido ? ' (lo aprendió Orbit)' : ''}. Tocar para cambiar`}
        className={'group relative flex min-h-[104px] flex-col justify-between rounded-2xl p-2.5 text-left transition-[background,transform] duration-200 active:scale-95 ' + foco}
        style={{ background: n.fondo, color: n.tinta }}>
        <span className="flex flex-col">
          <span className="text-[13px] font-bold leading-tight">{m.nombre}</span>
          <span className="text-[10.5px] tabular-nums opacity-75">{m.desde}–{m.hasta}</span>
        </span>
        <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
          {[1, 2, 3].map((i) => <span key={i} className="w-[5px] rounded-full transition-all duration-300"
            style={{ height: 5 + i * 3.5, background: i <= n.barras ? n.barra : 'rgba(38,61,52,.12)' }} />)}
        </span>
        <span key={m.nivel} className="orbit-aparece text-[11.5px] font-semibold leading-tight">{n.texto}</span>
        {m.aprendido && <span className="absolute right-1.5 top-1.5 rounded-full bg-white/80 px-1.5 py-px text-[9.5px] font-bold">aprendido</span>}
      </button>;
    })}
  </div>;
}
