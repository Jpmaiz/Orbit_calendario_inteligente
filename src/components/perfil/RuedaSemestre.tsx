'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { formatearHoras } from '../estimacion/estimacionFrontend';
import type { Semestre } from './contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CFE6D8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F4A40]';
const C = 125, R0 = 58, LARGO = 50;
const paso = (i: number) => ({ '--i': i }) as CSSProperties;

function punto(radio: number, grados: number) {
  const a = (grados - 90) * Math.PI / 180;
  return `${(C + radio * Math.cos(a)).toFixed(2)} ${(C + radio * Math.sin(a)).toFixed(2)}`;
}

/** Sector de la rueda: la semana i de n, más largo cuantas más horas tiene. */
function sector(i: number, n: number, largo: number) {
  const paso = 360 / n, a0 = i * paso + 3, a1 = (i + 1) * paso - 3, r1 = R0 + 6 + largo;
  return `M${punto(r1, a0)} A${r1.toFixed(2)} ${r1.toFixed(2)} 0 0 1 ${punto(r1, a1)} L${punto(R0, a1)} A${R0} ${R0} 0 0 0 ${punto(R0, a0)} Z`;
}

/** «Tu semestre a la vista»: las próximas semanas en una rueda; la más cargada brilla en ámbar. */
export default function RuedaSemestre({ semestre }: { semestre: Semestre }) {
  const { semanas, semanaPesada } = semestre;
  const indicePesada = semanaPesada ? semanas.findIndex((s) => s.desde === semanaPesada.desde) : -1;
  const [elegida, establecerElegida] = useState(indicePesada >= 0 ? indicePesada : 0);
  const max = Math.max(1, ...semanas.map((s) => s.horas));
  const semana = semanas[Math.min(elegida, semanas.length - 1)];
  if (!semana) return null;
  const nota = elegida === indicePesada ? 'la más cargada' : semana.horas === 0 ? 'sin entregas' : '';

  return <section aria-labelledby="perfil-semestre" className="orbit-aparece col-span-2 flex flex-col gap-3.5 overflow-hidden rounded-[28px] p-[18px] text-[#F1F6F1]"
    style={{ ...paso(1), background: 'radial-gradient(circle at 50% 38%, #2F6656 0, #1F4A40 58%, #183D35 100%)' }}>
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="perfil-semestre" className="text-base font-bold">Tu semestre a la vista</h2>
      <span className="text-xs text-[#A9C4B7]">próximas {semanas.length} semanas</span>
    </div>

    <div className="relative mx-auto h-[250px] w-[250px]">
      <svg aria-hidden="true" viewBox="0 0 250 250" className="orbit-rueda absolute inset-0 h-full w-full">
        <circle cx={C} cy={C} r={R0} fill="none" stroke="rgba(255,255,255,.08)" />
        <circle cx={C} cy={C} r={112} fill="none" stroke="rgba(255,255,255,.06)" strokeDasharray="2 5" />
        {semanas.map((s, i) => {
          const pesada = i === indicePesada, activa = i === elegida;
          return <path key={s.desde} d={sector(i, semanas.length, (s.horas / max) * LARGO)} onClick={() => establecerElegida(i)}
            className="cursor-pointer transition-opacity duration-200"
            fill={pesada ? '#E3B866' : i === 0 ? '#A9D8BF' : '#7FAE97'} opacity={activa || pesada ? 1 : 0.62}
            stroke={activa ? '#F1F6F1' : 'none'} strokeWidth={2}
            style={pesada ? { filter: 'drop-shadow(0 0 8px rgba(227,184,102,.55))' } : undefined} />;
        })}
        {semanas.map((s, i) => {
          const a = ((i + 0.5) * (360 / semanas.length) - 90) * Math.PI / 180;
          return <text key={s.desde} x={C + (R0 - 13) * Math.cos(a)} y={C + (R0 - 13) * Math.sin(a)} textAnchor="middle" dominantBaseline="middle"
            fill={i === elegida ? '#F1F6F1' : 'rgba(207,224,215,.55)'} className="text-[10.5px] font-semibold">{Number(s.desde.slice(-2))}</text>;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
        <span className="text-[11.5px] text-[#A9C4B7]">{elegida === 0 ? 'esta semana' : semana.etiqueta}</span>
        <span className="text-[30px] leading-tight font-bold tracking-[-0.02em] tabular-nums">{semana.horas ? formatearHoras(semana.horas) : 'libre'}</span>
        {nota && <span className={'text-[11.5px] font-semibold ' + (elegida === indicePesada ? 'text-[#E3B866]' : 'text-[#A9C4B7]')}>{nota}</span>}
      </div>
    </div>

    <div role="group" aria-label="Elegir semana" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
      {semanas.map((s, i) => <button key={s.desde} type="button" aria-pressed={i === elegida} onClick={() => establecerElegida(i)}
        aria-label={`Semana del ${s.etiqueta}: ${s.horas ? formatearHoras(s.horas)?.replace('~', 'unas ') : 'sin entregas'}${i === indicePesada ? ', la más cargada' : ''}`}
        className={'min-h-9 rounded-[10px] text-[11.5px] font-semibold tabular-nums transition-colors ' + foco + ' ' +
          (i === elegida ? 'bg-[#F1F6F1] text-[#1F4A40]' : i === indicePesada ? 'bg-white/[.08] text-[#F2D59A]' : 'bg-white/[.08] text-[#CFE0D7] hover:bg-white/[.14]')}>
        {Number(s.desde.slice(-2))}
      </button>)}
    </div>

    {semanaPesada && <div className="flex flex-col gap-2.5 rounded-[18px] p-3.5 shadow-[inset_0_0_0_1px_rgba(227,184,102,.35)]" style={{ background: 'rgba(227,184,102,.14)' }}>
      <p className="flex gap-2.5 text-[13.5px] leading-relaxed text-[#F6EBD2]">
        <span aria-hidden="true" className="orbit-dia-halo mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#E3B866] shadow-[0_0_10px_#E3B866]" />
        {semanaPesada.mensaje}
      </p>
      <Link href={'/semana?dia=' + semanaPesada.desde}
        className={'inline-flex min-h-10 items-center self-start rounded-full bg-[#F6EBD2] px-4 text-[13.5px] font-bold text-[#4A3810] hover:bg-white ' + foco}>Ver esa semana</Link>
    </div>}
  </section>;
}
