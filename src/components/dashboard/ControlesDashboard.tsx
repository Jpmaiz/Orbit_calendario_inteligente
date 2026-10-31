'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import IconoDashboard from './IconoDashboard';
import CapturaRapida from '@/components/ia/CapturaRapida';

type Panel = 'Orbit' | 'Perfil';

export default function ControlesDashboard({
  ubicacion,
  cerrarSesionAction,
}: {
  ubicacion: 'selector' | 'navegacion';
  cerrarSesionAction?: () => Promise<void>;
}) {
  const ruta = usePathname();
  const esSemana = ruta === '/semana';
  const esCalendario = esSemana || ruta === '/mes';
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [panel, establecerPanel] = useState<Panel>('Orbit');
  const [orbitOcupado, establecerOrbitOcupado] = useState(false);

  function abrirPanel(nombre: Panel) {
    establecerPanel(nombre);
    dialogo.current?.showModal();
  }

  const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';

  return (
    <>
      {ubicacion === 'selector' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Vista del calendario" className="inline-flex min-w-0 max-w-full rounded-full bg-[#EAEDE8] p-1">
            <Link href="/dia" aria-current={!esSemana ? 'page' : undefined} className={'inline-flex min-h-11 items-center rounded-full px-5 md:px-8 text-sm font-semibold ' + (!esSemana ? 'bg-white text-[#234B43] shadow-sm ' : 'text-[#66716B] hover:text-[#234B43] ') + foco}>
              Hoy
            </Link>
            <Link href="/semana" aria-current={esSemana ? 'page' : undefined} className={'inline-flex min-h-11 items-center rounded-full px-4 md:px-7 text-sm font-semibold ' + (esSemana ? 'bg-white text-[#234B43] shadow-sm ' : 'text-[#66716B] hover:text-[#234B43] ') + foco}>
              Semana
            </Link>
          </div>
          <Link href="/dia/nueva" className={'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[#35695D] transition-colors hover:bg-[#E7EDE6] md:text-sm ' + foco}>
            <IconoDashboard nombre="mas" className="h-4 w-4" />
            Agregar tarea
          </Link>
        </div>
      ) : (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30">
            <div className="mx-auto flex w-full justify-end px-4 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
          <button type="button" onClick={() => abrirPanel('Orbit')} aria-label="Abrir Orbit" className={'pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#234F45] text-[#F2F6E9] shadow-[0_8px_24px_rgba(35,79,69,0.25)] transition-transform hover:scale-105 active:scale-95 ' + foco}>
            <IconoDashboard nombre="orbit" className="h-8 w-8" />
          </button>
            </div>
          </div>
          <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8EBE5] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
            <div className="mx-auto grid w-full grid-cols-4 px-4 py-2 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
              <Link href="/dia" aria-current={!esCalendario ? 'page' : undefined} className={'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] md:text-xs font-semibold ' + (!esCalendario ? 'text-[#245B4C] ' : 'text-[#78827B] ') + foco}>
                <span className={'flex h-8 w-14 items-center justify-center rounded-full ' + (!esCalendario ? 'bg-[#EAF0E5]' : '')}><IconoDashboard nombre="home" /></span>
                Home
              </Link>
              <Link href="/semana" aria-current={esCalendario ? 'page' : undefined} className={'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] md:text-xs font-medium transition-colors ' + (esCalendario ? 'text-[#245B4C] bg-[#EAF0E5] ' : 'text-[#78827B] hover:text-[#245B4C] ') + foco}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="calendario" /></span>
                Calendario
              </Link>
              <button type="button" onClick={() => abrirPanel('Orbit')} className={'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] md:text-xs font-medium text-[#78827B] transition-colors hover:text-[#245B4C] ' + foco}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="orbit" className="h-6 w-6" /></span>
                Capturar
              </button>
              <button type="button" onClick={() => abrirPanel('Perfil')} className={'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] md:text-xs font-medium text-[#78827B] transition-colors hover:text-[#245B4C] ' + foco}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="perfil" /></span>
                Perfil
              </button>
            </div>
          </nav>
        </>
      )}

      <dialog ref={dialogo} onCancel={(evento) => { if (orbitOcupado) evento.preventDefault(); }} aria-labelledby={tituloId} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto [overflow-wrap:anywhere] md:max-w-md rounded-3xl border border-[#E4E8DF] bg-[#FAFBF7] p-6 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35">
        <div className="flex items-center justify-between gap-4">
          <h2 id={tituloId} className="min-w-0 text-xl font-semibold">{panel}</h2>
          <button type="button" disabled={orbitOcupado} onClick={() => dialogo.current?.close()} className={'inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-medium text-[#35695D] hover:bg-[#E9EEE5] disabled:cursor-wait disabled:opacity-60 ' + foco}>
            Cerrar
          </button>
        </div>
        {panel === 'Orbit' ? (
          <CapturaRapida onOcupadoChange={establecerOrbitOcupado} onCerrar={() => dialogo.current?.close()} />
        ) : panel === 'Perfil' ? (
          <div className="mt-4 space-y-5">
            <p className="text-sm leading-6 text-[#647168]">La edición de tu perfil estará disponible próximamente.</p>
            {cerrarSesionAction && (
              <form action={cerrarSesionAction}>
                <button type="submit" className={'min-h-11 w-full rounded-xl bg-[#234F45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#316457] ' + foco}>
                  Cerrar sesión
                </button>
              </form>
            )}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
