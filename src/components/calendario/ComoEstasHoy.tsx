'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { diaEnBolivia, sumarDias } from './organizarTareasDia';
import { enviarAnimo, leerAnimo, reacomodar, type EstadoAnimo, type PropuestaAnimo, type SugerenciaAnimo } from './contratoAnimo';
import { guardarRitmo, type CambioRitmo } from '../perfil/contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const zona = 'America/La_Paz';
const formatoHora = new Intl.DateTimeFormat('es-BO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'short', day: 'numeric' });

const OPCIONES: { estado: EstadoAnimo; texto: string; icono: ReactNode }[] = [
  { estado: 'energia', texto: 'Con energía', icono: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" /> },
  { estado: 'normal', texto: 'Normal', icono: <><circle cx="12" cy="12" r="8" /><path d="M8.5 14.5h7" /></> },
  { estado: 'cansado', texto: 'Cansado', icono: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /> },
];

/** «hoy 16:00», «mañana 10:00», «jue 26 18:30». */
function cuando(fecha: Date, hoy: string) {
  const dia = diaEnBolivia(fecha);
  const nombre = dia === hoy ? 'hoy' : dia === sumarDias(hoy, 1) ? 'mañana' : formatoDia.format(fecha).replace(/[.,]/g, '');
  return `${nombre} ${formatoHora.format(fecha)}`;
}

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'pensando'; estado: EstadoAnimo }
  | { tipo: 'propuesta'; propuesta: PropuestaAnimo }
  | { tipo: 'aplicando'; propuesta: PropuestaAnimo }
  | { tipo: 'listo'; texto: string };

/**
 * «¿Cómo estás hoy?» arriba de Tu día. Tres botones opcionales: sin respuesta no insiste ni avisa.
 * Al elegir, Orbit propone cambios (de → a) y nada se mueve hasta que el usuario toca «Aplicar».
 */
export default function ComoEstasHoy({ fechaActual }: { fechaActual: string }) {
  const hoy = diaEnBolivia(new Date(fechaActual));
  const [elegido, establecerElegido] = useState<EstadoAnimo | null>(null);
  const [sugerencia, establecerSugerencia] = useState<SugerenciaAnimo>(null);
  const [paso, establecerPaso] = useState<Paso>({ tipo: 'elegir' });
  const [error, establecerError] = useState<string | null>(null);

  useEffect(() => {
    const abortar = new AbortController();
    leerAnimo(abortar.signal).then((d) => { establecerElegido(d.hoy); establecerSugerencia(d.sugerencia); }).catch(() => {});
    return () => abortar.abort();
  }, []);

  async function elegir(estado: EstadoAnimo) {
    establecerElegido(estado);
    establecerError(null);
    establecerPaso({ tipo: 'pensando', estado });
    try {
      const propuesta = await enviarAnimo(estado);
      establecerPaso(propuesta.cambios.length || propuesta.mensaje ? { tipo: 'propuesta', propuesta } : { tipo: 'elegir' });
    } catch (e) {
      establecerError(e instanceof Error ? e.message : 'No se pudo guardar.');
      establecerPaso({ tipo: 'elegir' });
    }
  }

  async function aplicar(propuesta: PropuestaAnimo) {
    establecerPaso({ tipo: 'aplicando', propuesta });
    establecerError(null);
    try {
      await reacomodar(propuesta.cambios);
      establecerPaso({ tipo: 'listo', texto: propuesta.cambios.length === 1 ? 'Listo: moví 1 bloque de estudio.' : `Listo: moví ${propuesta.cambios.length} bloques de estudio.` });
    } catch (e) {
      establecerError(e instanceof Error ? e.message : 'No se pudo reacomodar.');
      establecerPaso({ tipo: 'propuesta', propuesta });
    }
  }

  async function aceptarSugerencia(cambio: Record<string, unknown>) {
    establecerSugerencia(null);
    try { await guardarRitmo(cambio as CambioRitmo); } catch { /* si falla, no insiste */ }
  }

  const propuesta = paso.tipo === 'propuesta' || paso.tipo === 'aplicando' ? paso.propuesta : null;
  const pensando = paso.tipo === 'pensando' || paso.tipo === 'aplicando';

  return <section aria-labelledby="como-estas" className="orbit-aparece flex flex-col gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_#E3E8DE]">
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="como-estas" className="text-[15px] font-bold">¿Cómo estás hoy?</h2>
      <span className="text-xs text-[#8A958D]">opcional</span>
    </div>
    <div role="radiogroup" aria-label="¿Cómo estás hoy?" className="grid grid-cols-3 gap-2">
      {OPCIONES.map((o) => {
        const marcado = elegido === o.estado;
        return <button key={o.estado} type="button" role="radio" aria-checked={marcado} disabled={pensando} onClick={() => elegir(o.estado)}
          className={'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl text-[13px] font-semibold transition-colors disabled:opacity-70 ' + foco + ' ' +
            (marcado ? 'bg-[#E3EEE6] text-[#1F5D50] shadow-[inset_0_0_0_1.5px_#35695D]' : 'bg-[#F6F8F3] text-[#4C5A51] hover:bg-[#EEF3EC]')}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{o.icono}</svg>
          {o.texto}
        </button>;
      })}
    </div>

    {paso.tipo === 'pensando' && <p role="status" className="text-[13px] text-[#647168]">Revisando tu día…</p>}
    {error && <p role="status" className="text-[13px] text-[#647168]">{error}</p>}

    {propuesta && <div className="orbit-aparece flex flex-col gap-2.5 rounded-[18px] bg-[#F1F6F2] p-3.5">
      {propuesta.mensaje && <p className="text-sm leading-relaxed">{propuesta.mensaje}</p>}
      {propuesta.cambios.length > 0 && <ul className="space-y-2">
        {propuesta.cambios.map((c, i) => <li key={c.id} className="orbit-aparece rounded-xl bg-white px-3 py-2.5 shadow-[inset_0_0_0_1px_#E3E8DE]" style={{ ['--i' as string]: i } as CSSProperties}>
          <p className="text-sm font-semibold">{c.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] tabular-nums">
            <span className="text-[#8A958D] line-through decoration-[#C2CAC4]">{cuando(c.de.inicio, hoy)}</span>
            <span aria-hidden="true" className="text-[#35695D]">→</span>
            <span className="sr-only">pasa a</span>
            <span className="font-semibold text-[#1F5D50]">{cuando(c.a.inicio, hoy)}–{formatoHora.format(c.a.fin)}</span>
          </p>
          {c.razon && <p className="mt-0.5 text-xs text-[#647168]">{c.razon}</p>}
        </li>)}
      </ul>}
      <div className="flex items-center gap-1.5">
        {propuesta.cambios.length > 0
          ? <>
            <button type="button" disabled={pensando} onClick={() => aplicar(propuesta)}
              className={'min-h-11 rounded-full bg-[#35695D] px-5 text-sm font-semibold text-white hover:bg-[#2D5C51] disabled:opacity-70 ' + foco}>{paso.tipo === 'aplicando' ? 'Moviendo…' : 'Aplicar'}</button>
            <button type="button" disabled={pensando} onClick={() => establecerPaso({ tipo: 'elegir' })}
              className={'min-h-11 rounded-full px-3 text-sm font-semibold text-[#647168] ' + foco}>Dejar como está</button>
          </>
          : <button type="button" onClick={() => establecerPaso({ tipo: 'elegir' })}
            className={'min-h-10 rounded-full px-3 text-sm font-semibold text-[#35695D] ' + foco}>Entendido</button>}
      </div>
    </div>}

    {paso.tipo === 'listo' && <p role="status" className="orbit-aparece text-[13px] font-semibold text-[#1F5D50]">{paso.texto}</p>}

    {sugerencia && paso.tipo === 'elegir' && <div className="orbit-aparece flex flex-col gap-2 rounded-[18px] bg-[#FCF2DE] p-3.5">
      <p className="text-sm leading-relaxed text-[#4A3810]">{sugerencia.texto}</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => aceptarSugerencia(sugerencia.cambio)}
          className={'min-h-10 rounded-full bg-[#4A3810] px-5 text-[13.5px] font-semibold text-white ' + foco}>Sí</button>
        <button type="button" onClick={() => establecerSugerencia(null)} className={'min-h-10 rounded-full px-3 text-[13.5px] font-semibold text-[#7A5A1C] ' + foco}>No</button>
      </div>
    </div>}
  </section>;
}
