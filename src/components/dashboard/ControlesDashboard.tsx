'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import IconoDashboard from './IconoDashboard';
import CapturaRapida, { ORBIT_AGREGADO } from '@/components/ia/CapturaRapida';

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
  // "+14" sobre Calendario cuando Orbit acaba de agregar algo
  const [nuevos, establecerNuevos] = useState<number | null>(null);

  useEffect(() => {
    if (ubicacion !== 'navegacion') return;
    let temporizador: ReturnType<typeof setTimeout>;
    const alAgregar = (evento: Event) => {
      const cantidad = (evento as CustomEvent<{ cantidad: number }>).detail?.cantidad ?? 0;
      if (cantidad <= 0) return;
      establecerNuevos(cantidad);
      clearTimeout(temporizador);
      temporizador = setTimeout(() => establecerNuevos(null), 8000);
    };
    window.addEventListener(ORBIT_AGREGADO, alAgregar);
    return () => { window.removeEventListener(ORBIT_AGREGADO, alAgregar); clearTimeout(temporizador); };
  }, [ubicacion]);

  function abrirPanel(nombre: Panel) {
    establecerPanel(nombre);
    dialogo.current?.showModal();
    establecerPanelAbierto(true);
  }

  const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';
  const estiloNavegacion = (activo: boolean) =>
    'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors ' +
    (activo ? 'bg-[#EAF0E5] text-[#245B4C] ' : 'text-[#78827B] hover:text-[#245B4C] ') + foco;

  return (
    <>
      {ubicacion === 'selector' ? null : (
        <>
          <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8EBE5] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
            <div className="mx-auto grid w-full grid-cols-4 px-4 py-2 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
              <Link href="/dia" aria-current={!panelAbierto && !esCalendario ? 'page' : undefined} className={estiloNavegacion(!panelAbierto && !esCalendario)}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="home" /></span>
                Home
              </Link>
              <Link href="/semana" onClick={() => establecerNuevos(null)} aria-current={!panelAbierto && esCalendario ? 'page' : undefined} className={estiloNavegacion(!panelAbierto && esCalendario) + ' relative'}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="calendario" /></span>
                Calendario
                {nuevos !== null && <span aria-label={`${nuevos} nuevos`} className="orbit-pop absolute right-[calc(50%-1.9rem)] top-1.5 rounded-full bg-[#234F45] px-1.5 py-px text-[10px] font-bold text-white">+{nuevos}</span>}
              </Link>
              <button type="button" onClick={() => abrirPanel('Orbit')} aria-expanded={panelAbierto && panel === 'Orbit'} aria-label="Orbit: agregar tareas, clases o eventos" className={'orbit-boton ' + (panelAbierto && panel === 'Orbit' ? estiloNavegacion(true) : estiloNavegacion(false).replace('text-[#78827B]', 'text-[#35695D]'))}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="orbit" className="h-6 w-6" /></span>
                Orbit
              </button>
              <button type="button" onClick={() => abrirPanel('Perfil')} aria-expanded={panelAbierto && panel === 'Perfil'} className={estiloNavegacion(panelAbierto && panel === 'Perfil')}>
                <span className="flex h-8 items-center"><IconoDashboard nombre="perfil" /></span>
                Perfil
              </button>
            </div>
          </nav>
        </>
      )}

      <dialog ref={dialogo} onClose={() => establecerPanelAbierto(false)}
        // Tocar fuera de la hoja la cierra (salvo mientras guarda)
        onClick={(evento) => { if (evento.target === dialogo.current && !orbitOcupado) dialogo.current?.close(); }} onCancel={(evento) => { if (orbitOcupado) evento.preventDefault(); }} aria-labelledby={tituloId} className="orbit-hoja fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto [overflow-wrap:anywhere] md:max-w-md rounded-3xl border border-[#E4E8DF] bg-[#FAFBF7] p-6 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35 max-md:mb-2 max-md:mt-auto max-md:max-h-[calc(100dvh-3.5rem)] max-md:w-[calc(100%_-_1rem)] max-md:max-w-none max-md:p-5">
        {panel === 'Orbit' ? (
          <CapturaRapida tituloId={tituloId} ocupado={orbitOcupado} onOcupadoChange={establecerOrbitOcupado} onCerrar={() => dialogo.current?.close()} />
        ) : panel === 'Perfil' ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 id={tituloId} className="min-w-0 text-xl font-semibold">Perfil</h2>
              <button type="button" onClick={() => dialogo.current?.close()} className={'inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-medium text-[#35695D] hover:bg-[#E9EEE5] ' + foco}>
                Cerrar
              </button>
            </div>
            <p className="text-xs leading-5 text-[#647168]">Edición de perfil próximamente.</p>
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
