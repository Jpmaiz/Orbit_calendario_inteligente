'use client';

import { useId, useState } from 'react';
import { aMinutos, crearCompromisos } from './contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const TIPOS = ['Trabajo', 'Gimnasio', 'Deporte', 'Otro'];
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const HORAS = Array.from({ length: 37 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}).filter((h) => h <= '23:30');
const campo = 'min-h-11 rounded-xl border border-[#DCE3D8] bg-[#FAFBF8] px-2.5 text-[14.5px] font-semibold text-[#263D34] ' + foco;
const chip = (activo: boolean) => 'min-h-11 rounded-xl px-3 text-[13.5px] font-semibold transition-colors ' + foco + ' ' +
  (activo ? 'bg-[#263D34] text-white' : 'bg-[#FAFBF8] text-[#4C5A51] shadow-[inset_0_0_0_1px_#DCE3D8] hover:bg-[#F1F4EE]');

/** «Algo fijo cada semana»: trabajo, gimnasio… con botones y selectores. Se guarda como clase fija sin materia (tiempo ocupado). */
export default function FijoSemanal() {
  const [abierto, establecerAbierto] = useState(false);
  const [tipo, establecerTipo] = useState('Trabajo');
  const [otro, establecerOtro] = useState('');
  const [dias, establecerDias] = useState<number[]>([]);
  const [desde, establecerDesde] = useState('18:00');
  const [hasta, establecerHasta] = useState('20:00');
  const [estado, establecerEstado] = useState<'nada' | 'guardando' | { listo: string } | { error: string }>('nada');
  const idOtro = useId();
  const titulo = tipo === 'Otro' ? otro.trim() : tipo;
  const valido = titulo.length > 0 && dias.length > 0 && aMinutos(hasta) > aMinutos(desde);

  async function guardar() {
    if (!valido) return;
    establecerEstado('guardando');
    const fallidos = await crearCompromisos([{ titulo, diasSemana: dias, hora: desde, horaFin: hasta }]);
    if (fallidos.length) { establecerEstado({ error: 'No pude guardarlo. Inténtalo de nuevo.' }); return; }
    establecerEstado({ listo: `Listo: «${titulo}» quedó como tiempo ocupado. Orbit no te pondrá estudio ahí.` });
    establecerAbierto(false);
    establecerDias([]);
    establecerOtro('');
  }

  if (!abierto) return <div className="flex flex-col gap-2">
    <button type="button" onClick={() => { establecerAbierto(true); establecerEstado('nada'); }}
      className={'flex min-h-[52px] items-center gap-3 rounded-2xl px-3.5 text-left shadow-[inset_0_0_0_1px_#DCE3D8] transition-colors hover:bg-[#F6F8F3] ' + foco}>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF1EC] text-lg font-semibold text-[#245B4C]">+</span>
      <span className="flex flex-col">
        <span className="text-[14.5px] font-semibold">Algo fijo cada semana</span>
        <span className="text-[12.5px] text-[#647168]">Trabajo, gimnasio, deporte… Orbit no pondrá estudio ahí</span>
      </span>
    </button>
    {typeof estado === 'object' && 'listo' in estado && <p role="status" className="orbit-aparece text-[13px] text-[#1F5D50]">{estado.listo}</p>}
  </div>;

  return <div className="orbit-aparece flex flex-col gap-4 rounded-[20px] bg-[#F6F8F3] p-4">
    <div className="flex flex-col gap-2">
      <p className="text-[14.5px] font-semibold">¿Qué es?</p>
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => <button key={t} type="button" aria-pressed={tipo === t} onClick={() => establecerTipo(t)} className={chip(tipo === t) + ' px-3.5 rounded-full'}>{t}</button>)}
      </div>
      {tipo === 'Otro' && <><label htmlFor={idOtro} className="sr-only">Nombre</label>
        <input id={idOtro} value={otro} maxLength={40} onChange={(e) => establecerOtro(e.target.value)} placeholder="Ej.: Clases de inglés" autoFocus
          className={'min-h-11 rounded-xl border border-[#DCE3D8] bg-white px-3 text-[14.5px] ' + foco} /></>}
    </div>
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[14.5px] font-semibold">¿Qué días?</legend>
      <div className="grid grid-cols-7 gap-1.5">
        {LETRAS.map((l, i) => <button key={l} type="button" aria-pressed={dias.includes(i + 1)} aria-label={NOMBRES[i]}
          onClick={() => establecerDias((d) => (d.includes(i + 1) ? d.filter((x) => x !== i + 1) : [...d, i + 1].sort()))}
          className={chip(dias.includes(i + 1)) + ' px-0'}>{l}</button>)}
      </div>
    </fieldset>
    <div className="flex flex-wrap items-center gap-2 text-[14.5px]">
      <span className="font-semibold">De</span>
      <select aria-label="Hora de inicio" value={desde} onChange={(e) => { establecerDesde(e.target.value); if (aMinutos(hasta) <= aMinutos(e.target.value)) establecerHasta(HORAS[Math.min(HORAS.length - 1, HORAS.indexOf(e.target.value) + 2)]); }} className={campo}>
        {HORAS.slice(0, -1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="font-semibold">a</span>
      <select aria-label="Hora de fin" value={hasta} onChange={(e) => establecerHasta(e.target.value)} className={campo}>
        {HORAS.filter((h) => aMinutos(h) > aMinutos(desde)).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
    {typeof estado === 'object' && 'error' in estado && <p role="status" className="text-[13px] text-[#647168]">{estado.error}</p>}
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={guardar} disabled={!valido || estado === 'guardando'}
        className={'min-h-11 rounded-full bg-[#35695D] px-5 text-sm font-semibold text-white hover:bg-[#2D5C51] disabled:bg-[#E9EDE5] disabled:text-[#8A958D] ' + foco}>
        {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" onClick={() => establecerAbierto(false)} className={'min-h-11 rounded-full px-3 text-sm font-semibold text-[#647168] ' + foco}>Cancelar</button>
    </div>
  </div>;
}
