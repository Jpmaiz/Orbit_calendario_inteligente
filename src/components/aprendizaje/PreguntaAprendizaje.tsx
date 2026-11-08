'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ESTADO_INICIAL, obtenerSesionPregunta, type RespuestaPregunta } from './preguntaFrontend';

const textos: Record<RespuestaPregunta, string> = {
  menos: 'Me tomó menos', justo: 'Estuvo bien', mas: 'Me tomó más',
};
const snapshotServidor = () => ESTADO_INICIAL;

export default function PreguntaAprendizaje({ claveConsulta }: { claveConsulta: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const sesion = useMemo(() => obtenerSesionPregunta(claveConsulta), [claveConsulta]);
  const estado = useSyncExternalStore(sesion.subscribe, sesion.getSnapshot, snapshotServidor);
  const puedeConsultar = useRef<() => boolean>(() => false);

  useEffect(() => {
    const nodo = raiz.current;
    if (!nodo) return;
    let frame = 0;
    const visible = () => {
      if (document.visibilityState !== 'visible' || window.location.pathname !== '/dia' ||
          document.querySelector('dialog[open]') || !nodo.getClientRects().length) return false;
      const estilo = window.getComputedStyle(nodo);
      const rect = nodo.getBoundingClientRect();
      return estilo.visibility !== 'hidden' && estilo.display !== 'none' && estilo.opacity !== '0' &&
        rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    };
    puedeConsultar.current = visible;
    const preparar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (visible()) void sesion.consultar(); });
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(preparar);
    observer?.observe(nodo);
    document.addEventListener('visibilitychange', preparar);
    document.addEventListener('close', preparar, true);
    window.addEventListener('resize', preparar);
    window.addEventListener('scroll', preparar, { passive: true });
    preparar();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', preparar);
      document.removeEventListener('close', preparar, true);
      window.removeEventListener('resize', preparar);
      window.removeEventListener('scroll', preparar);
      puedeConsultar.current = () => false;
    };
  }, [sesion]);

  const pregunta = estado.pregunta;
  return <div ref={raiz} className="min-h-px">
    {!estado.terminada && (pregunta || estado.error) && <aside aria-label="Pregunta de la semana" aria-busy={estado.enviando}
      className="space-y-3 rounded-2xl border border-[#E3E8DE] bg-[#FAFBF7] p-4 text-[#263D34]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{pregunta?.titulo ?? 'Pregunta de la semana'}</h2>
          {pregunta && <p className="mt-1 text-sm leading-6 text-[#647168]">{pregunta.texto}</p>}
        </div>
        <button type="button" aria-label="Cerrar pregunta de la semana" disabled={estado.enviando}
          onClick={() => sesion.cerrar()}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-sm text-[#647168] hover:bg-[#EDF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] disabled:opacity-50">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {pregunta && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {pregunta.opciones.map((opcion) => <button key={opcion} type="button" disabled={estado.enviando}
          aria-pressed={estado.seleccion === opcion} onClick={() => void sesion.responder(opcion)}
          className={'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] disabled:cursor-wait disabled:opacity-50 ' +
            (estado.seleccion === opcion ? 'border-[#35695D] bg-[#EDF4E8] text-[#245B4C]' : 'border-[#CEDFD5] bg-white text-[#35695D] hover:bg-[#EDF4E8]')}>
          {textos[opcion]}
        </button>)}
      </div>}
      {estado.enviando && <p role="status" className="text-xs text-[#647168]">Guardando tu respuesta…</p>}
      {estado.error && <div role="alert" className="space-y-1 text-xs text-[#A34955]">
        <p>{estado.error}</p>
        <button type="button" disabled={estado.enviando || estado.consultando}
          className="min-h-11 rounded-lg px-2 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] disabled:opacity-50"
          onClick={() => {
            if (pregunta && estado.seleccion) void sesion.responder(estado.seleccion);
            else if (puedeConsultar.current()) void sesion.consultar(true);
          }}>Reintentar</button>
      </div>}
    </aside>}
  </div>;
}
