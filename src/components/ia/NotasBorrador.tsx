'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CATEGORIAS_NOTA, leerNotasIA, type CategoriaNota, type Nota } from './borradorCaptura';

const NOMBRES: Record<CategoriaNota, string> = {
  llevar: 'Llevar', temas: 'Temas', bibliografia: 'Bibliografía', duracion: 'Duración', otros: 'Otros',
};
const clave = (n: Nota) => n.categoria + '|' + n.texto.toLowerCase();
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';

/** Agrega sin repetir y respeta el orden de categorías del back. */
export function unirNotas(actuales: Nota[], nuevas: Nota[]): Nota[] {
  const vistas = new Set(actuales.map(clave));
  const todas = [...actuales];
  for (const nota of nuevas) if (!vistas.has(clave(nota))) { vistas.add(clave(nota)); todas.push(nota); }
  return todas.sort((a, b) => CATEGORIAS_NOTA.indexOf(a.categoria) - CATEGORIAS_NOTA.indexOf(b.categoria));
}

/**
 * Notas de la tarjeta: lo que Orbit leyó del mensaje (solo lectura, se puede quitar) y "Añade algo más",
 * que la IA reparte en las mismas categorías (POST /api/ia/notas; no guarda nada hasta confirmar).
 */
export default function NotasBorrador({ notas, cambiar, titulo, deIA }: {
  notas: Nota[]; cambiar: (notas: Nota[]) => void; titulo: string; deIA: boolean;
}) {
  const id = useId();
  const [texto, establecerTexto] = useState('');
  const [pendiente, establecerPendiente] = useState<string | null>(null);
  const [estado, establecerEstado] = useState<'listo' | 'tal-cual' | null>(null);
  const [nuevas, establecerNuevas] = useState<Set<string>>(() => new Set());
  // La respuesta llega 1–3 s después: se une con las notas de ese momento, no con las del clic.
  const ultimas = useRef(notas);
  const cambiarActual = useRef(cambiar);
  useEffect(() => { ultimas.current = notas; cambiarActual.current = cambiar; });
  useEffect(() => {
    if (!nuevas.size) return;
    const t = setTimeout(() => establecerNuevas(new Set()), 2200);
    return () => clearTimeout(t);
  }, [nuevas]);

  async function enviar() {
    const escrito = texto.trim();
    if (!escrito || pendiente) return;
    establecerPendiente(escrito);
    establecerTexto('');
    establecerEstado(null);
    let recibidas: Nota[] = [];
    let conIA = false;
    try {
      const respuesta = await fetch('/api/ia/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: escrito.slice(0, 500), ...(titulo.trim() ? { titulo: titulo.trim() } : {}) }),
      });
      const datos: unknown = await respuesta.json().catch(() => null);
      if (respuesta.ok) {
        recibidas = leerNotasIA(datos);
        conIA = (datos as { ia?: unknown } | null)?.ia === true;
      }
    } catch { /* Sin red: se agrega tal cual. */ }
    if (!recibidas.length) recibidas = [{ categoria: 'otros', texto: escrito }];
    cambiarActual.current(unirNotas(ultimas.current, recibidas));
    establecerNuevas(new Set(recibidas.map(clave)));
    establecerPendiente(null);
    establecerEstado(conIA ? 'listo' : 'tal-cual');
  }

  const grupos = CATEGORIAS_NOTA.map((categoria) => ({ categoria, notas: notas.filter((n) => n.categoria === categoria) }))
    .filter((g) => g.notas.length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#647168]">Notas</p>
          {deIA && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#35695D]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" /></svg>
            Orbit las sacó de tu mensaje
          </span>}
        </div>
        <div className="space-y-3 rounded-xl border border-[#E3E8DE] bg-white p-3">
          {grupos.map((g) => <div key={g.categoria} className="space-y-1.5">
            <p className="text-xs font-semibold text-[#263D34]">{NOMBRES[g.categoria]}</p>
            <ul className="flex flex-wrap gap-1.5">
              {g.notas.map((nota) => <li key={clave(nota)}
                className={'orbit-aparece inline-flex min-h-8 max-w-full items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-0.5 text-[13px] transition-colors '
                  + (nuevas.has(clave(nota)) ? 'border-[#BFE5D0] bg-[#E7F8EF] text-[#1F5D50]' : 'border-[#E3E8DE] bg-[#F4F6F1] text-[#263D34]')}>
                <span className="min-w-0">{nota.texto}</span>
                <button type="button" aria-label={`Quitar «${nota.texto}»`} onClick={() => cambiar(notas.filter((n) => clave(n) !== clave(nota)))}
                  className={"relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#647168] before:absolute before:-inset-2 before:content-[''] hover:bg-[#E3E8DE] hover:text-[#263D34] " + foco}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </li>)}
            </ul>
          </div>)}
          {pendiente && <p className="flex items-center gap-2 text-[13px] text-[#8A958D]">
            <span aria-hidden="true" className="orbit-gira h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#9AA59D] border-r-transparent" />
            «{pendiente}»
          </p>}
          {!grupos.length && !pendiente && <p className="text-[13px] text-[#647168]">{deIA ? 'Quitaste todas las notas.' : 'Orbit no encontró notas en tu mensaje.'}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id + '-nota'} className="text-xs font-medium text-[#647168]">Añade algo más</label>
        <div className="flex items-center gap-2 rounded-xl border border-[#E3E8DE] bg-white py-1 pl-3 pr-1 transition-colors focus-within:border-[#28746B]">
          <input id={id + '-nota'} type="text" value={texto} maxLength={500} autoComplete="off"
            onChange={(e) => establecerTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void enviar(); } }}
            placeholder="Ej.: repasar UML y llevar el USB"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-[#263D34] outline-none placeholder:text-[#9AA59D]" />
          <button type="button" aria-label="Añadir" disabled={!texto.trim() || !!pendiente} onClick={() => void enviar()}
            className={'grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#35695D] text-white transition-colors disabled:bg-[#EEF1EA] disabled:text-[#8A958D] ' + foco}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
        <p aria-live="polite" className={'text-xs ' + (estado === 'listo' ? 'text-[#1F5D50]' : 'text-[#647168]')}>
          {pendiente ? 'Orbit lo está leyendo…' : estado === 'listo' ? 'Listo, Orbit lo ordenó arriba.'
            : estado === 'tal-cual' ? 'Lo agregué tal cual en «Otros».' : 'Escríbelo como quieras. Orbit lo ordena.'}
        </p>
      </div>
    </div>
  );
}
