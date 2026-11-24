'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { diaEnBolivia, sumarDias } from './organizarTareasDia';
import { ANIMO_CAMBIAR, avisarAnimo, enviarAnimo, leerAnimo, NOMBRE_ANIMO, reacomodar, type CambioBloque, type EstadoAnimo, type SugerenciaAnimo } from './contratoAnimo';
import { guardarRitmo, type CambioRitmo } from '../perfil/contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const zona = 'America/La_Paz';
const formatoHora = new Intl.DateTimeFormat('es-BO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'short', day: 'numeric' });

export const ICONOS_ANIMO: Record<EstadoAnimo, ReactNode> = {
  energia: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />,
  normal: <><circle cx="12" cy="12" r="8" /><path d="M8.5 14.5h7" /></>,
  cansado: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
};
const OPCIONES = (['energia', 'normal', 'cansado'] as const).map((estado) => ({ estado, texto: NOMBRE_ANIMO[estado], icono: ICONOS_ANIMO[estado] }));

export function Icono({ estado, tam = 20 }: { estado: EstadoAnimo; tam?: number }) {
  return <svg aria-hidden="true" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {OPCIONES.find((o) => o.estado === estado)?.icono}
  </svg>;
}

/** «hoy 16:00», «mañana 10:00», «jue 26 18:30». */
function cuando(fecha: Date, hoy: string) {
  const dia = diaEnBolivia(fecha);
  const nombre = dia === hoy ? '' : dia === sumarDias(hoy, 1) ? 'mañana ' : formatoDia.format(fecha).replace(/[.,]/g, '') + ' ';
  return nombre + formatoHora.format(fecha);
}

type Paso =
  | { tipo: 'preguntar' }
  | { tipo: 'pensando'; estado: EstadoAnimo }
  | { tipo: 'respuesta'; texto: string; cambios: CambioBloque[] }
  | { tipo: 'cerrado' };

/**
 * «¿Cómo estás hoy?» como una burbuja de una línea arriba de Tu día.
 * Un toque y listo: Orbit acomoda solo y deja «Deshacer» unos segundos. Después desaparece:
 * lo elegido queda junto a la fecha del saludo (InsigniaAnimo), y tocarlo vuelve a abrir la burbuja.
 */
export default function ComoEstasHoy({ fechaActual }: { fechaActual: string }) {
  const hoy = diaEnBolivia(new Date(fechaActual));
  const [elegido, establecerElegido] = useState<EstadoAnimo | null>(null);
  const [sugerencia, establecerSugerencia] = useState<SugerenciaAnimo>(null);
  const [paso, establecerPaso] = useState<Paso>({ tipo: 'preguntar' });
  const [listo, establecerListo] = useState(false);

  useEffect(() => {
    const abortar = new AbortController();
    leerAnimo(abortar.signal).then((d) => {
      establecerElegido(d.hoy);
      establecerSugerencia(d.sugerencia);
      if (d.hoy) establecerPaso({ tipo: 'cerrado' });
    }).catch(() => {}).finally(() => establecerListo(true));
    const reabrir = () => establecerPaso({ tipo: 'preguntar' });
    window.addEventListener(ANIMO_CAMBIAR, reabrir);
    return () => { abortar.abort(); window.removeEventListener(ANIMO_CAMBIAR, reabrir); };
  }, []);

  // La respuesta se cierra sola: corta si no movió nada, un poco más si hay «Deshacer».
  useEffect(() => {
    if (paso.tipo !== 'respuesta') return;
    const t = setTimeout(() => establecerPaso({ tipo: 'cerrado' }), paso.cambios.length ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [paso]);

  async function elegir(estado: EstadoAnimo) {
    const anterior = elegido;
    establecerElegido(estado);
    establecerPaso({ tipo: 'pensando', estado });
    try {
      const { cambios, mensaje } = await enviarAnimo(estado);
      if (cambios.length) await reacomodar(cambios);
      avisarAnimo(estado);
      const texto = cambios.length === 1
        ? (estado === 'cansado' ? `Te alivié el día: ${cambios[0].titulo} pasa a las ${cuando(cambios[0].a.inicio, hoy)}.` : `Aprovechemos: ${cambios[0].titulo} sube a las ${cuando(cambios[0].a.inicio, hoy)}.`)
        : cambios.length > 1 ? (estado === 'cansado' ? `Te alivié el día: moví ${cambios.length} bloques.` : `Aprovechemos: adelanté ${cambios.length} bloques.`)
          : estado === 'normal' ? 'Perfecto, seguimos con el plan.'
            : estado === 'energia' ? '¡Bien! Hoy no hay nada que adelantar.' : mensaje ?? 'Tranqui, hoy no hay estudio que mover.';
      establecerPaso({ tipo: 'respuesta', texto, cambios });
    } catch (e) {
      establecerElegido(anterior);
      establecerPaso({ tipo: 'respuesta', texto: e instanceof Error ? e.message : 'No se pudo guardar.', cambios: [] });
    }
  }

  async function deshacer(cambios: CambioBloque[]) {
    establecerPaso({ tipo: 'pensando', estado: elegido ?? 'normal' });
    try {
      await reacomodar(cambios.map((c) => ({ ...c, a: c.de })));
      establecerPaso({ tipo: 'respuesta', texto: 'Hecho, todo volvió a su lugar.', cambios: [] });
    } catch {
      establecerPaso({ tipo: 'respuesta', texto: 'No se pudo deshacer. Inténtalo de nuevo.', cambios });
    }
  }

  async function aceptarSugerencia(cambio: Record<string, unknown>) {
    establecerSugerencia(null);
    try { await guardarRitmo(cambio as CambioRitmo); } catch { /* si falla, no insiste */ }
  }

  if (!listo) return null;

  // Cerrado: nada en el flujo (lo elegido vive junto a la fecha). Solo la sugerencia, si hay.
  if (paso.tipo === 'cerrado') {
    return sugerencia ? <Sugerencia sugerencia={sugerencia} aceptar={aceptarSugerencia} cerrar={() => establecerSugerencia(null)} /> : null;
  }

  return <div className="flex flex-col items-start gap-2">
    <div className="orbit-pop flex w-full items-center gap-2 rounded-[22px] rounded-tl-md bg-white py-1.5 pl-4 pr-1.5 shadow-[0_6px_18px_-10px_rgba(38,61,52,.35),inset_0_0_0_1px_#E3E8DE]" aria-live="polite">
      {paso.tipo === 'respuesta'
        ? <>
          <p className="orbit-aparece min-w-0 flex-1 text-[13.5px] leading-snug text-[#263D34]">{paso.texto}</p>
          {paso.cambios.length > 0
            ? <button type="button" onClick={() => deshacer(paso.cambios)} className={'min-h-11 shrink-0 rounded-full px-3.5 text-[13px] font-semibold text-[#35695D] hover:bg-[#EEF3EC] ' + foco}>Deshacer</button>
            : <button type="button" onClick={() => establecerPaso({ tipo: 'cerrado' })} aria-label="Cerrar" className={'grid size-11 shrink-0 place-items-center rounded-full text-[#8A958D] ' + foco}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>}
        </>
        : <>
          <p id="como-estas" className="min-w-0 flex-1 text-[14px] font-semibold text-[#263D34]">
            {paso.tipo === 'pensando' ? 'Acomodando tu día…' : '¿Cómo vienes hoy?'}
          </p>
          <div role="radiogroup" aria-labelledby="como-estas" className="flex shrink-0 gap-1">
            {OPCIONES.map((o) => {
              const marcado = elegido === o.estado;
              const cargando = paso.tipo === 'pensando' && paso.estado === o.estado;
              return <button key={o.estado} type="button" role="radio" aria-checked={marcado} aria-label={o.texto} title={o.texto}
                disabled={paso.tipo === 'pensando'} onClick={() => elegir(o.estado)}
                className={'grid size-11 place-items-center rounded-full transition-colors disabled:opacity-60 ' + foco + ' ' +
                  (marcado ? 'bg-[#35695D] text-white' : 'bg-[#F1F5EF] text-[#35695D] hover:bg-[#E3EEE6]') + (cargando ? ' animate-pulse' : '')}>
                <Icono estado={o.estado} />
              </button>;
            })}
          </div>
          {paso.tipo === 'preguntar' && !elegido && <button type="button" onClick={() => establecerPaso({ tipo: 'cerrado' })} aria-label="Ahora no"
            className={'grid size-8 shrink-0 place-items-center rounded-full text-[#A3ACA5] hover:text-[#647168] ' + foco}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>}
        </>}
    </div>
  </div>;
}

function Sugerencia({ sugerencia, aceptar, cerrar }: { sugerencia: NonNullable<SugerenciaAnimo>; aceptar: (c: Record<string, unknown>) => void; cerrar: () => void }) {
  return <div className="orbit-pop flex w-full items-center gap-2 rounded-[22px] rounded-tl-md bg-[#FCF2DE] py-1.5 pl-4 pr-1.5">
    <p className="min-w-0 flex-1 text-[13px] leading-snug text-[#4A3810]">{sugerencia.texto}</p>
    <button type="button" onClick={() => aceptar(sugerencia.cambio)} className={'min-h-11 shrink-0 rounded-full bg-[#4A3810] px-4 text-[13px] font-semibold text-white ' + foco}>Sí</button>
    <button type="button" onClick={cerrar} className={'min-h-11 shrink-0 rounded-full px-2.5 text-[13px] font-semibold text-[#7A5A1C] ' + foco}>No</button>
  </div>;
}
