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
  const [panelAbierto, establecerPanelAbierto] = useState(false);
  const [orbitOcupado, establecerOrbitOcupado] = useState(false);

  function abrirPanel(nombre: Panel) {
    establecerPanel(nombre);
    dialogo.current?.showModal();
    establecerPanelAbierto(true);
  }

  const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';
  const estiloNavegacion = (activo: boolean) =>
    'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] md:text-xs font-medium transition-colors ' +
    (activo ? 'bg-[#EAF0E5] text-[#245B4C] ' : 'text-[#78827B] hover:text-[#245B4C] ') + foco;

  return (
    <>
      {ubicacion === 'selector' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dia/nueva" className={'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[#35695D] transition-colors hover:bg-[#E7EDE6] md:text-sm ' + foco}>
            <IconoDashboard nombre="mas" className="h-4 w-4" />
            Agregar tarea
          </Link>
        </div>
      ) : (
        <>
          <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8EBE5] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
            <div className="mx-auto grid w-full grid-cols-4 px-4 py-2 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
              <Link href="/dia" aria-current={!panelAbierto && !esCalendario ? 'page' : undefined} className={estiloNavegacion(!panelAbierto && !esCalendario)}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="home" /></span>
                Home
              </Link>
              <Link href="/semana" aria-current={!panelAbierto && esCalendario ? 'page' : undefined} className={estiloNavegacion(!panelAbierto && esCalendario)}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="calendario" /></span>
                Calendario
              </Link>
              <button type="button" onClick={() => abrirPanel('Orbit')} aria-expanded={panelAbierto && panel === 'Orbit'} className={estiloNavegacion(panelAbierto && panel === 'Orbit')}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="orbit" className="h-6 w-6" /></span>
                Capturar
              </button>
              <button type="button" onClick={() => abrirPanel('Perfil')} aria-expanded={panelAbierto && panel === 'Perfil'} className={estiloNavegacion(panelAbierto && panel === 'Perfil')}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="perfil" /></span>
                Perfil
              </button>
            </div>
          </nav>
        </>
      )}

      <dialog ref={dialogo} onClose={() => establecerPanelAbierto(false)} onCancel={(evento) => { if (orbitOcupado) evento.preventDefault(); }} aria-labelledby={tituloId} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto [overflow-wrap:anywhere] md:max-w-md rounded-3xl border border-[#E4E8DF] bg-[#FAFBF7] p-6 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35">
        <div className="flex items-center justify-between gap-4">
          <h2 id={tituloId} className="min-w-0 text-xl font-semibold">{panel === 'Orbit' ? 'Capturar' : panel}</h2>
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
