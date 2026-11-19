'use client';

import { useEffect, useState } from 'react';
import { ANGULO_LOGO, aristasDodecaedro, facetasDodecaedro } from './geometriaDodecaedro';

const VUELTA = 2 * Math.PI;

/**
 * Logo de Orbit: dodecaedro de alambre (solo aristas, color del texto: `currentColor`): contorno firme,
 * aristas interiores que se apagan al ponerse de canto y las de atrás tenues.
 * Con `relleno`, la versión de facetas verdes (favicon e ícono para instalar).
 * Con `girando` da vueltas lentas (una cada 18 s); con `rapido`, una cada 3 s.
 * Se queda quieto con «reducir movimiento» o con la pestaña oculta.
 * `grosor`: trazo de las aristas en un lienzo de 100 (5 para íconos de 24–32 px; 2,2 en tamaños grandes).
 */
export default function Dodecaedro({ className = 'h-6 w-6', girando = false, rapido = false, relleno = false, grosor = 5, titulo }: {
  className?: string; girando?: boolean; rapido?: boolean; relleno?: boolean; grosor?: number; titulo?: string;
}) {
  const [angulo, establecerAngulo] = useState(ANGULO_LOGO);

  useEffect(() => {
    if (!girando) return;
    const velocidad = VUELTA / (rapido ? 3000 : 18000);
    let cuadro = 0, previo: number | null = null, acumulado = 0;
    const paso = (t: number) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (previo !== null && !document.hidden) {
        acumulado += Math.min(t - previo, 100);
        // ~30 cuadros por segundo alcanzan para un ícono y gastan la mitad.
        if (acumulado >= 33) {
          const avance = velocidad * acumulado;
          establecerAngulo((a) => (a + avance) % VUELTA);
          acumulado = 0;
        }
      }
      previo = t;
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [girando, rapido]);

  return (
    <svg viewBox="0 0 100 100" className={className} shapeRendering="geometricPrecision"
      {...(titulo ? { role: 'img', 'aria-label': titulo } : { 'aria-hidden': true })}>
      {relleno
        ? facetasDodecaedro(angulo).map((cara, i) => <polygon key={i} points={cara.puntos} fill={cara.color}
          stroke={cara.borde} strokeWidth={grosor * 0.6} strokeLinejoin="round" />)
        : aristasDodecaedro(angulo).map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="currentColor" strokeWidth={grosor * (0.55 + 0.45 * l.peso)} strokeOpacity={0.26 + 0.74 * l.peso} strokeLinecap="round" />)}
    </svg>
  );
}
