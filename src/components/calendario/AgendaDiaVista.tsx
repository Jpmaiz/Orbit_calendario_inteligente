'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TarjetaTarea from './TarjetaTarea';
import OrbitaDelDia from './OrbitaDelDia';
import LineaHoy from './LineaHoy';
import ComoEstasHoy from './ComoEstasHoy';
import { AGENDA_ACTUALIZADA } from './actualizacionAgenda';
import CargaFallida from '../pwa/CargaFallida';
import { mensajeError, SIN_RED } from '../pwa/errorRed';
import { diaEnBolivia, organizarTareasDia, sumarDias } from './organizarTareasDia';
import {
  combinarTareas, leerAgenda, leerTareasConPrioridad,
  type AgendaDia, type TareaDia,
} from './agendaDia';

type Carga = {
  fechaActual: string;
  agenda: AgendaDia | null;
  tareas: TareaDia[] | null;
  errores: string[];
};

async function consultar<T>(url: string, leer: (valor: unknown) => T, signal: AbortSignal): Promise<T> {
  const respuesta = await fetch(url, { signal, cache: 'no-store' });
  const datos: unknown = await respuesta.json();
  if (!respuesta.ok) {
    const mensaje = typeof datos === 'object' && datos !== null &&
      'error' in datos && typeof datos.error === 'string' ? datos.error : 'No se pudieron cargar los datos.';
    throw new Error(mensaje);
  }
  return leer(datos);
}

/** Datos que el servidor ya cargó (mismo formato que /api/agenda y /api/tareas). null = pedirlos aquí. */
function cargaInicial(fechaActual: string, inicial: { agenda: unknown; tareas: unknown } | null | undefined): Carga | null {
  if (!inicial) return null;
  try {
    return { fechaActual, errores: [], agenda: leerAgenda(inicial.agenda), tareas: leerTareasConPrioridad(inicial.tareas) };
  } catch {
    return null; // formato inesperado: se piden de nuevo
  }
}

