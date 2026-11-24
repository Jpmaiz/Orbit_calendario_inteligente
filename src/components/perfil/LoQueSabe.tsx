'use client';

import { useState, type CSSProperties } from 'react';
import Dodecaedro from '../marca/Dodecaedro';
import { leerAprendizaje, olvidarAprendizaje } from './contratoPerfil';
import { useConsulta } from './useConsulta';
import CargaFallida from '../pwa/CargaFallida';
import { useEnLinea } from '../pwa/useEnLinea';
import { mensajeError } from '../pwa/errorRed';

const paso = (i: number) => ({ '--i': i }) as CSSProperties;
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';

/** Un ícono suave según de qué habla la frase (las frases ya vienen redactadas por el back: no se tocan). */
function IconoFrase({ frase, conociendo }: { frase: string; conociendo: boolean }) {
  const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (conociendo) return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...trazo}><path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7ZM12 14c0-3-2.5-5-6.5-5 0 4 2.5 5 6.5 5Z" /></svg>;
  if (/noche/i.test(frase)) return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...trazo}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>;
  if (/mañana|tarde/i.test(frase)) return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...trazo}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" {...trazo}><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9" /></svg>;
}

/** «Lo que Orbit sabe de ti»: lo aprendido en palabras, sin números, y «Empezar de cero». */
export default function LoQueSabe() {
  const { carga, recargar } = useConsulta('/api/perfil/aprendizaje', leerAprendizaje);
  const [estado, establecerEstado] = useState<'nada' | 'confirmar' | 'borrando' | 'listo'>('nada');
  const [error, establecerError] = useState<string | null>(null);
  const datos = carga?.datos;
  const enLinea = useEnLinea();

  async function olvidar() {
    establecerEstado('borrando');
    establecerError(null);
    try {
      await olvidarAprendizaje();
      establecerEstado('listo');
      recargar();
    } catch (e) {
      establecerEstado('confirmar');
      establecerError(mensajeError(e, 'No pude borrar lo aprendido.'));
    }
  }

  return <section aria-labelledby="perfil-sabe" className="orbit-aparece relative col-span-2 flex flex-col gap-3 overflow-hidden rounded-[28px] p-[18px] shadow-[inset_0_0_0_1px_#DFE9E1]"
    style={{ ...paso(4), background: 'linear-gradient(160deg, #EEF5EF, #F8FAF6 70%)' }}>
    <span aria-hidden="true" className="pointer-events-none absolute -right-3.5 -top-3.5 text-[#9CC3AE] opacity-55">
      <Dodecaedro className="h-[120px] w-[120px]" girando grosor={2.6} />
    </span>
    <h2 id="perfil-sabe" className="relative text-base font-bold">Lo que Orbit sabe de ti</h2>

    {!carga && <p role="status" className="relative text-sm text-[#647168]">Cargando…</p>}
    {carga?.error && <CargaFallida texto="No pude cargar lo que Orbit aprendió." recargar={recargar} className="relative" />}

    {datos && <ul className="relative space-y-2">
      {datos.frases.map((frase, i) => <li key={frase} className="orbit-aparece flex items-start gap-3 rounded-2xl bg-white/80 p-3 shadow-[0_1px_2px_rgba(35,79,69,.05)]" style={paso(i + 1)}>
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF1EC] text-[#35695D]"><IconoFrase frase={frase} conociendo={datos.conociendo} /></span>
        <p className="text-sm leading-relaxed text-[#263D34]">{frase}</p>
      </li>)}
    </ul>}

    {datos && !datos.conociendo && estado !== 'listo' && <div className="relative flex items-center justify-between gap-2.5">
      <p className="text-xs text-[#8A958D]">Basado en lo que hiciste en la app.</p>
      {estado === 'nada' && enLinea && <button type="button" onClick={() => establecerEstado('confirmar')}
        className={'min-h-10 shrink-0 rounded-lg text-[13px] font-semibold text-[#647168] underline underline-offset-4 hover:text-[#263D34] ' + foco}>Empezar de cero</button>}
    </div>}

    {(estado === 'confirmar' || estado === 'borrando') && <div role="alertdialog" aria-labelledby="perfil-olvidar" className="orbit-aparece relative flex flex-col gap-2.5 rounded-2xl bg-white p-3.5">
      <p id="perfil-olvidar" className="text-sm leading-relaxed">Orbit olvidará lo que aprendió de tus horas y horarios. ¿Seguir?</p>
      {error && <p role="status" className="text-[13px] text-[#647168]">{error}</p>}
      <div className="flex gap-1.5">
        <button type="button" onClick={olvidar} disabled={estado === 'borrando' || !enLinea}
          className={'min-h-11 rounded-full bg-[#263D34] px-4 text-[13.5px] font-semibold text-white disabled:opacity-70 ' + foco}>{estado === 'borrando' ? 'Borrando…' : 'Sí, empezar de cero'}</button>
        <button type="button" onClick={() => { establecerEstado('nada'); establecerError(null); }} disabled={estado === 'borrando'}
          className={'min-h-11 rounded-full px-3 text-[13.5px] font-semibold text-[#35695D] ' + foco}>Cancelar</button>
      </div>
    </div>}
    {estado === 'listo' && <p role="status" className="orbit-aparece relative text-[13.5px] leading-snug text-[#1F5D50]">Listo: Orbit vuelve a estimar como para un estudiante promedio.</p>}
  </section>;
}
