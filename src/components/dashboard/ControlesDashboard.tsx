'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import IconoNavegacion from './IconoNavegacion';
import Dodecaedro from '../marca/Dodecaedro';
import CapturaRapida, { ORBIT_AGREGADO } from '@/components/ia/CapturaRapida';

type Panel = 'Orbit';
type Pestaña = 'dia' | 'calendario' | 'perfil';

export default function ControlesDashboard({
  ubicacion,
}: {
  ubicacion: 'selector' | 'navegacion';
}) {
  const ruta = usePathname();
  const esPerfil = ruta === '/perfil';
  const esSemana = ruta === '/semana';
  const esCalendario = esSemana || ruta === '/mes';
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [panel, establecerPanel] = useState<Panel>('Orbit');
  const [panelAbierto, establecerPanelAbierto] = useState(false);
  const [orbitOcupado, establecerOrbitOcupado] = useState(false);
  // "+14" sobre Calendario cuando Orbit acaba de agregar algo
  const [nuevos, establecerNuevos] = useState<number | null>(null);
  // La pestaña tocada se enciende al instante, sin esperar a que cargue la ruta; vale mientras la ruta no cambie.
  const [toque, establecerToque] = useState<{ desde: string; hacia: Pestaña } | null>(null);
  const pendiente = toque && toque.desde === ruta ? toque.hacia : null;
  const activa: Pestaña | null = panelAbierto ? null : pendiente ?? (esCalendario ? 'calendario' : esPerfil ? 'perfil' : 'dia');

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
  // Home, Calendario y Perfil: sin fondo; color, peso y animación salen de `orbit-nav` (globals.css) con aria-current.
  const estiloPestaña = 'orbit-nav flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-xs ' + foco;

  return (
    <>
      {ubicacion === 'selector' ? null : (
        <>
          <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8EBE5] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
            <div className="mx-auto grid w-full grid-cols-4 px-4 py-2 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
              <Link href="/dia" onClick={() => establecerToque({ desde: ruta, hacia: 'dia' })} aria-current={activa === 'dia' ? 'page' : undefined} className={estiloPestaña}>
                <span className="orbit-nav-icono"><IconoNavegacion nombre="home" /></span>
                Home
              </Link>
              <Link href="/semana" onClick={() => { establecerNuevos(null); establecerToque({ desde: ruta, hacia: 'calendario' }); }} aria-current={activa === 'calendario' ? 'page' : undefined} className={estiloPestaña + ' relative'}>
                <span className="orbit-nav-icono"><IconoNavegacion nombre="calendario" /></span>
                Calendario
                {nuevos !== null && <span aria-label={`${nuevos} nuevos`} className="orbit-pop absolute right-[calc(50%-1.9rem)] top-1.5 rounded-full bg-[#234F45] px-1.5 py-px text-[10px] font-bold text-white">+{nuevos}</span>}
              </Link>
              <button type="button" onClick={() => abrirPanel('Orbit')} aria-expanded={panelAbierto && panel === 'Orbit'} aria-label="Orbit: agregar tareas, clases o eventos" className={'orbit-boton ' + (panelAbierto && panel === 'Orbit' ? estiloNavegacion(true) : estiloNavegacion(false).replace('text-[#78827B]', 'text-[#35695D]'))}>
                {/* Logo de Orbit: gira lento y acelera mientras el panel está abierto */}
                <span className="orbit-anillo relative flex h-8 w-8 items-center justify-center"><Dodecaedro className="h-7 w-7" girando rapido={panelAbierto && panel === 'Orbit'} /></span>
                Orbit
              </button>
              <Link href="/perfil" onClick={() => establecerToque({ desde: ruta, hacia: 'perfil' })} aria-current={activa === 'perfil' ? 'page' : undefined} className={estiloPestaña}>
                <span className="orbit-nav-icono"><IconoNavegacion nombre="perfil" /></span>
                Perfil
              </Link>
            </div>
          </nav>
        </>
      )}

      <dialog ref={dialogo} onClose={() => establecerPanelAbierto(false)}
        // Tocar fuera de la hoja la cierra (salvo mientras guarda)
        onClick={(evento) => { if (evento.target === dialogo.current && !orbitOcupado) dialogo.current?.close(); }} onCancel={(evento) => { if (orbitOcupado) evento.preventDefault(); }} aria-labelledby={tituloId} className="orbit-hoja fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto [overflow-wrap:anywhere] md:max-w-md rounded-3xl border border-[#E4E8DF] bg-[#FAFBF7] p-6 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35 max-md:mb-2 max-md:mt-auto max-md:max-h-[calc(100dvh-3.5rem)] max-md:w-[calc(100%_-_1rem)] max-md:max-w-none max-md:p-5">
        <CapturaRapida tituloId={tituloId} ocupado={orbitOcupado} onOcupadoChange={establecerOrbitOcupado} onCerrar={() => dialogo.current?.close()} />
      </dialog>
    </>
  );
}