export default function AgendaDiaVista({ fechaActual, inicial }: {
  fechaActual: string; inicial?: { agenda: unknown; tareas: unknown } | null;
}) {
  const router = useRouter();
  const [carga, establecerCarga] = useState<Carga | null>(() => cargaInicial(fechaActual, inicial));
  const hoy = diaEnBolivia(new Date(fechaActual));
  const [revision, establecerRevision] = useState(0);
  // Con datos del servidor, la primera carga ya está hecha: solo se vuelve a pedir si algo cambia
  const omitirPrimera = useRef(carga !== null);

  useEffect(() => {
    const actualizar = () => establecerRevision((valor) => valor + 1);
    window.addEventListener(AGENDA_ACTUALIZADA, actualizar);
    window.addEventListener('online', actualizar); // al volver internet, se trae lo nuevo
    return () => { window.removeEventListener(AGENDA_ACTUALIZADA, actualizar); window.removeEventListener('online', actualizar); };
  }, []);

  useEffect(() => {
    if (omitirPrimera.current) {
      omitirPrimera.current = false;
      return;
    }
    const controlador = new AbortController();
    async function cargar() {
      const [agenda, tareas] = await Promise.allSettled([
        // Desde ayer ("Ya pasaron") hasta mañana (lo primero de mañana en la órbita del día).
        consultar('/api/agenda?desde=' + sumarDias(hoy, -1) + '&hasta=' + sumarDias(hoy, 1), leerAgenda, controlador.signal),
        consultar('/api/tareas', leerTareasConPrioridad, controlador.signal),
      ]);
      if (controlador.signal.aborted) return;
      const errores: string[] = [];
      // Sin red: un solo SIN_RED (se muestra tranquilo, sin «Failed to fetch»)
      if (agenda.status === 'rejected') errores.push(mensajeError(agenda.reason) === SIN_RED ? SIN_RED : 'Agenda: ' + mensajeError(agenda.reason, 'No se pudo cargar.'));
      if (tareas.status === 'rejected') errores.push(mensajeError(tareas.reason) === SIN_RED ? SIN_RED : 'Tareas: ' + mensajeError(tareas.reason, 'No se pudieron cargar.'));
      establecerCarga({
        fechaActual, errores,
        agenda: agenda.status === 'fulfilled' ? agenda.value : null,
        tareas: tareas.status === 'fulfilled' ? tareas.value : null,
      });
    }
    void cargar();
    return () => controlador.abort();
  }, [fechaActual, hoy, revision]);

  if (!carga || carga.fechaActual !== fechaActual) {
    return <div className="space-y-4">
      <div aria-hidden="true" className="h-64 animate-pulse rounded-[30px] bg-[#ECEFE7] motion-reduce:animate-none" />
      <p role="status" className="text-sm text-[#647168]">Cargando tu día…</p>
    </div>;
  }

  const combinadas = combinarTareas(carga.agenda?.tareas ?? [], carga.tareas ?? []);
  const tareasDisponibles = carga.agenda !== null || carga.tareas !== null;
  const sinRed = carga.errores.includes(SIN_RED);
  const errores = carga.errores.filter((e) => e !== SIN_RED);
  const secciones = organizarTareasDia(combinadas.tareas, new Date(fechaActual))
    .filter((seccion) => seccion.tareas.length > 0);

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      <ComoEstasHoy fechaActual={fechaActual} />
      {carga.agenda && <OrbitaDelDia agenda={carga.agenda} />}
      {sinRed && <CargaFallida texto="No se pudo cargar tu día." error={SIN_RED} className="rounded-2xl bg-white px-5 py-4" />}
      {(errores.length > 0 || combinadas.sinPrioridad > 0) && (
        <div role="alert" className="space-y-2 rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">
          {errores.map((mensaje) => <p key={mensaje}>{mensaje}</p>)}
          {combinadas.sinPrioridad > 0 && <p>Hay tareas del día sin prioridad calculada. Se muestran con sus datos de agenda.</p>}
          <button type="button" onClick={() => router.refresh()} className="min-h-11 rounded-lg px-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">Volver a cargar</button>
        </div>
      )}
      {carga.agenda && <LineaHoy agenda={carga.agenda} />}
      <section aria-labelledby="titulo-tareas" className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-tareas" className="text-lg font-semibold tracking-[-0.02em]">Tus tareas</h2>
        </div>
        {tareasDisponibles && secciones.length === 0 && (
          <p className="text-xs leading-5 text-[#657360]">
            {combinadas.tareas.length === 0 ? 'Aún no tienes tareas.' : 'Nada pendiente para hoy ni para los próximos 7 días.'}
          </p>
        )}
        {secciones.map((seccion) => (
          <section key={seccion.id} aria-labelledby={'titulo-' + seccion.id} className="min-w-0 space-y-3 md:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={'titulo-' + seccion.id} className={'text-base font-semibold tracking-[-0.02em] ' + (seccion.id === 'pasaron' ? 'text-[#647168]' : 'text-[#233E33]')}>{seccion.titulo}</h3>
              {seccion.id !== 'pasaron' && <span className="text-xs text-[#788174]">{seccion.tareas.length} {seccion.tareas.length === 1 ? 'tarea' : 'tareas'}</span>}
            </div>
            <ul className={'min-w-0 ' + (seccion.id === 'pasaron' ? 'space-y-2' : 'space-y-3 md:space-y-4')}>
              {seccion.tareas.map((tarea) => (
                <li key={tarea.id}><TarjetaTarea tarea={{ ...tarea, fechaLimite: tarea.fechaLimite.toISOString() }} contexto={seccion.id === 'hoy' ? 'hoy' : seccion.id === 'sin-hora' ? 'sin-hora' : seccion.id === 'pasaron' ? 'pasaron' : undefined} /></li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  );
}
