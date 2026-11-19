'use client';

import { useId, useState } from 'react';
import { diaEnBolivia } from '../calendario/organizarTareasDia';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

const esDia = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
function partes(v: string) {
  const [y, m, d] = v.split('-').map(Number);
  return { y, m: m - 1, d };
}
function aISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** "2026-11-17" → "martes 17 de noviembre" */
export function textoFecha(v: string): string {
  if (!esDia(v)) return '';
  const { y, m, d } = partes(v);
  return `${DIAS[new Date(y, m, d).getDay()]} ${d} de ${MESES[m]}`;
}
function relativa(v: string, hoy: string): string {
  const a = partes(v), b = partes(hoy);
  const dias = Math.round((Date.UTC(a.y, a.m, a.d) - Date.UTC(b.y, b.m, b.d)) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return dias > 1 ? `En ${dias} días` : `Hace ${-dias} días`;
}

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const flecha = 'grid h-11 w-11 place-items-center rounded-[10px] text-[#263D34] hover:bg-[#F1F5F0] ' + foco;

/** Fecha del borrador: botón con la fecha en palabras y un calendario propio (lunes primero, días pasados apagados). */
export default function CalendarioFecha({ etiqueta, valor, cambiar, vacio = 'Elegir fecha', permitirPasado = false, diasClase = [], materia }: {
  etiqueta: string; valor: string; cambiar: (dia: string) => void; vacio?: string; permitirPasado?: boolean;
  /** Días con clase de la materia (1 = lun … 7 = dom): se marcan con un punto. */
  diasClase?: number[]; materia?: string;
}) {
  const id = useId();
  const hoy = diaEnBolivia(new Date());
  const [abierto, establecerAbierto] = useState(false);
  const [vista, establecerVista] = useState(() => partes(esDia(valor) ? valor : hoy));

  function alternar() {
    if (!abierto) establecerVista(partes(esDia(valor) ? valor : hoy));
    establecerAbierto(!abierto);
  }
  function mover(meses: number) {
    establecerVista(({ y, m }) => {
      const f = new Date(y, m + meses, 1);
      return { y: f.getFullYear(), m: f.getMonth(), d: 1 };
    });
  }
  function elegir(dia: string) {
    cambiar(dia);
    establecerAbierto(false);
  }

  const desfase = (new Date(vista.y, vista.m, 1).getDay() + 6) % 7;
  const dias = new Date(vista.y, vista.m + 1, 0).getDate();
  const celdas: (number | null)[] = [...Array<null>(desfase).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const texto = esDia(valor) ? textoFecha(valor) : vacio;

  return (
    <div className="space-y-1.5" onKeyDown={(e) => {
      if (e.key === 'Escape' && abierto) { e.preventDefault(); e.stopPropagation(); establecerAbierto(false); }
    }}>
      <p className="text-xs font-medium text-[#647168]">{etiqueta}</p>
      <button type="button" aria-expanded={abierto} aria-controls={id} aria-label={`${etiqueta}: ${texto}. Cambiar`} onClick={alternar}
        className={'flex min-h-[52px] w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left text-[#263D34] transition-colors ' + foco + ' '
          + (abierto ? 'border-[#28746B]' : 'border-[#E3E8DE] hover:border-[#C9D3CB]')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="#35695D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-medium first-letter:uppercase">{texto}</span>
          {esDia(valor) && <span className="text-xs text-[#647168]">{relativa(valor, hoy)}</span>}
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={'h-4 w-4 shrink-0 transition-transform duration-200 ' + (abierto ? 'rotate-180' : '')} fill="none" stroke="#647168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {abierto && <div id={id} className="orbit-aparece rounded-2xl border border-[#E3E8DE] bg-white p-3 pb-1.5 shadow-[0_8px_24px_rgba(38,61,52,.08)]">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} className={flecha}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <p aria-live="polite" className="text-[15px] font-semibold text-[#263D34] first-letter:uppercase">{MESES[vista.m]} {vista.y}</p>
          <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)} className={flecha}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {SEMANA.map((d) => <span key={d} aria-hidden="true" className="py-1 text-center text-[11px] font-medium text-[#647168]">{d}</span>)}
          {celdas.map((dia, i) => {
            if (dia === null) return <span key={'v' + i} aria-hidden="true" />;
            const v = aISO(vista.y, vista.m, dia);
            const elegido = v === valor, esHoy = v === hoy, pasado = !permitirPasado && v < hoy;
            const conClase = !pasado && diasClase.includes(((new Date(vista.y, vista.m, dia).getDay() + 6) % 7) + 1);
            return <button type="button" key={v} disabled={pasado} aria-pressed={elegido}
              aria-label={textoFecha(v) + (esHoy ? ', hoy' : '') + (conClase ? ', hay clase' : '')}
              onClick={() => elegir(v)}
              className={'relative h-11 rounded-xl text-sm tabular-nums transition-colors ' + foco + ' ' + (elegido ? 'bg-[#35695D] font-semibold text-white'
                : pasado ? 'cursor-default text-[#A9B2AB]'
                : esHoy ? 'font-semibold text-[#263D34] shadow-[inset_0_0_0_1.5px_#35695D] hover:bg-[#EEF4F0]'
                : 'text-[#263D34] hover:bg-[#EEF4F0]')}>
              {dia}
              {conClase && <span aria-hidden="true" className={'absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ' + (elegido ? 'bg-white' : 'bg-[#35695D]')} />}
            </button>;
          })}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-[#E3E8DE]">
          {diasClase.length > 0 && materia ? <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-[#647168]">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#35695D]" />Clase de {materia}
          </span> : <span />}
          <button type="button" onClick={() => elegir(hoy)} className={'min-h-11 rounded-lg px-2.5 text-[13px] font-semibold text-[#35695D] hover:bg-[#F1F5F0] ' + foco}>Hoy</button>
        </div>
      </div>}
    </div>
  );
}
