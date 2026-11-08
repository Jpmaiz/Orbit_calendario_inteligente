'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  cargarPlan, eliminarPlan, ErrorPlan, guardarPlan,
  type BloquePlan, type DatosPlan, type ResultadoPlan,
} from './contratoPlan';

const boton = 'min-h-11 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] disabled:cursor-wait disabled:opacity-50';
const fecha = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', weekday: 'short', day: 'numeric', month: 'short' });
const hora = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });

function ListaBloques({ bloques }: { bloques: readonly BloquePlan[] }) {
  return <ul className="space-y-2">
    {bloques.map((b, i) => <li key={i} className="rounded-xl border border-[#E0D6EE] bg-[#F2EDF8] p-3 text-sm text-[#514369]">
      <p className="font-semibold">{b.tipo === 'repaso' ? 'Repaso' : 'Estudio'}</p>
      <p><time dateTime={b.inicio}>{fecha.format(new Date(b.inicio))} · {hora.format(new Date(b.inicio))}</time>
        {' – '}<time dateTime={b.fin}>{hora.format(new Date(b.fin))}</time>
        {fecha.format(new Date(b.inicio)) !== fecha.format(new Date(b.fin)) && <> ({fecha.format(new Date(b.fin))})</>}
      </p>
    </li>)}
  </ul>;
}

