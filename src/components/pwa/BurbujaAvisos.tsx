'use client';

import { useEffect, useRef, useState } from 'react';
import { activarAvisos, avisosActivos, avisosDisponibles } from '@/lib/pwa/avisos';
import { estaInstalada } from './instalacion';
import { leerAvisos } from '../perfil/contratoAvisos';

const CLAVE = 'orbit:burbuja-avisos';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';

function yaSalio() {
  try { return localStorage.getItem(CLAVE) !== null; } catch { return true; } // sin almacenamiento: no insistir
}
function marcar() {
  try { localStorage.setItem(CLAVE, '1'); } catch { /* nada */ }
}

/** Campana con un satélite: el aviso «orbita» antes de estudiar. */
function Campana() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]">
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="18.5" cy="5" r="2.3" fill="#A9CDB9" className="orbit-respira" />
  </svg>;
}

type Estado = { tipo: 'oculta' } | { tipo: 'pregunta' } | { tipo: 'activando' } | { tipo: 'listo' } | { tipo: 'error'; mensaje: string };

/**
 * «¿Te avisamos antes de estudiar?» — una sola vez, solo en la app instalada y con sesión (va en el layout del dashboard).
 * Aparece ~1,5 s después de cargar, sobre la navegación, y nunca encima de un diálogo abierto.
 */
export default function BurbujaAvisos() {
  const [estado, establecerEstado] = useState<Estado>({ tipo: 'oculta' });
  const cerrarReloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (yaSalio() || !estaInstalada() || !avisosDisponibles() || typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    const abortar = new AbortController();
    let reloj: ReturnType<typeof setTimeout>;
    // Espera a que no haya un diálogo abierto (captura, plan, editar perfil…).
    const mostrar = () => {
      if (document.querySelector('dialog[open]')) { reloj = setTimeout(mostrar, 2000); return; }
      establecerEstado({ tipo: 'pregunta' });
    };
    reloj = setTimeout(async () => {
      try {
        const [{ configurado }, activos] = await Promise.all([leerAvisos(abortar.signal), avisosActivos()]);
        if (!abortar.signal.aborted && configurado && !activos) mostrar();
      } catch { /* sin red o sin back: no se pregunta */ }
    }, 1500);
    return () => { abortar.abort(); clearTimeout(reloj); clearTimeout(cerrarReloj.current); };
  }, []);

  function cerrar() {
    marcar();
    establecerEstado({ tipo: 'oculta' });
  }

  function activar() {
    // iPhone: activarAvisos() tiene que ser lo PRIMERO del toque (sin await antes) o iOS no muestra el permiso.
    const resultado = activarAvisos();
    marcar();
    establecerEstado({ tipo: 'activando' });
    void resultado.then((r) => {
      if (r.ok) {
        establecerEstado({ tipo: 'listo' });
        cerrarReloj.current = setTimeout(() => establecerEstado({ tipo: 'oculta' }), 2000);
      } else {
        establecerEstado({ tipo: 'error', mensaje: r.mensaje });
      }
    }, () => establecerEstado({ tipo: 'error', mensaje: 'No se pudieron activar los avisos. Puedes hacerlo desde tu perfil.' }));
  }

  if (estado.tipo === 'oculta') return null;

  // Justo sobre la barra de navegación (alto 5.2em con su tamaño de letra proporcional); se esconde si se abre un diálogo.
  return <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 [body:has(dialog[open])_&]:hidden"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.2 * clamp(12px, 3.4vw, 15px) + 12px)' }}>
    <section role="dialog" aria-modal="false" aria-labelledby="burbuja-avisos" aria-live="polite"
      className="orbit-pop pointer-events-auto relative w-full max-w-md rounded-[26px] rounded-bl-md bg-white p-4 pr-3 shadow-[0_18px_40px_-18px_rgba(38,61,52,.45),inset_0_0_0_1px_#E3E8DE]">
      {estado.tipo === 'listo'
        ? <p role="status" className="orbit-aparece flex items-center gap-3 py-1 text-[15px] font-semibold text-[#1F5D50]">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#E3EEE6]">
            <svg viewBox="0 0 24 24" fill="none" stroke="#35695D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          Listo, te avisaremos
        </p>
        : <>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#234F45]"><Campana /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="burbuja-avisos" className="text-[15.5px] font-bold leading-snug text-[#263D34]">¿Te avisamos antes de estudiar?</h2>
              <p className="mt-1 text-[13px] leading-snug text-[#647168]">
                {estado.tipo === 'error' ? estado.mensaje : 'Orbit te avisa 15 min antes de cada bloque y la noche antes de una entrega. Nada más.'}
              </p>
            </div>
            <button type="button" onClick={cerrar} aria-label="Cerrar"
              className={'-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#A3ACA5] hover:text-[#647168] ' + foco}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1.5 pl-[52px]">
            {estado.tipo === 'error'
              ? <button type="button" onClick={cerrar} className={'min-h-11 rounded-full px-4 text-sm font-semibold text-[#35695D] hover:bg-[#EEF3EC] ' + foco}>Entendido</button>
              : <>
                <button type="button" onClick={activar} disabled={estado.tipo === 'activando'}
                  className={'min-h-11 rounded-full bg-[#35695D] px-5 text-sm font-semibold text-white hover:bg-[#2D5C51] disabled:opacity-70 ' + foco}>
                  {estado.tipo === 'activando' ? 'Activando…' : 'Activar avisos'}
                </button>
                <button type="button" onClick={cerrar} disabled={estado.tipo === 'activando'}
                  className={'min-h-11 rounded-full px-4 text-sm font-semibold text-[#647168] hover:bg-[#F1F5EF] ' + foco}>Ahora no</button>
              </>}
          </div>
        </>}
    </section>
  </div>;
}
