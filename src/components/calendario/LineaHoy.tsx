'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import PanelPlanEstudio from '../plan/PanelPlanEstudio';
import type { AgendaDia } from './agendaDia';
import { construirLinea, type ItemLinea } from './construirLineaHoy';
import { useAhora } from './useAhora';
import { duracion, hhmm, minutoBolivia } from '../plan/grillaPlan';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const retraso = (i: number) => ({ '--t': Math.min(80 + i * 55, 520) + 'ms' }) as CSSProperties;
const tinte = (color: string, p: number) => `color-mix(in srgb, ${color} ${p}%, transparent)`;
const fuerte = (color: string) => `color-mix(in srgb, ${color} 58%, #1D2B25)`;

const Icono = ({ children }: { children: ReactNode }) =>
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const ICONOS = {
  clase: <Icono><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H3z" /><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z" /></Icono>,
  evento: <Icono><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.4" fill="currentColor" /></Icono>,
  estudio: <Icono><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></Icono>,
  tarea: <Icono><path d="M5 21V4m0 0h11l-2 4 2 4H5" /></Icono>,
  hecho: <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
};

function Latido({ color }: { color: string }) {
  return <span aria-hidden="true" className="relative h-2 w-2 shrink-0">
    <span className="orbit-dia-halo absolute inset-0 rounded-full [animation-delay:0s]" style={{ background: color }} />
    <span className="absolute inset-0 rounded-full" style={{ background: color }} />
  </span>;
}