export default function PanelPlanEstudio({ tareaId, titulo, onCerrar }: {
  tareaId: string; titulo: string; onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const solicitud = useRef(false);
  const controlador = useRef<AbortController | null>(null);
  const montado = useRef(true);
  const tituloId = useId();
  const [datos, setDatos] = useState<DatosPlan | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<'guardar' | 'eliminar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [choques, setChoques] = useState<ResultadoPlan['choques']>([]);
  const [guardadoReciente, setGuardadoReciente] = useState(false);
  const ocupada = cargando || accion !== null;

  useEffect(() => {
    montado.current = true;
    dialogo.current?.showModal();
    return () => {
      montado.current = false;
      controlador.current?.abort();
    };
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    controlador.current = abort;
    void cargarPlan(tareaId, abort.signal).then((plan) => {
      if (!abort.signal.aborted) { setDatos(plan); setCargando(false); }
    }).catch((e: unknown) => {
      if (!abort.signal.aborted) { setError(e instanceof Error ? e.message : 'No se pudo consultar el plan.'); setCargando(false); }
    });
    return () => abort.abort();
  }, [tareaId]);

  async function consultar() {
    controlador.current?.abort();
    const abort = new AbortController();
    controlador.current = abort;
    setCargando(true);
    setError(null);
    try {
      const plan = await cargarPlan(tareaId, abort.signal);
      if (!abort.signal.aborted) { setDatos(plan); setGuardadoReciente(false); setChoques([]); }
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo consultar el plan.');
    } finally {
      if (!abort.signal.aborted) setCargando(false);
    }
  }

  async function ejecutar(tipo: 'guardar' | 'eliminar') {
    if (solicitud.current || ocupada || !datos || error) return;
    solicitud.current = true;
    setAccion(tipo);
    setError(null);
    setMensaje(null);
    try {
      if (tipo === 'guardar') {
        const resultado = await guardarPlan(tareaId, datos.propuesta.bloques);
        if (!montado.current) return;
        setDatos({ ...datos, guardado: resultado.bloques, conflictos: [] });
        setChoques(resultado.choques);
        setGuardadoReciente(true);
        setMensaje(resultado.choques.length ? 'Plan guardado con advertencias' : resultado.resumen);
      } else {
        await eliminarPlan(tareaId);
        if (!montado.current) return;
        setDatos({ ...datos, guardado: [], conflictos: [] });
        setChoques([]);
        setMensaje('Plan eliminado. La tarea se conserva.');
        await consultar();
      }
    } catch (e) {
      if (!montado.current) return;
      if (e instanceof ErrorPlan && e.status === 200) {
        setGuardadoReciente(true);
        if (tipo === 'eliminar') setDatos({ ...datos, guardado: [], conflictos: [] });
      }
      setError(e instanceof Error ? e.message : 'No se pudo conectar. Conservamos el panel para que puedas reintentar.');
    } finally {
      solicitud.current = false;
      if (montado.current) setAccion(null);
    }
  }

  return <dialog ref={dialogo} aria-labelledby={tituloId}
    onClose={onCerrar}
    onCancel={(e) => { if (solicitud.current) e.preventDefault(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-[#E4E8DF] bg-[#FAFBF7] p-5 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35">
    <div className="space-y-4" aria-busy={ocupada}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={tituloId} className="text-xl font-semibold">Planificar estudio</h2>
          <p className="mt-1 break-words text-sm">{datos?.tarea.titulo ?? titulo}</p>
        </div>
        <button type="button" disabled={accion !== null} className={boton + ' text-[#35695D]'} onClick={() => { if (!solicitud.current) dialogo.current?.close(); }}>Cerrar</button>
      </header>
      {cargando && <p role="status" className="text-sm text-[#35695D]">Consultando tu plan…</p>}
      {mensaje && <p role="status" className="rounded-xl bg-[#E7F8EF] p-3 text-sm text-[#1F5D50]">{mensaje}</p>}
      {error && <div role="alert" className="space-y-2 rounded-xl bg-[#FCF0F1] p-3 text-sm text-[#A34955]">
        <p>{error}</p>
        <button type="button" disabled={ocupada} className={boton + ' underline'} onClick={() => void consultar()}>Volver a consultar</button>
      </div>}
      {datos && !cargando && <>
        <p className="text-sm text-[#647168]">Horas sugeridas: ~{datos.tarea.horas} h · Fecha de la actividad: {fecha.format(new Date(datos.tarea.fechaLimite))}</p>
        <section aria-label="Plan guardado" className="space-y-2">
          <h3 className="text-sm font-semibold">Plan guardado</h3>
          {datos.guardado.length ? <ListaBloques bloques={datos.guardado} /> : <p className="text-sm text-[#647168]">Todavía no hay bloques guardados.</p>}
        </section>
        {datos.conflictos.length > 0 && <section aria-label="Conflictos detectados" className="rounded-xl bg-[#FCF2DE] p-3 text-sm text-[#916820]">
          <h3 className="font-semibold">Conflictos del plan guardado</h3>
          <ul className="mt-1 space-y-1">{datos.conflictos.map((c) => <li key={c.id}>{c.motivo}</li>)}</ul>
        </section>}
        <section aria-label="Propuesta de estudio" className="space-y-2">
          <h3 className="text-sm font-semibold">Propuesta de estudio</h3>
          {datos.propuesta.aviso && <p className="rounded-xl bg-[#FCF2DE] p-3 text-sm text-[#916820]">{datos.propuesta.aviso}</p>}
          {datos.propuesta.bloques.length ? <ListaBloques bloques={datos.propuesta.bloques} /> : <p className="text-sm text-[#647168]">No hay bloques propuestos para guardar.</p>}
        </section>
        {datos.guardado.length > 0 && !guardadoReciente && <p className="text-xs text-[#647168]">Guardar esta propuesta reemplazará los bloques futuros del plan guardado.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupada || !!error || guardadoReciente || datos.propuesta.bloques.length === 0} className={boton + ' bg-[#234F45] text-white'} onClick={() => void ejecutar('guardar')}>
            {accion === 'guardar' ? 'Guardando…' : guardadoReciente ? 'Plan guardado' : 'Guardar plan'}
          </button>
          {datos.guardado.length > 0 && <button type="button" disabled={ocupada || !!error} className={boton + ' text-[#A34955]'} onClick={() => void ejecutar('eliminar')}>
            {accion === 'eliminar' ? 'Eliminando…' : 'Eliminar plan'}
          </button>}
        </div>
      </>}
      {choques.length > 0 && <section aria-label="Advertencias del plan guardado" className="rounded-xl bg-[#FCF2DE] p-3 text-sm text-[#916820]">
        <ul className="space-y-1">{choques.map((c, i) => <li key={i}>{fecha.format(new Date(c.inicio))} · {hora.format(new Date(c.inicio))}: se cruza con {c.titulo}</li>)}</ul>
      </section>}
    </div>
  </dialog>;
}
