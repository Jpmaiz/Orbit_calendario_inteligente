'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { ClaseAgenda } from '../calendario/agendaDia';
import MapaRitmo, { type Ocupado } from './MapaRitmo';
import MapaEnergia, { SIGUIENTE } from './MapaEnergia';
import PreguntasEnergia from './PreguntasEnergia';
import FijoSemanal from './FijoSemanal';
import { useConsulta } from './useConsulta';
import NecesitasInternet from '../pwa/NecesitasInternet';
import CargaFallida from '../pwa/CargaFallida';
import { useEnLinea } from '../pwa/useEnLinea';
import { mensajeError, SIN_RED } from '../pwa/errorRed';
import { aMinutos, guardarRitmo, leerEnergia, type CambioRitmo, type EnergiaPerfil, type Ritmo } from './contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const HORAS = Array.from({ length: 39 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}).map((h) => (h === '24:00' ? '23:59' : h));
const horasTexto = (h: number) => String(h).replace('.', ',') + ' h';
const campo = 'min-h-11 rounded-xl border border-[#DCE3D8] bg-[#FAFBF8] px-2.5 text-[14.5px] font-semibold text-[#263D34] ' + foco;
const orden = (i: number) => ({ '--i': i }) as CSSProperties;

/** Fila de 7 días con botones (días sin estudio o días con menos estudio). */
function Dias({ etiqueta, elegidos, bloqueados = [], tono, alCambiar }: {
  etiqueta: string; elegidos: number[]; bloqueados?: number[]; tono: 'oscuro' | 'suave'; alCambiar: (dias: number[]) => void;
}) {
  return <fieldset className="flex flex-col gap-2">
    <legend className="mb-2 text-[14.5px]">{etiqueta}</legend>
    <div className="grid grid-cols-7 gap-1.5">
      {LETRAS.map((letra, i) => {
        const activo = elegidos.includes(i + 1), bloqueado = bloqueados.includes(i + 1);
        return <button key={letra} type="button" aria-pressed={activo} aria-label={NOMBRES[i]} disabled={bloqueado}
          onClick={() => alCambiar(activo ? elegidos.filter((d) => d !== i + 1) : [...elegidos, i + 1].sort())}
          className={'h-11 rounded-xl text-[13.5px] font-semibold transition-colors disabled:opacity-35 ' + foco + ' ' + (activo
            ? (tono === 'oscuro' ? 'bg-[#263D34] text-white' : 'bg-[#E3EEE6] text-[#1F5D50] shadow-[inset_0_0_0_1.5px_#35695D]')
            : 'bg-[#FAFBF8] text-[#4C5A51] shadow-[inset_0_0_0_1px_#DCE3D8] hover:bg-[#F1F4EE]')}>{letra}</button>;
      })}
    </div>
  </fieldset>;
}

/**
 * «Mi ritmo» (v2.14): tu energía en 4 momentos del día (con las dos preguntas de la primera vez), tu semana,
 * algo fijo cada semana y el ajuste a mano. Todo con botones y selectores: nada de texto libre sobre ti.
 */
