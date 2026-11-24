'use client';

import { useEffect, useState } from 'react';
import { Icono } from './ComoEstasHoy';
import { ANIMO_ELEGIDO, leerAnimo, NOMBRE_ANIMO, pedirCambioAnimo, type EstadoAnimo } from './contratoAnimo';

/** Junto a la fecha del saludo: «· ⚡ a full». Tocarlo vuelve a abrir «¿Cómo vienes hoy?». */
export default function InsigniaAnimo() {
  const [estado, establecerEstado] = useState<EstadoAnimo | null>(null);

  useEffect(() => {
    const abortar = new AbortController();
    leerAnimo(abortar.signal).then((d) => establecerEstado((actual) => actual ?? d.hoy)).catch(() => {});
    const elegido = (e: Event) => establecerEstado((e as CustomEvent<EstadoAnimo>).detail);
    window.addEventListener(ANIMO_ELEGIDO, elegido);
    return () => { abortar.abort(); window.removeEventListener(ANIMO_ELEGIDO, elegido); };
  }, []);

  if (!estado) return null;
  return <button type="button" onClick={pedirCambioAnimo} aria-label={`Hoy vienes: ${NOMBRE_ANIMO[estado]}. Cambiar`}
    className="orbit-pop -my-3 ml-1.5 inline-flex items-center gap-1 rounded-full py-3 align-middle text-[#35695D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">
    <span aria-hidden="true" className="text-[#C2CAC4]">·</span>
    <Icono estado={estado} tam={13} />
    {NOMBRE_ANIMO[estado]}
  </button>;
}