/** "Hoy": tus clases, eventos, estudio y entregas del día en una línea de tiempo. Toca una para ver el detalle. */
export default function LineaHoy({ agenda }: { agenda: AgendaDia }) {
  const id = useId();
  const ahora = useAhora();
  const [abierto, establecerAbierto] = useState<string | null>(null);
  const [verPasadas, establecerVerPasadas] = useState(false);
  const [plan, establecerPlan] = useState<{ id: string; titulo: string; horaDefinida: boolean } | null>(null);
  const linea = construirLinea(agenda, ahora, verPasadas);
  const m = minutoBolivia(ahora);
  const resumen = linea.restantes === 0 ? 'nada más' : linea.restantes === 1 ? 'queda 1' : 'quedan ' + linea.restantes;

  function fila(item: ItemLinea, i: number) {
    const { color } = item;
    const pasado = item.estado === 'pasado', actual = item.estado === 'actual';
    const esAbierto = abierto === item.clave;
    const relleno = actual && item.fin !== null ? Math.round(((m - item.ini) / (item.fin - item.ini)) * 100) : 0;
    const accion = item.tarea && !pasado
      ? item.tipo === 'estudio' ? 'Ver plan de estudio' : 'Planificar estudio' : null;
    return <li key={item.clave} className="orbit-dia-sube group flex gap-3" style={retraso(i)}>
      <div className="w-[46px] shrink-0 pt-1.5 text-right tabular-nums">
        <p className="text-sm font-semibold" style={{ color: actual ? fuerte(color) : pasado ? '#9AA59D' : '#263D34' }}>{hhmm(item.ini)}</p>
        <p className="mt-0.5 text-xs text-[#8A958D]">{item.tipo === 'tarea' ? 'vence' : item.fin !== null ? hhmm(item.fin) : ''}</p>
      </div>
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span aria-hidden="true" className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-[1.06] motion-reduce:transition-none"
          style={{
            background: pasado ? '#D9DED5' : tinte(color, actual ? 30 : 20),
            color: pasado || actual ? '#FFFFFF' : fuerte(color),
            boxShadow: actual ? `0 6px 16px ${tinte(color, 40)}` : undefined,
          }}>
          {actual && <span className="orbit-dia-llena absolute inset-x-0 top-0 transition-[height] duration-1000" style={{ height: relleno + '%', background: color }} />}
          <span className="relative">{pasado ? ICONOS.hecho : ICONOS[item.tipo]}</span>
        </span>
        <span aria-hidden="true" className={'min-h-4 w-0 flex-1 border-l-2 ' + (pasado ? 'border-solid border-[#C9D3C4]' : 'border-dashed border-[#D5DBD0]')} />
      </div>
      <div className="min-w-0 flex-1 pb-3.5">
        <div className="-mx-2 -mt-1 rounded-2xl transition-colors duration-200" style={{ background: esAbierto ? tinte(color, 11) : actual ? tinte(color, 8) : undefined }}>
          <button type="button" aria-expanded={esAbierto} aria-controls={id + item.clave}
            onClick={() => establecerAbierto(esAbierto ? null : item.clave)}
            className={'flex min-h-11 w-full flex-col gap-0.5 rounded-2xl px-2 pb-2 pt-1.5 text-left transition-colors hover:bg-[#263D34]/[.04] ' + foco}>
            <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: pasado ? '#9AA59D' : fuerte(color) }}>{item.etiqueta}</span>
            <span className="text-base font-semibold leading-snug" style={{ color: pasado ? '#8A958D' : '#263D34' }}>{item.titulo}</span>
            {actual && item.fin !== null && <span className="mt-1 inline-flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: fuerte(color) }}>
              <Latido color={color} />quedan {duracion(item.fin - m)}
            </span>}
          </button>
          <div id={id + item.clave} inert={!esAbierto}
            className={'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ' + (esAbierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <div className="space-y-2 px-2 pb-2.5">
                <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: tinte(color, 30) }}>
                  {item.datos.map((d, j) => <p key={j} className="flex items-baseline gap-2.5 text-sm">
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 -translate-y-px rounded-[2px]" style={{ background: color }} />
                    <span className="w-[68px] shrink-0 text-[#8A958D]">{d.k}</span>
                    <span className="min-w-0 text-[#4F5D54] [overflow-wrap:anywhere]">{d.v}</span>
                  </p>)}
                </div>
                {accion && item.tarea && <button type="button" onClick={() => establecerPlan(item.tarea)}
                  className={'-ml-1 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold transition-colors hover:bg-white/60 ' + foco} style={{ color: fuerte(color) }}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v5M9.5 15.5h5" /></svg>
                  {accion}
                </button>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>;
  }

  return (
    <section aria-labelledby={id + 'titulo'} className="min-w-0 space-y-4">
      <div className="orbit-dia-sube flex items-baseline justify-between" style={retraso(0)}>
        <h2 id={id + 'titulo'} className="text-[21px] font-semibold tracking-[-0.015em]">Hoy</h2>
        {!linea.vacio && <span className="text-sm text-[#647168]">{resumen}</span>}
      </div>

      {linea.vacio && <p className="text-sm text-[#647168]">Hoy no tienes clases, eventos ni estudio planificado.</p>}

      {linea.pasadas.length > 0 && <button type="button" aria-expanded={verPasadas} onClick={() => establecerVerPasadas(!verPasadas)}
        className={'orbit-dia-sube -mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 text-left text-[#647168] transition-colors hover:bg-[#EEF1EA] ' + foco} style={retraso(1)}>
        <span aria-hidden="true" className="w-[46px] shrink-0" />
        <span aria-hidden="true" className="grid h-7 w-10 shrink-0 place-items-center rounded-full bg-[#E3EDE6] text-[#35695D]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {verPasadas ? 'Ocultar las terminadas'
            : `${linea.pasadas.length === 1 ? '1 terminada' : linea.pasadas.length + ' terminadas'} · ${linea.pasadas.map((p) => p.titulo.split(/\s+/)[0]).join(', ')}`}
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={'h-4 w-4 shrink-0 transition-transform duration-200 ' + (verPasadas ? 'rotate-180' : '')} fill="none" stroke="#8A958D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>}

      {linea.filas.length > 0 && <ol className="min-w-0">
        {linea.filas.map((f, i) => f.tipo === 'item' ? fila(f.item, i + 2) : (
          <li key={f.clave} className="orbit-dia-sube flex gap-3" style={retraso(i + 2)}>
            <span aria-hidden="true" className="w-[46px] shrink-0" />
            <span aria-hidden="true" className="flex w-10 shrink-0 justify-center"><span className="w-0 border-l-2 border-dashed border-[#D5DBD0]" /></span>
            <div className="min-w-0 flex-1 pb-4 pt-0.5">
              <span className={'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13.5px] ' + (f.ahora
                ? 'bg-[#E3EFE7] font-semibold text-[#1F5D50]' : 'font-medium text-[#8A958D] shadow-[inset_0_0_0_1px_#E1E6DC]')}>
                {f.ahora && <Latido color="#35695D" />}
                {f.ahora ? 'Libre ahora · ' : 'Libre · '}{duracion(f.minutos)}
              </span>
            </div>
          </li>
        ))}
      </ol>}

      {linea.manana && <div className="orbit-dia-sube flex items-center gap-3 text-[#8A958D]" style={retraso(linea.filas.length + 2)}>
        <span className="w-[46px] shrink-0 text-right text-[13px] font-semibold tabular-nums">{linea.manana.hora}</span>
        <span aria-hidden="true" className="flex w-10 shrink-0 justify-center"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#C3CCBF]" /></span>
        <p className="min-w-0 truncate text-sm"><span className="font-semibold text-[#647168]">Mañana</span> · {linea.manana.titulo}</p>
      </div>}

      {plan && <PanelPlanEstudio tareaId={plan.id} titulo={plan.titulo} horaDefinida={plan.horaDefinida} onCerrar={() => establecerPlan(null)} />}
    </section>
  );
}