export default function MiRitmo({ inicial, clases }: { inicial: Ritmo; clases: ClaseAgenda[] }) {
  const [ritmo, establecerRitmo] = useState(inicial);
  const confirmado = useRef(inicial);
  const energia = useConsulta('/api/perfil/energia', leerEnergia);
  // La sugerencia se registra al mostrarse: se guarda aquí para que no desaparezca si el mapa se vuelve a pedir.
  const [sugerencia, establecerSugerencia] = useState<EnergiaPerfil['sugerencia']>(null);
  const [vistaSugerencia, establecerVistaSugerencia] = useState<string | null>(null);
  const [preguntasListas, establecerPreguntasListas] = useState(false);
  const [aviso, establecerAviso] = useState<string | null>(null);
  const [manual, establecerManual] = useState(false);
  const [guardado, establecerGuardado] = useState(false);
  const pendiente = useRef<CambioRitmo>({});
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const relojGuardado = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idManual = useId();
  const datosEnergia = energia.carga?.datos ?? null;
  const enLinea = useEnLinea();

  // Primera sugerencia que llega: queda hasta que la responda (sin efecto: se ajusta al renderizar).
  const nueva = datosEnergia?.sugerencia ?? null;
  if (nueva && vistaSugerencia === null) {
    establecerVistaSugerencia(nueva.texto);
    establecerSugerencia(nueva);
  }

  // Si se sale con un cambio sin enviar, se envía igual.
  useEffect(() => () => {
    clearTimeout(reloj.current);
    clearTimeout(relojGuardado.current);
    if (Object.keys(pendiente.current).length) void guardarRitmo(pendiente.current).catch(() => {});
  }, []);

  function mostrarGuardado() {
    establecerGuardado(true);
    clearTimeout(relojGuardado.current);
    relojGuardado.current = setTimeout(() => establecerGuardado(false), 1600);
  }

  function aplicar(nuevo: Ritmo) {
    confirmado.current = nuevo;
    establecerRitmo(nuevo);
    mostrarGuardado();
    energia.recargar();
  }

  /** Se ve al instante y se guarda tras 300 ms sin más cambios (PATCH parcial; la energía se junta por momento). */
  function cambiar(cambio: CambioRitmo) {
    establecerRitmo((actual) => ({ ...actual, ...cambio, energia: { ...actual.energia, ...cambio.energia } }));
    establecerAviso(null);
    const energiaJunta = cambio.energia || pendiente.current.energia ? { energia: { ...pendiente.current.energia, ...cambio.energia } } : {};
    pendiente.current = { ...pendiente.current, ...cambio, ...energiaJunta };
    clearTimeout(reloj.current);
    reloj.current = setTimeout(async () => {
      const enviar = pendiente.current;
      pendiente.current = {};
      try {
        aplicar(await guardarRitmo(enviar));
      } catch (e) {
        establecerRitmo(confirmado.current);
        establecerAviso(mensajeError(e, 'No pude guardar tu ritmo.'));
      }
    }, 300);
  }

  async function guardarYa(cambio: CambioRitmo | null) {
    clearTimeout(reloj.current);
    pendiente.current = {};
    try {
      aplicar(await guardarRitmo(cambio));
    } catch (e) {
      establecerAviso(mensajeError(e, 'No pude guardar tu ritmo.'));
    }
  }

  // El mapa de energía refleja el toque al instante (aunque el PATCH todavía no volvió).
  const momentos = (datosEnergia?.momentos ?? []).map((m) => ({
    ...m, nivel: ritmo.energia[m.momento] ?? m.nivel, aprendido: m.aprendido && ritmo.energia[m.momento] === m.nivel,
  }));
  // Lo opcional (las dos preguntas, la sugerencia) no aparece sin conexión.
  const preguntar = enLinea && !!datosEnergia?.preguntar && !ritmo.energiaPreguntada && !preguntasListas;
  const ocupados: Ocupado[] = clases.map((c) => ({ dia: c.diaSemana, ini: aMinutos(c.horaInicio), fin: aMinutos(c.horaFin), titulo: c.titulo, color: c.materia?.color ?? '#4C5A51' }));
  const desdeMin = aMinutos(ritmo.desde), hastaMin = aMinutos(ritmo.hasta);

  return <section aria-labelledby="perfil-ritmo" className="orbit-aparece col-span-2 flex flex-col gap-4 rounded-[28px] bg-white p-[18px] shadow-[inset_0_0_0_1px_#E3E8DE]" style={orden(3)}>
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="perfil-ritmo" className="text-base font-bold">Mi ritmo</h2>
      {guardado && <span role="status" className="orbit-aparece text-[12.5px] font-semibold text-[#1F5D50]">Guardado</span>}
    </div>

    {preguntar && datosEnergia
      ? <PreguntasEnergia momentos={datosEnergia.momentos} alTerminar={(nuevo) => { establecerPreguntasListas(true); aplicar(nuevo); }} />
      : <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[14.5px] font-semibold">Tu energía en el día</h3>
          {!energia.carga && <span role="status" className="text-xs text-[#8A958D]">Cargando…</span>}
        </div>
        {energia.carga?.error && <CargaFallida texto="No pude cargar tu energía." recargar={energia.recargar} className="text-[13px]" />}
        {momentos.length > 0 && <>
          <MapaEnergia momentos={momentos} deshabilitado={!enLinea} alCambiar={(m) => cambiar({ energia: { [m.momento]: SIGUIENTE[m.nivel] } })} />
          {enLinea
            ? <p className="text-[12.5px] leading-snug text-[#8A958D]">Toca un momento para cambiarlo. Orbit pone el estudio más exigente donde rindes más.</p>
            : <NecesitasInternet />}
        </>}
      </div>}

    {sugerencia && enLinea && <div role="status" className="orbit-aparece flex flex-col gap-2.5 rounded-[18px] bg-[#F1F6F2] p-3.5 shadow-[inset_0_0_0_1.5px_#A9CDB9]">
      <p className="text-sm leading-relaxed">{sugerencia.texto}</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => { const cambio = sugerencia.cambio; establecerSugerencia(null); void guardarYa(cambio); }}
          className={'min-h-10 rounded-full bg-[#35695D] px-5 text-[13.5px] font-semibold text-white hover:bg-[#2D5C51] ' + foco}>Sí</button>
        <button type="button" onClick={() => establecerSugerencia(null)}
          className={'min-h-10 rounded-full px-3 text-[13.5px] font-semibold text-[#647168] ' + foco}>No</button>
      </div>
    </div>}

    <div className="flex flex-col gap-2.5">
      <h3 className="text-[14.5px] font-semibold">Tu semana</h3>
      <MapaRitmo ritmo={ritmo} ocupados={ocupados} />
      <p className="text-[13px] tabular-nums text-[#4C5A51]">Estudias de {ritmo.desde} a {ritmo.hasta} · máx. {horasTexto(ritmo.maxHorasDia)} por día</p>
    </div>

    <FijoSemanal />

    {aviso && aviso !== SIN_RED && <p role="status" className="text-[13px] text-[#647168]">{aviso}</p>}

    <button type="button" aria-expanded={manual && enLinea} aria-controls={idManual} disabled={!enLinea} onClick={() => establecerManual((v) => !v)}
      className={'inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg text-[13.5px] font-semibold text-[#35695D] disabled:opacity-40 ' + foco}>
      Ajustar a mano
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={'h-4 w-4 transition-transform duration-200 ' + (manual ? 'rotate-180' : '')}><path d="m6 9 6 6 6-6" /></svg>
    </button>

    {manual && enLinea && <div id={idManual} className="orbit-aparece flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[14.5px]">
        <span>Estudio de</span>
        <select aria-label="Hora de inicio del estudio" value={ritmo.desde} onChange={(e) => cambiar({ desde: e.target.value })} className={campo}>
          {HORAS.filter((h) => aMinutos(h) <= hastaMin - 120 || h === ritmo.desde).map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span>a</span>
        <select aria-label="Hora de fin del estudio" value={ritmo.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} className={campo}>
          {HORAS.filter((h) => aMinutos(h) >= desdeMin + 120 || h === ritmo.hasta).map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 text-[14.5px]">
        <span>Máximo</span>
        <div role="group" aria-label="Máximo de horas de estudio por día" className="inline-flex items-center rounded-xl border border-[#DCE3D8] bg-[#FAFBF8]">
          <button type="button" aria-label="Media hora menos" disabled={ritmo.maxHorasDia <= 1} onClick={() => cambiar({ maxHorasDia: ritmo.maxHorasDia - 0.5 })}
            className={'h-11 w-11 rounded-xl text-xl font-semibold text-[#35695D] disabled:text-[#C2CAC4] ' + foco}>−</button>
          <span aria-live="polite" className="min-w-[54px] text-center font-semibold tabular-nums">{horasTexto(ritmo.maxHorasDia)}</span>
          <button type="button" aria-label="Media hora más" disabled={ritmo.maxHorasDia >= 8} onClick={() => cambiar({ maxHorasDia: ritmo.maxHorasDia + 0.5 })}
            className={'h-11 w-11 rounded-xl text-xl font-semibold text-[#35695D] disabled:text-[#C2CAC4] ' + foco}>+</button>
        </div>
        <span>por día</span>
      </div>

      <Dias etiqueta="Días sin estudio" elegidos={ritmo.diasLibres} tono="oscuro" alCambiar={(lista) => {
        if (lista.length === 7) { establecerAviso('Deja al menos un día para estudiar.'); return; }
        cambiar({ diasLibres: lista, menosEstudio: ritmo.menosEstudio.filter((d) => !lista.includes(d)) });
      }} />
      <Dias etiqueta="Días con menos estudio (la mitad)" elegidos={ritmo.menosEstudio} bloqueados={ritmo.diasLibres} tono="suave"
        alCambiar={(lista) => cambiar({ menosEstudio: lista })} />

      <button type="button" onClick={() => guardarYa(null)}
        className={'min-h-10 self-start rounded-lg text-[13.5px] font-semibold text-[#35695D] underline underline-offset-4 ' + foco}>Volver a lo de siempre</button>
    </div>}

    <p className="text-[12.5px] leading-snug text-[#8A958D]">Orbit usa tu ritmo para sugerirte bloques y calcular tus horas libres.</p>
  </section>;
}
