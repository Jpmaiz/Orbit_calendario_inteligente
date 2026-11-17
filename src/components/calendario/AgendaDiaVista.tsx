'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TarjetaTarea from './TarjetaTarea';
import OrbitaDelDia from './OrbitaDelDia';
import LineaHoy from './LineaHoy';
import { AGENDA_ACTUALIZADA } from './actualizacionAgenda';
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

export default function AgendaDiaVista({ fechaActual }: { fechaActual: string }) {
  const router = useRouter();
  const [carga, establecerCarga] = useState<Carga | null>(null);
  const hoy = diaEnBolivia(new Date(fechaActual));
  const [revision, establecerRevision] = useState(0);

  useEffect(() => {
    const actualizar = () => establecerRevision((valor) => valor + 1);
    window.addEventListener(AGENDA_ACTUALIZADA, actualizar);
    return () => window.removeEventListener(AGENDA_ACTUALIZADA, actualizar);
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      const [agenda, tareas] = await Promise.allSettled([
        // Desde ayer ("Ya pasaron") hasta mañana (lo primero de mañana en la órbita del día).
        consultar('/api/agenda?desde=' + sumarDias(hoy, -1) + '&hasta=' + sumarDias(hoy, 1), leerAgenda, controlador.signal),
        consultar('/api/tareas', leerTareasConPrioridad, controlador.signal),
      ]);
      if (controlador.signal.aborted) return;
      const errores: string[] = [];
      if (agenda.status === 'rejected') errores.push('Agenda: ' + (agenda.reason instanceof Error ? agenda.reason.message : 'No se pudo cargar.'));
      if (tareas.status === 'rejected') errores.push('Tareas: ' + (tareas.reason instanceof Error ? tareas.reason.message : 'No se pudieron cargar.'));
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
  const secciones = organizarTareasDia(combinadas.tareas, new Date(fechaActual))
    .filter((seccion) => seccion.tareas.length > 0);

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      {carga.agenda && <OrbitaDelDia agenda={carga.agenda} />}
      {(carga.errores.length > 0 || combinadas.sinPrioridad > 0) && (
        <div role="alert" className="space-y-2 rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">
          {carga.errores.map((mensaje) => <p key={mensaje}>{mensaje}</p>)}
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
