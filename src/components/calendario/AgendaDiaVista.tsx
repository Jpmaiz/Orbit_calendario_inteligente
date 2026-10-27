'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TarjetaTarea from './TarjetaTarea';
import { AGENDA_ACTUALIZADA } from './actualizacionAgenda';
import { diaEnBolivia, organizarTareasDia } from './organizarTareasDia';
import {
  combinarTareas, horarioDelDia, leerAgenda, leerTareasConPrioridad,
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

const estiloTarjeta = 'relative min-w-0 overflow-hidden rounded-[20px] border border-[#EBEEE6] bg-white p-4 shadow-[0_3px_14px_rgba(38,61,52,0.035)] [overflow-wrap:anywhere] md:p-6';
const formatoEvento = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

function DatosHorario({ materia, ubicacion }: {
  materia: { nombre: string; color: string } | null; ubicacion: string | null;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#75816F]">
      {materia && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: materia.color }} />{materia.nombre}</span>}
      {ubicacion && <span>Ubicación: {ubicacion}</span>}
    </div>
  );
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
        consultar('/api/agenda?desde=' + hoy + '&hasta=' + hoy, leerAgenda, controlador.signal),
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
    return <p role="status" className="text-sm text-[#35695D]">Cargando tu agenda del día…</p>;
  }

  const combinadas = combinarTareas(carga.agenda?.tareas ?? [], carga.tareas ?? []);
  const tareasDisponibles = carga.agenda !== null || carga.tareas !== null;
  const secciones = organizarTareasDia(combinadas.tareas, new Date(fechaActual))
    .filter((seccion) => seccion.tareas.length > 0);
  const horario = carga.agenda ? horarioDelDia(carga.agenda, new Date(fechaActual)) : null;

  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      {(carga.errores.length > 0 || combinadas.sinPrioridad > 0) && (
        <div role="alert" className="space-y-2 rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">
          {carga.errores.map((mensaje) => <p key={mensaje}>{mensaje}</p>)}
          {combinadas.sinPrioridad > 0 && <p>Hay tareas del día sin prioridad calculada. Se muestran con sus datos de agenda.</p>}
          <button type="button" onClick={() => router.refresh()} className="min-h-11 rounded-lg px-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">Volver a cargar</button>
        </div>
      )}
      <section aria-labelledby="titulo-tareas" className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-tareas" className="text-lg font-semibold tracking-[-0.02em]">Tus tareas</h2>
          {tareasDisponibles && <span className="text-xs text-[#788174]">{combinadas.tareas.length} {combinadas.tareas.length === 1 ? 'tarea' : 'tareas'} en total</span>}
        </div>
        {tareasDisponibles && secciones.length === 0 && (
          <p className="text-xs leading-5 text-[#657360]">
            {combinadas.tareas.length === 0 ? 'Aún no tienes tareas.' : 'No hay tareas vencidas, para hoy, para los próximos 7 días ni completadas hoy.'}
          </p>
        )}
        {secciones.map((seccion) => (
          <section key={seccion.id} aria-labelledby={'titulo-' + seccion.id} className="min-w-0 space-y-3 md:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={'titulo-' + seccion.id} className="text-base font-semibold tracking-[-0.02em] text-[#233E33]">{seccion.titulo}</h3>
              <span className="text-xs text-[#788174]">{seccion.tareas.length} {seccion.tareas.length === 1 ? 'tarea' : 'tareas'}</span>
            </div>
            <ul className="min-w-0 space-y-3 md:space-y-4">
              {seccion.tareas.map((tarea) => (
                <li key={tarea.id}><TarjetaTarea tarea={{ ...tarea, fechaLimite: tarea.fechaLimite.toISOString() }} /></li>
              ))}
            </ul>
          </section>
        ))}
      </section>
      {horario && (
        <>
          <section aria-labelledby="titulo-clases" className="min-w-0 space-y-4">
            <h2 id="titulo-clases" className="text-lg font-semibold tracking-[-0.02em]">Clases de hoy</h2>
            {horario.clases.length === 0 && <p className="text-xs leading-5 text-[#657360]">No tienes clases vigentes para hoy.</p>}
            <ul className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4">
              {horario.clases.map((clase) => (
                <li key={clase.id}>
                  <article className={estiloTarjeta}>
                    <p className="mb-2 text-xs font-semibold text-[#346D8B]">Clase</p>
                    <h3 className="text-[15px] font-semibold leading-6 text-[#2C4236]">{clase.titulo}</h3>
                    <p className="mt-1 text-sm text-[#526A5A]">{clase.horaInicio} – {clase.horaFin}</p>
                    <DatosHorario materia={clase.materia} ubicacion={clase.ubicacion} />
                  </article>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="titulo-eventos" className="min-w-0 space-y-4">
            <h2 id="titulo-eventos" className="text-lg font-semibold tracking-[-0.02em]">Eventos de hoy</h2>
            {horario.eventos.length === 0 && <p className="text-xs leading-5 text-[#657360]">No tienes eventos para hoy.</p>}
            <ul className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4">
              {horario.eventos.map((evento) => (
                <li key={evento.id}>
                  <article className={estiloTarjeta}>
                    <p className="mb-2 text-xs font-semibold text-[#916820]">Evento</p>
                    <h3 className="text-[15px] font-semibold leading-6 text-[#2C4236]">{evento.titulo}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#526A5A]">
                      <time dateTime={evento.inicio.toISOString()}>{formatoEvento.format(evento.inicio)}</time>
                      {evento.fin && <> – <time dateTime={evento.fin.toISOString()}>{formatoEvento.format(evento.fin)}</time></>}
                    </p>
                    <DatosHorario materia={evento.materia} ubicacion={evento.ubicacion} />
                    {evento.descripcion && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#657360]">{evento.descripcion}</p>}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
