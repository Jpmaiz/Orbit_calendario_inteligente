'use client';
import { useState, useSyncExternalStore } from 'react';
import { esIPhone, estaInstalada, instalar, puedeInstalar, suscribirInstalacion } from './instalacion';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const nada = () => () => {};

/** Ícono de Compartir de Safari (cuadro con flecha hacia arriba). */
function Compartir() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline h-[15px] w-[15px] -translate-y-px">
    <path d="M12 3v12M8 7l4-4 4 4M7 11H5v10h14V11h-2" />
  </svg>;
}

/**
 * «Lleva Orbit a tu inicio» en el perfil. Chrome/Android: botón que abre el diálogo de instalar.
 * iPhone: los dos pasos de Safari. Ya instalada (o un navegador que no permite instalar): no aparece.
 */
export default function InstalarOrbit({ style }: { style?: React.CSSProperties }) {
  const instalada = useSyncExternalStore(suscribirInstalacion, estaInstalada, () => true);
  const disponible = useSyncExternalStore(suscribirInstalacion, puedeInstalar, () => false);
  const iphone = useSyncExternalStore(nada, esIPhone, () => false);
  const [lista, establecerLista] = useState(false);

  if (lista) return <p role="status" className="orbit-aparece col-span-2 px-2 text-center text-[13px] font-semibold text-[#35695D]">Listo: Orbit ya está en tu inicio.</p>;
  if (instalada || (!disponible && !iphone)) return null;

  return <section aria-labelledby="instalar-orbit" style={style}
    className="orbit-aparece col-span-2 flex items-center gap-3.5 rounded-[28px] bg-[#EEF3EC] p-[18px]">
    <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-[15px] bg-[#234F45] shadow-[0_6px_14px_-8px_rgba(35,79,69,.7)]">
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <circle cx="12" cy="12" r="7.5" stroke="#A9CDB9" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.4" fill="#fff" />
        <circle cx="17.3" cy="6.7" r="2" fill="#A9CDB9" />
      </svg>
    </span>
    <div className="min-w-0 flex-1">
      <h2 id="instalar-orbit" className="text-[15px] font-bold">Lleva Orbit a tu inicio</h2>
      {disponible
        ? <p className="mt-0.5 text-[13px] leading-snug text-[#647168]">Se abre al toque y funciona sin conexión.</p>
        : <p className="mt-0.5 text-[13px] leading-snug text-[#647168]">En Safari toca <span className="font-semibold text-[#35695D]"><Compartir /> Compartir</span> y luego <span className="font-semibold text-[#263D34]">«Agregar a inicio»</span>.</p>}
    </div>
    {disponible && <button type="button" onClick={async () => { if (await instalar()) establecerLista(true); }}
      className={'min-h-11 shrink-0 rounded-full bg-[#35695D] px-4 text-[13.5px] font-semibold text-white hover:bg-[#2D5C51] ' + foco}>Instalar</button>}
  </section>;
}
