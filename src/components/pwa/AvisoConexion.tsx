'use client';
import { useEffect, useState } from 'react';
import { useEnLinea } from './useEnLinea';
import './instalacion'; // capta «beforeinstallprompt» apenas carga la app (lo usa el perfil)

/** Órbita en pausa: anillo punteado y satélite que respira. Al volver la conexión, el anillo se cierra. */
function Orbita({ enLinea }: { enLinea: boolean }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
    <circle cx="12" cy="12" r="8" stroke={enLinea ? '#35695D' : '#B4C0B7'} strokeWidth="1.8" strokeDasharray={enLinea ? undefined : '2.2 3.2'} strokeLinecap="round" />
    <circle cx="12" cy="12" r="2.2" fill={enLinea ? '#35695D' : '#8A958D'} />
    <circle cx="17.7" cy="6.3" r="2.4" fill={enLinea ? '#35695D' : '#8A958D'} className={enLinea ? 'orbit-pop' : 'orbit-respira'} />
  </svg>;
}

/**
 * Franja tranquila arriba de todo (en el flujo, no encima): empuja el contenido en vez de taparlo.
 * Sin conexión: «Sin conexión · ves lo último guardado». Al volver: «De vuelta en línea» unos segundos y se pliega.
 */
export default function AvisoConexion() {
  const enLinea = useEnLinea();
  const [visto, establecerVisto] = useState(enLinea);
  const [volvio, establecerVolvio] = useState(false);
  if (visto !== enLinea) {
    establecerVisto(enLinea);
    establecerVolvio(enLinea);
  }

  useEffect(() => {
    if (!volvio) return;
    const t = setTimeout(() => establecerVolvio(false), 2600);
    return () => clearTimeout(t);
  }, [volvio]);

  const abierto = !enLinea || volvio;
  return (
    <div aria-hidden={!abierto} style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
      className="order-first grid bg-[#F6F7F2] transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none">
      <div className="min-h-0 overflow-hidden">
        <div className="flex justify-center px-4 pb-1 pt-[calc(env(safe-area-inset-top)+10px)]">
          <p role="status" aria-live="polite"
            className={'inline-flex min-h-9 items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-[13px] transition-colors duration-500 ' +
              (enLinea ? 'bg-[#E3EEE6] text-[#1F5D50]' : 'bg-[#ECF0EA] text-[#647168]')}>
            <Orbita enLinea={enLinea} />
            {enLinea
              ? <span className="font-semibold">De vuelta en línea</span>
              : <span><span className="font-semibold text-[#263D34]">Sin conexión</span> · ves lo último guardado</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
