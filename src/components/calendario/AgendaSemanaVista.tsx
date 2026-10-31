'use client';

import { useState } from 'react';
import { diaEnBolivia } from './organizarTareasDia';
import { inicioDiaBolivia, lunesDeSemana, organizarSemana, sumarDias } from './agendaSemana';
import { useAgendaRango } from './useAgendaRango';
import SelectorCalendario from './SelectorCalendario';
import {
  botonCalendario, diasCortos, distribuirHorario, EstadoAgenda, fechaCompleta,
  LeyendaCalendario, TarjetaActividad, TareaSinHora,
} from './presentacionCalendario';

const formatoFecha = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', day: 'numeric', month: 'short', year: 'numeric',
});

export default function AgendaSemanaVista({ fechaActual }: { fechaActual: string }) {
  const [seleccion, establecerSeleccion] = useState(() => ({
    lunes: lunesDeSemana(new Date(fechaActual)), hoy: diaEnBolivia(new Date(fechaActual)),
    dia: diaEnBolivia(new Date(fechaActual)),
  }));
  const domingo = sumarDias(seleccion.lunes, 6);
  const carga = useAgendaRango(seleccion.lunes, domingo);
  const dias = carga.agenda ? organizarSemana(carga.agenda, seleccion.lunes) : null;
  const dia = dias?.find(({ fecha }) => fecha === seleccion.dia);
  const horario = dia ? distribuirHorario(dia.bloques, dia.fecha) : null;

  function moverSemana(cantidad: number) {
    establecerSeleccion((actual) => ({ ...actual,
      lunes: sumarDias(actual.lunes, cantidad), dia: sumarDias(actual.dia, cantidad),
    }));
  }

  return <section aria-label="Agenda semanal" className="min-w-0 space-y-5">
    <SelectorCalendario vista="semana" />
    <div className="rounded-[28px] border border-[#E2EAE3] bg-white p-4 shadow-[0_6px_28px_#244F4505] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 aria-live="polite" className="text-sm font-semibold text-[#3F6658] sm:text-base">
          <time dateTime={seleccion.lunes}>{formatoFecha.format(inicioDiaBolivia(seleccion.lunes))}</time>
          {' – '}<time dateTime={domingo}>{formatoFecha.format(inicioDiaBolivia(domingo))}</time>
        </h2>
        <nav aria-label="Cambiar semana" className="flex gap-2">
          <button type="button" className={botonCalendario} onClick={() => moverSemana(-7)} aria-label="Semana anterior">‹</button>
          <button type="button" className={botonCalendario} onClick={() => {
            const ahora = new Date();
            const hoy = diaEnBolivia(ahora);
            establecerSeleccion({ lunes: lunesDeSemana(ahora), hoy, dia: hoy });
          }}>Semana actual</button>
          <button type="button" className={botonCalendario} onClick={() => moverSemana(7)} aria-label="Semana siguiente">›</button>
        </nav>
      </div>
      <div role="group" aria-label="Seleccionar día de la semana" className="mt-6 grid grid-cols-7 gap-1">
        {diasCortos.map((nombre, indice) => {
          const fecha = sumarDias(seleccion.lunes, indice);
          const activo = seleccion.dia === fecha;
          const hoy = seleccion.hoy === fecha;
          return <button key={fecha} type="button" aria-pressed={activo} aria-current={hoy ? 'date' : undefined}
            aria-label={fechaCompleta.format(inicioDiaBolivia(fecha))} onClick={() => establecerSeleccion((actual) => ({ ...actual, dia: fecha }))}
            className={'flex min-h-20 min-w-0 flex-col items-center gap-2 rounded-2xl py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] ' + (activo ? 'bg-[#EFF5EF]' : 'hover:bg-[#F6F8F4]')}>
            <span className="text-xs font-medium text-[#7B8D81]">{nombre}</span>
            <span className={'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ' +
              (hoy ? 'bg-[#245C52] text-white' : activo ? 'bg-[#DCEBE2] text-[#245C52]' : 'text-[#436253]')}>{Number(fecha.slice(-2))}</span>
          </button>;
        })}
      </div>
    </div>
    <h3 aria-live="polite" className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#557565]">
      <time dateTime={seleccion.dia}>{fechaCompleta.format(inicioDiaBolivia(seleccion.dia))}</time>
    </h3>
    <LeyendaCalendario />
    <EstadoAgenda {...carga} />
    {dia && horario && <>
      {dia.sinHora.length > 0 && <section aria-labelledby="sin-hora" className="space-y-3 rounded-3xl border border-[#E2EAE3] bg-white p-4 sm:p-5">
        <h3 id="sin-hora" className="text-sm font-semibold text-[#426757]">Sin hora <span className="ml-1 text-xs font-normal text-[#7B8D81]">{dia.sinHora.length}</span></h3>
        <ul className="grid gap-3 sm:grid-cols-2">{dia.sinHora.map((tarea) => <li key={tarea.id}><TareaSinHora tarea={tarea} /></li>)}</ul>
      </section>}
      <section aria-label="Horario del día seleccionado" className="rounded-3xl border border-[#E2EAE3] bg-white p-3 sm:p-5">
        {dia.bloques.length === 0 && <p className="mb-4 rounded-2xl bg-[#F3F7F1] px-4 py-3 text-sm text-[#6A7F70]">Sin actividades con hora para este día.</p>}
        <div className="overflow-x-auto pb-2" tabIndex={0} aria-label="Horario; desplaza horizontalmente si hay actividades simultáneas">
          <div className="relative ml-12" style={{ height: horario.altura, minWidth: Math.max(180, horario.carriles * 158) }}>
            {Array.from({ length: horario.ultimaHora - horario.primeraHora + 1 }, (_, indice) => horario.primeraHora + indice).map((hora) =>
              <div key={hora} aria-hidden="true" className="absolute inset-x-0 border-t border-[#EDF1EC]" style={{ top: (hora - horario.primeraHora) * 60 * horario.escala }}>
                <span className="absolute -left-12 -top-2 w-10 text-[10px] tabular-nums text-[#86958A]">{String(hora).padStart(2, '0')}:00</span>
              </div>)}
            <ol aria-label="Actividades ordenadas por hora">
              {horario.bloques.map(({ bloque, top, height, carril, hasta }) => <li key={bloque.id}
                className={'absolute pr-2 ' + (hasta === null ? 'border-t-2 border-dotted border-[#84A897]' : '')}
                style={{ top, height, left: `${carril / horario.carriles * 100}%`, width: `${100 / horario.carriles}%` }}>
                <TarjetaActividad bloque={bloque} />
              </li>)}
            </ol>
          </div>
        </div>
      </section>
    </>}
  </section>;
}
