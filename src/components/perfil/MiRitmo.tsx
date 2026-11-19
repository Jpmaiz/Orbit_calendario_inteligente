'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useDictado } from '../ia/useDictado';
import type { ClaseAgenda } from '../calendario/agendaDia';
import MapaRitmo, { type Ocupado } from './MapaRitmo';
import {
  aMinutos, crearCompromisos, ErrorPerfil, guardarRitmo, interpretarRitmo, type Franja, type Propuesta, type Ritmo,
} from './contratoPerfil';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2';
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const FRANJAS: [Franja | null, string][] = [['manana', 'Mañana'], ['tarde', 'Tarde'], ['noche', 'Noche'], [null, 'Que Orbit lo aprenda']];
const HORAS = Array.from({ length: 39 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}).map((h) => (h === '24:00' ? '23:59' : h));
const horasTexto = (h: number) => String(h).replace('.', ',') + ' h';
const campo = 'min-h-11 rounded-xl border border-[#DCE3D8] bg-[#FAFBF8] px-2.5 text-[14.5px] font-semibold text-[#263D34] ' + foco;

type Paso = 'cerrado' | 'escribir' | 'propuesta';
const orden = (i: number) => ({ '--i': i }) as CSSProperties;

/** «Mi ritmo»: el mapa de tu semana, «Cuéntale a Orbit tu semana» (lo primero) y el ajuste a mano, que guarda solo. */
export default function MiRitmo({ inicial, clases }: { inicial: Ritmo; clases: ClaseAgenda[] }) {
  const [ritmo, establecerRitmo] = useState(inicial);
  const confirmado = useRef(inicial);
  const [paso, establecerPaso] = useState<Paso>('cerrado');
  const [texto, establecerTexto] = useState('');
  const [propuesta, establecerPropuesta] = useState<Propuesta | null>(null);
  const [ocupado, establecerOcupado] = useState<'interpretar' | 'guardar' | null>(null);
  const [aviso, establecerAviso] = useState<string | null>(null);
  const [avisoManual, establecerAvisoManual] = useState<string | null>(null);
  const [manual, establecerManual] = useState(false);
  const [guardado, establecerGuardado] = useState(false);
  const pendiente = useRef<Partial<Ritmo>>({});
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const relojGuardado = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idTexto = useId(), idManual = useId();
  const dictado = useDictado((dicho) => establecerTexto((t) => (t.trim() ? t.trim() + ' ' : '') + dicho));

  // Si se sale de la pantalla con un cambio a mano sin enviar, se envía igual.
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

  /** Ajuste a mano: se ve al instante y se guarda tras 300 ms sin más cambios (PATCH parcial). */
  function cambiar(cambio: Partial<Ritmo>) {
    establecerRitmo((actual) => ({ ...actual, ...cambio }));
    establecerAvisoManual(null);
    pendiente.current = { ...pendiente.current, ...cambio };
    clearTimeout(reloj.current);
    reloj.current = setTimeout(async () => {
      const enviar = pendiente.current;
      pendiente.current = {};
      try {
        const nuevo = await guardarRitmo(enviar);
        confirmado.current = nuevo;
        establecerRitmo(nuevo);
        mostrarGuardado();
      } catch (e) {
        establecerRitmo(confirmado.current);
        establecerAvisoManual(e instanceof Error ? e.message : 'No pude guardar tu ritmo.');
      }
    }, 300);
  }

  async function volverALoDeSiempre() {
    clearTimeout(reloj.current);
    pendiente.current = {};
    try {
      const nuevo = await guardarRitmo(null);
      confirmado.current = nuevo;
      establecerRitmo(nuevo);
      mostrarGuardado();
    } catch (e) {
      establecerAvisoManual(e instanceof Error ? e.message : 'No pude guardar tu ritmo.');
    }
  }

  async function interpretar() {
    if (!texto.trim() || ocupado) return;
    if (dictado.escuchando) dictado.alternar();
    establecerOcupado('interpretar');
    establecerAviso(null);
    try {
      const nueva = await interpretarRitmo(texto.trim(), ritmo);
      establecerPropuesta(nueva);
      establecerPaso('propuesta');
    } catch (e) {
      // 422 trae su mensaje listo («No encontré horarios…»): se muestra tal cual, sin rojo.
      establecerAviso(e instanceof ErrorPerfil || e instanceof Error ? e.message : 'No pude leerlo ahora.');
    } finally {
      establecerOcupado(null);
    }
  }

  async function guardarPropuesta() {
    if (!propuesta || ocupado) return;
    establecerOcupado('guardar');
    establecerAviso(null);
    try {
      const nuevo = await guardarRitmo(propuesta.ritmo);
      confirmado.current = nuevo;
      establecerRitmo(nuevo);
      const fallidos = await crearCompromisos(propuesta.compromisos);
      establecerPropuesta(null);
      establecerTexto('');
      establecerPaso('cerrado');
      mostrarGuardado();
      if (fallidos.length) establecerAviso(`Guardé tu ritmo, pero no pude agregar «${fallidos.join('», «')}». Puedes contárselo otra vez.`);
    } catch (e) {
      establecerAviso(e instanceof Error ? e.message : 'No pude guardar tu ritmo.');
    } finally {
      establecerOcupado(null);
    }
  }

  // El mapa: clases de la semana y, mientras se revisa la propuesta, cómo quedaría (todavía sin guardar).
  const vista = paso === 'propuesta' && propuesta ? propuesta.ritmo : ritmo;
  const ocupados: Ocupado[] = [
    ...clases.map((c) => ({ dia: c.diaSemana, ini: aMinutos(c.horaInicio), fin: aMinutos(c.horaFin), titulo: c.titulo, color: c.materia?.color ?? '#4C5A51' })),
    ...(paso === 'propuesta' && propuesta ? propuesta.compromisos.flatMap((c) => c.diasSemana.map((dia) => ({
      dia, ini: aMinutos(c.hora), fin: aMinutos(c.horaFin), titulo: c.titulo, color: '#4C5A51',
    }))) : []),
  ];
  const desdeMin = aMinutos(ritmo.desde), hastaMin = aMinutos(ritmo.hasta);

  return <section aria-labelledby="perfil-ritmo" className="orbit-aparece col-span-2 flex flex-col gap-3.5 rounded-[28px] bg-white p-[18px] shadow-[inset_0_0_0_1px_#E3E8DE]" style={orden(3)}>
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="perfil-ritmo" className="text-base font-bold">Mi ritmo</h2>
      {guardado && <span role="status" className="orbit-aparece text-[12.5px] font-semibold text-[#1F5D50]">Guardado</span>}
    </div>

    <MapaRitmo ritmo={vista} ocupados={ocupados} />
    <p className="text-[13.5px] tabular-nums text-[#4C5A51]">
      Estudias de {vista.desde} a {vista.hasta} · máx. {horasTexto(vista.maxHorasDia)} por día{vista.franja ? '' : ' · tu mejor hora la aprende Orbit'}
    </p>

    {paso === 'cerrado' && <button type="button" onClick={() => establecerPaso('escribir')}
      className={'flex min-h-[60px] items-center gap-3 rounded-[18px] px-3.5 py-2.5 text-left text-white transition-transform hover:-translate-y-px ' + foco}
      style={{ background: 'linear-gradient(135deg, #35695D, #28574C)' }}>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[.14]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[19px] w-[19px]"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-bold">Cuéntale a Orbit tu semana</span>
        <span className="text-[12.5px] text-[#CFE6D8]">Escríbelo o díctalo como se lo dirías a un amigo</span>
      </span>
    </button>}

    {paso === 'escribir' && <div className="orbit-aparece flex flex-col gap-2.5 rounded-[18px] bg-[#F1F6F2] p-3.5">
      <label htmlFor={idTexto} className="text-sm font-bold">Cuéntale a Orbit tu semana</label>
      <div className="relative">
        <textarea id={idTexto} rows={3} maxLength={800} value={texto} onChange={(e) => { establecerTexto(e.target.value); establecerAviso(null); }}
          placeholder="Ej.: trabajo martes y jueves de 6 a 9 de la noche, los domingos descanso, rindo más de noche"
          className={'min-h-24 w-full resize-y rounded-[14px] border border-[#DCE3D8] bg-white py-3 pl-3.5 text-[14.5px] leading-relaxed text-[#263D34] placeholder:text-[#97A29A] ' + (dictado.disponible ? 'pr-[52px] ' : 'pr-3.5 ') + foco} />
        {dictado.disponible && <button type="button" onClick={dictado.alternar} aria-pressed={dictado.escuchando} aria-label={dictado.escuchando ? 'Dejar de dictar' : 'Dictar'}
          className={'absolute bottom-2.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full text-[#35695D] ' + (dictado.escuchando ? 'bg-[#E3EEE6] ' : 'hover:bg-[#EEF3EF] ') + foco}>
          {dictado.escuchando && <span aria-hidden="true" className="orbit-dia-halo absolute inset-1 rounded-full bg-[#35695D]/50" />}
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative h-5 w-5"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        </button>}
      </div>
      {aviso && <p role="status" className="text-[13.5px] leading-snug text-[#647168]">{aviso}</p>}
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={interpretar} disabled={!texto.trim() || ocupado !== null}
          className={'min-h-11 rounded-full bg-[#35695D] px-[18px] text-sm font-semibold text-white hover:bg-[#2D5C51] disabled:bg-[#E9EDE5] disabled:text-[#8A958D] ' + foco}>
          {ocupado === 'interpretar' ? 'Entendiendo…' : 'Que Orbit lo entienda'}
        </button>
        <button type="button" onClick={() => { establecerPaso('cerrado'); establecerAviso(null); if (dictado.escuchando) dictado.alternar(); }}
          className={'min-h-11 rounded-full px-3 text-sm font-semibold text-[#647168] hover:text-[#263D34] ' + foco}>Ahora no</button>
      </div>
    </div>}

    {paso === 'propuesta' && propuesta && <div className="orbit-aparece flex flex-col gap-2.5 rounded-[18px] bg-[#F1F6F2] p-3.5 shadow-[inset_0_0_0_1.5px_#A9CDB9]">
      <p className="text-[13px] font-bold text-[#1F5D50]">Entendí esto:</p>
      <ul className="space-y-1.5">
        {propuesta.resumen.map((frase, i) => <li key={frase} className="orbit-aparece flex gap-2.5 text-[14.5px] leading-snug" style={orden(i)}>
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#35695D]" />{frase}
        </li>)}
      </ul>
      <p className="text-[12.5px] text-[#647168]">Arriba ves cómo quedaría tu semana.</p>
      {aviso && <p role="status" className="text-[13.5px] leading-snug text-[#647168]">{aviso}</p>}
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={guardarPropuesta} disabled={ocupado !== null}
          className={'min-h-11 rounded-full bg-[#35695D] px-[22px] text-sm font-semibold text-white hover:bg-[#2D5C51] disabled:opacity-70 ' + foco}>
          {ocupado === 'guardar' ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => { establecerPaso('escribir'); establecerAviso(null); }} disabled={ocupado !== null}
          className={'min-h-11 rounded-full px-3 text-sm font-semibold text-[#35695D] ' + foco}>Corregir</button>
      </div>
    </div>}

    {paso === 'cerrado' && aviso && <p role="status" className="text-[13.5px] leading-snug text-[#647168]">{aviso}</p>}

    <button type="button" aria-expanded={manual} aria-controls={idManual} onClick={() => establecerManual((v) => !v)}
      className={'inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg text-[13.5px] font-semibold text-[#35695D] ' + foco}>
      Ajustar a mano
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={'h-4 w-4 transition-transform duration-200 ' + (manual ? 'rotate-180' : '')}><path d="m6 9 6 6 6-6" /></svg>
    </button>

    {manual && <div id={idManual} className="orbit-aparece flex flex-col gap-4">
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14.5px]">Días sin estudio</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {LETRAS.map((letra, i) => {
            const libre = ritmo.diasLibres.includes(i + 1);
            return <button key={letra} type="button" aria-pressed={libre} aria-label={NOMBRES[i]}
              onClick={() => {
                const lista = libre ? ritmo.diasLibres.filter((d) => d !== i + 1) : [...ritmo.diasLibres, i + 1].sort();
                if (lista.length === 7) { establecerAvisoManual('Deja al menos un día para estudiar.'); return; }
                cambiar({ diasLibres: lista });
              }}
              className={'h-11 rounded-xl text-[13.5px] font-semibold transition-colors ' + foco + ' ' + (libre ? 'bg-[#263D34] text-white' : 'bg-[#FAFBF8] text-[#4C5A51] shadow-[inset_0_0_0_1px_#DCE3D8] hover:bg-[#F1F4EE]')}>{letra}</button>;
          })}
        </div>
      </fieldset>

      <div role="radiogroup" aria-label="Rindo mejor en" className="flex flex-col gap-2">
        <p className="text-[14.5px]">Rindo mejor en</p>
        <div className="flex flex-wrap gap-1.5">
          {FRANJAS.map(([valor, nombre]) => {
            const marcada = ritmo.franja === valor;
            return <button key={nombre} type="button" role="radio" aria-checked={marcada} onClick={() => cambiar({ franja: valor })}
              className={'min-h-11 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors ' + foco + ' ' +
                (marcada ? 'bg-[#E3EEE6] text-[#1F5D50] shadow-[inset_0_0_0_1.5px_#35695D]' : 'bg-[#FAFBF8] text-[#4C5A51] shadow-[inset_0_0_0_1px_#DCE3D8] hover:bg-[#F1F4EE]')}>{nombre}</button>;
          })}
        </div>
      </div>

      {avisoManual && <p role="status" className="text-[13px] text-[#647168]">{avisoManual}</p>}
      <button type="button" onClick={volverALoDeSiempre}
        className={'self-start rounded-lg text-[13.5px] font-semibold text-[#35695D] underline underline-offset-4 min-h-10 ' + foco}>Volver a lo de siempre</button>
    </div>}

    <p className="text-[12.5px] leading-snug text-[#8A958D]">Orbit usa tu ritmo para sugerirte bloques y calcular tus horas libres.</p>
  </section>;
}
