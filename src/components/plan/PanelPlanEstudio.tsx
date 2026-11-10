'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { leerAgenda, type AgendaDia } from '../calendario/agendaDia';
import { diaEnBolivia, sumarDias } from '../calendario/organizarTareasDia';
import { cargarPlan, eliminarPlan, guardarPlan, type DatosPlan } from './contratoPlan';
import {
  aEditable, aISO, ajustar, armarDias, choqueDe, crearEn, duracion, H0, H1, hhmm, libres, MAX_DIAS, MIN_BLOQUE,
  type BloqueEditable, type DiaPlan, type Tramo,
} from './grillaPlan';

const PXM = 56 / 60; // 56 px por hora
const ALTO = (H1 - H0) * PXM;
const zona = 'America/La_Paz';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const formatoSemana = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'short' });
const formatoFecha = new Intl.DateTimeFormat('es-BO', { timeZone: zona, day: 'numeric', month: 'short' });
const formatoLimite = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'long', day: 'numeric' });
const formatoHora = new Intl.DateTimeFormat('es-BO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const nombresTipo: Record<string, string> = { examen: 'Examen', entrega: 'Entrega', tarea: 'Tarea', proyecto: 'Proyecto', exposicion: 'Exposición' };
const rayado = 'repeating-linear-gradient(135deg, rgba(220,225,216,.9) 0 2px, rgba(246,247,243,.9) 2px 9px)';
const sinPunto = (t: string) => t.replace(/\./g, '');
const pos = (a: number, b: number) => ({ top: (Math.max(a, H0) - H0) * PXM, height: Math.max(0, (Math.min(b, H1) - Math.max(a, H0)) * PXM - 3) });

function nombreDia(d: DiaPlan, indice: number) {
  const fecha = new Date(d.dia + 'T12:00:00-04:00');
  const corto = indice === 0 ? 'Hoy' : indice === 1 ? 'Mañana' : sinPunto(formatoSemana.format(fecha));
  return { corto: corto.charAt(0).toUpperCase() + corto.slice(1), fecha: sinPunto(formatoFecha.format(fecha)) };
}

type Arrastre = { clave: string; borde: 'ini' | 'fin'; y0: number; v0: number };

export default function PanelPlanEstudio({ tareaId, titulo, horaDefinida = true, onCerrar }: {
  tareaId: string; titulo: string; horaDefinida?: boolean; onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const solicitud = useRef(false);
  const montado = useRef(true);
  const arrastre = useRef<Arrastre | null>(null);
  const contador = useRef(0);
  const desplazado = useRef(false);
  const tituloId = useId();
  const [datos, setDatos] = useState<DatosPlan | null>(null);
  const [dias, setDias] = useState<DiaPlan[]>([]);
  const [bloques, setBloques] = useState<BloqueEditable[]>([]);
  const [sinAgenda, setSinAgenda] = useState(false);
  const [inicio, setInicio] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [pista, setPista] = useState<{ texto: string; ok?: boolean } | null>(null);
  const [sucio, setSucio] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<'guardar' | 'quitar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ocupada = cargando || accion !== null;

  useEffect(() => {
    montado.current = true;
    dialogo.current?.showModal();
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    async function cargar() {
      try {
        const plan = await cargarPlan(tareaId, abort.signal);
        const ahora = new Date();
        const hoy = diaEnBolivia(ahora);
        const ultimo = diaEnBolivia(new Date(plan.tarea.fechaLimite));
        let agenda: AgendaDia | null = null;
        if (ultimo >= hoy) {
          try {
            const hasta = ultimo < sumarDias(hoy, MAX_DIAS - 1) ? ultimo : sumarDias(hoy, MAX_DIAS - 1);
            const r = await fetch(`/api/agenda?desde=${hoy}&hasta=${hasta}`, { cache: 'no-store', signal: abort.signal });
            if (!r.ok) throw new Error();
            agenda = leerAgenda(await r.json());
          } catch {
            if (abort.signal.aborted) return;
            setSinAgenda(true);
          }
        }
        if (abort.signal.aborted) return;
        const nuevos = armarDias(plan.tarea.fechaLimite, horaDefinida, agenda, tareaId, ahora);
        // Con plan guardado se edita ese; si no, la sugerencia de Orbit viene precargada.
        const base = plan.guardado.length
          ? plan.guardado
          : plan.propuesta.bloques.map((b) => ({ ...b, origen: 'orbit' as const, enCurso: false }));
        const editables = base.flatMap((b) => { const e = aEditable(b, nuevos, 'b' + contador.current++); return e ? [e] : []; });
        setDatos(plan);
        setDias(nuevos);
        setBloques(editables);
        const primero = editables.length ? Math.min(...editables.map((b) => b.dia)) : 0;
        setInicio(Math.max(0, Math.min(primero, nuevos.length - 2)));
      } catch (e) {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar el plan.');
      } finally {
        if (!abort.signal.aborted) setCargando(false);
      }
    }
    void cargar();
    return () => abort.abort();
  }, [tareaId, horaDefinida]);

  function editar(siguientes: BloqueEditable[], mensaje?: { texto: string; ok?: boolean } | null) {
    setBloques(siguientes);
    setSucio(true);
    setError(null);
    if (mensaje !== undefined) setPista(mensaje);
  }

  function tocarHueco(indice: number, tramo: Tramo, e: MouseEvent<HTMLButtonElement>) {
    // Con teclado (detail 0) empieza al inicio del hueco; con el dedo, donde se tocó.
    const minuto = e.detail === 0 ? tramo[0] : tramo[0] + (e.clientY - e.currentTarget.getBoundingClientRect().top) / PXM;
    const nuevo = crearEn(tramo, minuto);
    if (!nuevo) { setPista({ texto: 'Ese hueco es muy corto para estudiar (menos de 30 min).' }); return; }
    const clave = 'b' + contador.current++;
    editar([...bloques, { clave, dia: indice, ini: nuevo[0], fin: nuevo[1], tipo: 'estudio', origen: 'usuario', enCurso: false, idGuardado: null }],
      { texto: `Sumaste ${duracion(nuevo[1] - nuevo[0])}. Arrastra los bordes para ajustar.`, ok: true });
    setSel(clave);
  }
  function quitar(clave: string) {
    setSel(null);
    editar(bloques.filter((b) => b.clave !== clave), { texto: 'Quitaste un bloque.' });
  }
  function tomarBorde(b: BloqueEditable, borde: 'ini' | 'fin') {
    return (e: PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      arrastre.current = { clave: b.clave, borde, y0: e.clientY, v0: borde === 'ini' ? b.ini : b.fin };
    };
  }
  function moverBorde(e: PointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    const siguientes = ajustar(dias, bloques, a.clave, a.borde, a.v0 + (e.clientY - a.y0) / PXM);
    if (siguientes !== bloques) editar(siguientes, null);
  }
  function teclaBorde(b: BloqueEditable, borde: 'ini' | 'fin') {
    return (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const siguientes = ajustar(dias, bloques, b.clave, borde, (borde === 'ini' ? b.ini : b.fin) + (e.key === 'ArrowUp' ? -15 : 15));
      if (siguientes !== bloques) editar(siguientes, null);
    };
  }

  async function guardar() {
    if (solicitud.current || ocupada || !datos) return;
    solicitud.current = true;
    setError(null);
    const futuros = bloques.filter((b) => !b.enCurso);
    setAccion(futuros.length ? 'guardar' : 'quitar');
    try {
      if (futuros.length) {
        const resultado = await guardarPlan(tareaId, futuros.map((b) => ({
          inicio: aISO(dias[b.dia].dia, b.ini), fin: aISO(dias[b.dia].dia, b.fin), tipo: b.tipo, origen: b.origen,
        })));
        if (!montado.current) return;
        const enCurso = bloques.filter((b) => b.enCurso);
        setDatos({ ...datos, guardado: resultado.bloques, conflictos: [] });
        setBloques([...enCurso, ...resultado.bloques.flatMap((b) => { const e = aEditable(b, dias, 'b' + contador.current++); return e ? [e] : []; })]);
        setPista({ texto: 'Plan guardado. Lo verás en tu día.', ok: true });
      } else {
        await eliminarPlan(tareaId);
        if (!montado.current) return;
        setDatos({ ...datos, guardado: [], conflictos: [] });
        setPista({ texto: 'Quitaste el plan. La tarea se conserva.' });
      }
      setSucio(false);
      setSel(null);
    } catch (e) {
      if (montado.current) setError(e instanceof Error ? e.message : 'No se pudo guardar. Tus cambios siguen aquí.');
    } finally {
      solicitud.current = false;
      if (montado.current) setAccion(null);
    }
  }

  const visibles = dias.slice(inicio, inicio + 2).map((d, i) => ({ d, indice: inicio + i }));
  const total = bloques.reduce((t, b) => t + (b.fin - b.ini), 0);
  const necesarios = datos?.propuesta.minutosNecesarios ?? 0;
  const diferencia = total - necesarios;
  const justo = Math.abs(diferencia) <= 15;
  const conflictosBack = new Map((datos?.conflictos ?? []).map((c) => [c.id, c.motivo]));
  const conflictos = new Map<string, string>();
  for (const b of bloques) {
    const conQue = (b.idGuardado && conflictosBack.get(b.idGuardado)) || (choqueDe(dias, bloques, b) && 'Se cruza con ' + choqueDe(dias, bloques, b));
    if (conQue && !b.enCurso) conflictos.set(b.clave, conQue);
  }
  const futuros = bloques.filter((b) => !b.enCurso).length;
  const guardadoFuturo = (datos?.guardado ?? []).some((b) => !b.enCurso);
  const quitaPlan = futuros === 0 && guardadoFuturo;
  const puedeGuardar = !!datos && !ocupada && conflictos.size === 0 && (quitaPlan || (futuros > 0 && (sucio || !guardadoFuturo)));
  const textoBoton = accion === 'guardar' ? 'Guardando…' : accion === 'quitar' ? 'Quitando…'
    : quitaPlan ? 'Quitar plan' : !sucio && guardadoFuturo ? 'Plan guardado' : 'Guardar plan';
  const limite = datos ? new Date(datos.tarea.fechaLimite) : null;
  const meta = datos && limite ? (nombresTipo[datos.tarea.tipo] ?? 'Fecha') + ' · ' + formatoLimite.format(limite) + (horaDefinida ? ' · ' + formatoHora.format(limite) : '') : '';
  const primerConflicto = conflictos.size ? [...conflictos.values()][0] : null;
  const pistaVisible = primerConflicto
    ? { texto: primerConflicto + '. Muévelo o quítalo para poder guardar.', error: true }
    : pista ?? { texto: 'Toca un espacio libre para sumar 1 h. Arrastra los bordes de un bloque para ajustarlo.' };

  const resumen = dias.flatMap((d, indice) => {
    const delDia = bloques.filter((b) => b.dia === indice).sort((x, y) => x.ini - y.ini);
    if (!delDia.length) return [];
    const suma = delDia.reduce((t, b) => t + (b.fin - b.ini), 0);
    const nombre = nombreDia(d, indice);
    return [{ clave: d.dia, nombre: nombre.corto === 'Hoy' || nombre.corto === 'Mañana' ? nombre.corto + ', ' + nombre.fecha : nombre.corto + ' ' + nombre.fecha, suma, delDia }];
  });

  return <dialog ref={dialogo} aria-labelledby={tituloId}
    onClose={onCerrar}
    onCancel={(e) => { if (solicitud.current) e.preventDefault(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-[#E4E8DF] bg-[#F7F8F3] p-4 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35 sm:p-5">
    <div className="space-y-3.5" aria-busy={ocupada}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id={tituloId} className="text-[21px] font-semibold leading-tight">Planificar estudio</h2>
          <p className="break-words text-sm">{datos?.tarea.titulo ?? titulo}</p>
          {meta && <p className="text-[13px] text-[#647168] first-letter:uppercase">{meta}</p>}
        </div>
        <button type="button" disabled={accion !== null} onClick={() => { if (!solicitud.current) dialogo.current?.close(); }}
          className={'-mr-1.5 -mt-2 min-h-11 shrink-0 whitespace-nowrap rounded-[10px] px-2.5 text-sm font-medium text-[#35695D] hover:bg-[#F1F5F0] ' + foco}>Cerrar</button>
      </header>

      {cargando && <p role="status" className="flex items-center gap-2 text-sm text-[#647168]">
        <span aria-hidden="true" className="orbit-gira h-4 w-4 rounded-full border-2 border-[#9AA59D] border-r-transparent" />Buscando tus huecos libres…
      </p>}

      {datos && !cargando && (dias.length === 0
        ? <p className="text-sm text-[#647168]">La fecha de esta actividad ya pasó: no hay días para planificar.</p>
        : <>
          {/* ── Días: de dos en dos, solo con flechas ── */}
          <div className={'grid items-center ' + (visibles.length > 1 ? 'grid-cols-[44px_1fr_1fr_44px]' : 'grid-cols-[44px_1fr_44px]')}>
            <button type="button" aria-label="Días anteriores" disabled={inicio === 0} onClick={() => setInicio(inicio - 1)}
              className={'grid h-11 w-11 place-items-center rounded-[10px] text-[#263D34] hover:bg-[#F1F5F0] disabled:text-[#C9D3CB] disabled:hover:bg-transparent ' + foco}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            {visibles.map(({ d, indice }) => { const n = nombreDia(d, indice); return <p key={d.dia} aria-live="polite" className="flex flex-col items-center">
              <span className="text-[15px] font-semibold">{n.corto}</span>
              <span className="text-[13px] text-[#647168]">{n.fecha}</span>
            </p>; })}
            <button type="button" aria-label="Días siguientes" disabled={inicio >= dias.length - 2} onClick={() => setInicio(inicio + 1)}
              className={'grid h-11 w-11 place-items-center rounded-[10px] text-[#263D34] hover:bg-[#F1F5F0] disabled:text-[#C9D3CB] disabled:hover:bg-transparent ' + foco}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>

          {/* ── Grilla de 07:00 a 23:00 ── */}
          <div className="h-[420px] max-h-[52dvh] overflow-y-auto rounded-[14px] bg-white shadow-[inset_0_0_0_1px_#E3E8DE] [scrollbar-width:thin]"
            ref={(el) => {
              if (!el || desplazado.current) return;
              const primeros = bloques.filter((b) => b.dia >= inicio && b.dia < inicio + 2).map((b) => b.ini);
              el.scrollTop = Math.max(0, ((primeros.length ? Math.min(...primeros) : 14 * 60) - H0) * PXM - 60);
              desplazado.current = true;
            }}>
            <div className={'grid gap-x-1.5 py-2 pr-2 ' + (visibles.length > 1 ? 'grid-cols-[46px_1fr_1fr]' : 'grid-cols-[46px_1fr]')}>
              <div className="relative" style={{ height: ALTO }} aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => 8 + i).map((h) => <span key={h} className="absolute right-1 -translate-y-1/2 font-mono text-xs text-[#8A958D]" style={{ top: (h * 60 - H0) * PXM }}>{String(h).padStart(2, '0')}:00</span>)}
              </div>
              {visibles.map(({ d, indice }) => {
                const n = nombreDia(d, indice);
                return <div key={d.dia} role="group" aria-label={n.corto + ' ' + n.fecha} className="relative" style={{ height: ALTO }}>
                  {Array.from({ length: 31 }, (_, i) => H0 + 30 + i * 30).map((m) => <span key={m} aria-hidden="true"
                    className={'absolute inset-x-0 border-t ' + (m % 60 === 0 ? 'border-[#EEF1EA]' : 'border-dashed border-[#F3F5F1]')} style={{ top: (m - H0) * PXM }} />)}

                  {d.ocupados.filter((o) => o.b > H0 && o.a < H1).map((o, i) => <div key={i} title={o.titulo}
                    className="pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-lg bg-[#ECEFE9] px-1.5 py-1" style={pos(o.a, o.b)}>
                    <p className="truncate text-[12.5px] font-semibold text-[#6F7A72]">{o.etiqueta}</p>
                    <p className="font-mono text-[11.5px] text-[#8A958D]">{hhmm(o.a)}–{hhmm(o.b)}</p>
                  </div>)}

                  {libres(dias, bloques, indice).filter(([a, b]) => b - a >= MIN_BLOQUE).map((tramo) => {
                    const corto = tramo[1] - tramo[0] < 60;
                    return <button type="button" key={tramo[0]} disabled={ocupada} onClick={(e) => tocarHueco(indice, tramo, e)}
                      aria-label={`Sumar estudio, ${n.corto} ${n.fecha}, libre de ${hhmm(tramo[0])} a ${hhmm(tramo[1])}`}
                      className={'group absolute inset-x-0.5 flex cursor-copy items-center justify-center rounded-lg transition-colors hover:bg-[#F3F8F4] ' + foco} style={pos(tramo[0], tramo[1])}>
                      {corto ? <span className="text-xs text-[#9AA59D]">{duracion(tramo[1] - tramo[0])} libres</span>
                        : <span className="text-xs font-medium text-[#35695D] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">+ Sumar estudio</span>}
                    </button>;
                  })}

                  {bloques.filter((b) => b.dia === indice).map((b) => {
                    const orbit = b.origen === 'orbit';
                    const elegido = sel === b.clave;
                    const conflicto = conflictos.get(b.clave);
                    const etiqueta = b.tipo === 'repaso' ? 'Repaso' : orbit ? 'Orbit sugiere' : 'Estudio';
                    return <div key={b.clave} className={'orbit-aparece absolute inset-x-0.5 rounded-[9px] ' + (orbit
                      ? 'border-[1.5px] border-dashed border-[#6FA08B] bg-[#E3F1E8] text-[#1F5D50]'
                      : 'bg-[#35695D] text-white shadow-[0_2px_8px_rgba(53,105,93,.28)]')
                      + (conflicto ? ' ring-2 ring-[#A34955]' : elegido ? ' ring-2 ring-[#28746B] ring-offset-1' : '')} style={pos(b.ini, b.fin)}>
                      <button type="button" disabled={b.enCurso || ocupada} aria-pressed={elegido}
                        aria-label={`${etiqueta} de ${hhmm(b.ini)} a ${hhmm(b.fin)}${b.enCurso ? ', en curso' : '. Tocar para editar'}`}
                        onClick={() => { setSel(elegido ? null : b.clave); setPista(elegido ? null : { texto: 'Arrastra los bordes para ajustar o toca «Quitar».' }); }}
                        className={'absolute inset-0 flex flex-col items-start overflow-hidden rounded-[9px] px-2 pb-1.5 pt-2.5 text-left disabled:cursor-default ' + foco}>
                        <span className="text-[13px] font-semibold leading-tight">{b.enCurso ? 'En curso' : etiqueta}</span>
                        <span className="font-mono text-xs opacity-90">{hhmm(b.ini)} – {hhmm(b.fin)}</span>
                      </button>
                      {!b.enCurso && !ocupada && (['ini', 'fin'] as const).map((borde) => <button type="button" key={borde}
                        aria-label={(borde === 'ini' ? 'Ajustar inicio, ' + hhmm(b.ini) : 'Ajustar fin, ' + hhmm(b.fin)) + '. Usa las flechas arriba y abajo'}
                        onPointerDown={tomarBorde(b, borde)} onPointerMove={moverBorde} onPointerUp={() => { arrastre.current = null; }}
                        onPointerCancel={() => { arrastre.current = null; }} onKeyDown={teclaBorde(b, borde)}
                        className={'group/asa absolute left-1/2 grid h-[18px] w-11 -translate-x-1/2 cursor-ns-resize touch-none place-items-center ' + (borde === 'ini' ? '-top-[9px]' : '-bottom-[9px]') + ' ' + foco}>
                        <span className={'h-1 w-[22px] rounded-sm opacity-80 group-hover/asa:opacity-100 ' + (orbit ? 'bg-[#35695D]' : 'bg-white')} />
                      </button>)}
                      {elegido && !b.enCurso && <button type="button" onClick={() => quitar(b.clave)}
                        className={'orbit-aparece absolute right-1 top-1 min-h-8 rounded-lg bg-white px-2.5 text-[13px] font-semibold text-[#A34955] shadow-[0_2px_6px_rgba(38,61,52,.2)] ' + foco}>Quitar</button>}
                    </div>;
                  })}

                  {d.desde > H0 && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 rounded-lg" style={{ ...pos(H0, d.desde), background: rayado }}>
                    <span className="absolute bottom-1.5 left-2 text-xs font-medium text-[#8A958D]">Ya pasó</span>
                  </div>}
                  {d.hasta < H1 && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 rounded-lg" style={{ ...pos(d.hasta, H1), background: rayado }}>
                    <span className="absolute left-2 top-1.5 text-xs font-medium text-[#8A958D]">Después de la fecha</span>
                  </div>}
                </div>;
              })}
            </div>
          </div>

          <p aria-live="polite" className={'min-h-5 text-[13.5px] leading-snug ' + ('error' in pistaVisible ? 'text-[#A34955]' : pistaVisible.ok ? 'text-[#1F5D50]' : 'text-[#647168]')}>{pistaVisible.texto}</p>
          {sinAgenda && <p className="text-[13px] text-[#916820]">No pude cargar tu horario: Orbit revisará los choques al guardar.</p>}

          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-[#647168]">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-dashed border-[#6FA08B] bg-[#E3F1E8]" />Sugerido por Orbit</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px] bg-[#35695D]" />Tuyo</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px] bg-[#ECEFE9]" />Clase o evento</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3.5 rounded-[3px]" style={{ background: rayado }} />Ya pasó</span>
          </div>

          {/* ── Resumen ── */}
          <section aria-label="Tu plan" className="space-y-2.5 border-t border-[#E3E8DE] pt-3">
            <p aria-live="polite" className="flex items-baseline gap-2 text-sm leading-snug text-[#647168]">
              <span aria-hidden="true" className={'h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full ' + (justo ? 'bg-[#82AB95]' : 'bg-[#C5A355]')} />
              <span><span className="font-semibold text-[#263D34]">{total ? duracion(total) + ' planificadas' : 'Sin estudio todavía'}</span>
                {' · '}{justo ? `justo lo sugerido (${duracion(necesarios, true)})`
                  : diferencia < 0 ? `te faltarían ${duracion(-diferencia, true)} de lo sugerido` : `${duracion(diferencia, true)} más de lo sugerido`}</span>
            </p>
            <h3 className="text-[13px] font-medium text-[#647168]">Tu plan</h3>
            {resumen.length === 0 && <p className="text-sm text-[#647168]">Todavía no hay estudio en tu plan. Toca un espacio libre arriba.</p>}
            <ul className="space-y-2">
              {resumen.map((g) => <li key={g.clave} className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{g.nombre}</span>
                  <span className={'text-[13px] ' + (g.suma > 240 ? 'text-[#916820]' : 'text-[#647168]')}>{duracion(g.suma)}{g.suma > 240 && ' · más de 4 h este día'}</span>
                </div>
                {g.delDia.map((b) => <div key={b.clave} className="flex min-h-10 items-center gap-2.5 rounded-[10px] bg-white pl-3 pr-0.5 shadow-[inset_0_0_0_1px_#E3E8DE]">
                  <span aria-hidden="true" className={'h-2 w-2 shrink-0 rounded-[3px] ' + (b.origen === 'orbit' ? 'border-[1.5px] border-dashed border-[#6FA08B] bg-[#E3F1E8]' : 'bg-[#35695D]')} />
                  <span className="flex-1 text-sm tabular-nums">{hhmm(b.ini)} – {hhmm(b.fin)}</span>
                  <span className="text-[13px] text-[#647168]">{duracion(b.fin - b.ini)} · {b.enCurso ? 'en curso' : b.tipo === 'repaso' ? 'Repaso' : b.origen === 'orbit' ? 'Orbit' : 'Tuyo'}</span>
                  {b.enCurso ? <span className="w-2" /> : <button type="button" disabled={ocupada} aria-label={`Quitar ${g.nombre} de ${hhmm(b.ini)} a ${hhmm(b.fin)}`} onClick={() => quitar(b.clave)}
                    className={'grid h-10 w-10 place-items-center rounded-lg text-[#647168] hover:bg-[#F1F5F0] ' + foco}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>}
                </div>)}
              </li>)}
            </ul>
          </section>

          {error && <p role="alert" className="whitespace-pre-wrap rounded-xl border border-[#EED4D7] bg-[#FCF0F1] p-3 text-sm text-[#A34955]">{error}</p>}

          <footer className="flex items-center gap-2">
            <button type="button" disabled={accion !== null} onClick={() => { if (!solicitud.current) dialogo.current?.close(); }}
              className={'min-h-12 rounded-xl px-4 text-sm font-medium text-[#647168] hover:bg-[#F1F5F0] ' + foco}>Ahora no</button>
            <button type="button" disabled={!puedeGuardar} onClick={() => void guardar()}
              className={'min-h-12 flex-1 rounded-xl text-[15px] font-semibold transition-colors ' + foco + ' '
                + (!sucio && guardadoFuturo && !quitaPlan && !accion ? 'bg-[#E7F8EF] text-[#1F5D50]' : puedeGuardar || accion ? 'bg-[#234F45] text-white hover:bg-[#316457]' : 'bg-[#E3E8DE] text-[#8A958D]')}>
              <span aria-live="polite">{textoBoton}</span>
            </button>
          </footer>
        </>)}

      {!datos && !cargando && error && <div role="alert" className="space-y-2 rounded-xl bg-[#FCF0F1] p-3 text-sm text-[#A34955]">
        <p>{error}</p>
      </div>}
    </div>
  </dialog>;
}
