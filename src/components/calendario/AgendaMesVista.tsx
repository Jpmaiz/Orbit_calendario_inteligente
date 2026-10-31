'use client';

import { useState } from 'react';
import { diaEnBolivia } from './organizarTareasDia';
import { inicioDiaBolivia, lunesDeSemana, organizarSemana, sumarDias } from './agendaSemana';
import { useAgendaRango } from './useAgendaRango';
import SelectorCalendario from './SelectorCalendario';
import {
  botonCalendario, diasCortos, EstadoAgenda, fechaCompleta, LeyendaCalendario,
  TarjetaActividad, TareaSinHora, tiposActividad,
} from './presentacionCalendario';

const formatoMes = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', month: 'long', year: 'numeric',
});

function primerDiaMes(fecha: string, desplazamiento = 0) {
  const resultado = new Date(fecha.slice(0, 7) + '-01T12:00:00Z');
  resultado.setUTCMonth(resultado.getUTCMonth() + desplazamiento);
  return resultado.toISOString().slice(0, 10);
}

export default function AgendaMesVista({ fechaActual }: { fechaActual: string }) {
  const [seleccion, establecerSeleccion] = useState(() => {
    const hoy = diaEnBolivia(new Date(fechaActual));
    return { mes: primerDiaMes(hoy), dia: hoy, hoy };
  });
  const desde = lunesDeSemana(inicioDiaBolivia(seleccion.mes));
  const ultimoDia = sumarDias(primerDiaMes(seleccion.mes, 1), -1);
  const hasta = sumarDias(lunesDeSemana(inicioDiaBolivia(ultimoDia)), 6);
  const semanas = Math.round((inicioDiaBolivia(hasta).getTime() - inicioDiaBolivia(desde).getTime()) / 86400000 + 1) / 7;
  const carga = useAgendaRango(desde, hasta);
  const dias = carga.agenda ? Array.from({ length: semanas }, (_, indice) =>
    organizarSemana(carga.agenda!, sumarDias(desde, indice * 7))).flat() : null;
  const diaSeleccionado = dias?.find(({ fecha }) => fecha === seleccion.dia);

  function moverMes(cantidad: number) {
    establecerSeleccion((actual) => {
      const mes = primerDiaMes(actual.mes, cantidad);
      return { ...actual, mes, dia: mes };
    });
  }

  return <section aria-label="Agenda mensual" className="min-w-0 space-y-5">
    <SelectorCalendario vista="mes" />
    <section aria-labelledby="titulo-mes" className="rounded-[28px] border border-[#E2EAE3] bg-white p-4 shadow-[0_6px_28px_#244F4505] sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="titulo-mes" aria-live="polite" className="text-2xl font-semibold capitalize tracking-tight text-[#2D5749] sm:text-3xl">{formatoMes.format(inicioDiaBolivia(seleccion.mes)).replace(' de ', ' ')}</h1>
        <nav aria-label="Cambiar mes" className="flex gap-2">
          <button type="button" className={botonCalendario} aria-label="Mes anterior" onClick={() => moverMes(-1)}>‹</button>
          <button type="button" className={botonCalendario} onClick={() => {
            const hoy = diaEnBolivia(new Date());
            establecerSeleccion({ mes: primerDiaMes(hoy), dia: hoy, hoy });
          }}>Hoy</button>
          <button type="button" className={botonCalendario} aria-label="Mes siguiente" onClick={() => moverMes(1)}>›</button>
        </nav>
      </header>
      <div className="mt-6 grid grid-cols-7 gap-1" aria-hidden="true">
        {diasCortos.map((nombre, indice) => <span key={indice} className="py-2 text-center text-xs font-semibold text-[#7B8D81]">{nombre}</span>)}
      </div>
      <div role="group" aria-label="Seleccionar día del mes" className="grid grid-cols-7 gap-1">
        {Array.from({ length: semanas * 7 }, (_, indice) => {
          const fecha = sumarDias(desde, indice);
          const activo = fecha === seleccion.dia;
          const hoy = fecha === seleccion.hoy;
          const fuera = fecha.slice(0, 7) !== seleccion.mes.slice(0, 7);
          const dia = dias?.[indice];
          const tipos = tiposActividad.filter(({ tipo }) => dia?.bloques.some((bloque) => bloque.tipo === tipo) || (tipo === 'tarea' && !!dia?.sinHora.length));
          const etiqueta = fechaCompleta.format(inicioDiaBolivia(fecha)) + (tipos.length ? ': ' + tipos.map(({ nombre }) => nombre).join(', ') : '');
          return <button key={fecha} type="button" aria-label={etiqueta} aria-pressed={activo} aria-current={hoy ? 'date' : undefined}
            onClick={() => establecerSeleccion((actual) => ({ ...actual, dia: fecha }))}
            className={'flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] sm:min-h-20 ' +
              (activo ? 'bg-[#EDF4EE]' : 'hover:bg-[#F6F8F4]')}>
            <span className={'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ' +
              (activo || hoy ? 'bg-[#245C52] text-white ' : fuera ? 'text-[#ADB8AF] ' : 'text-[#3F6151] ') + (hoy && !activo ? 'ring-2 ring-[#C9DFD1] ring-offset-2' : '')}>
              {Number(fecha.slice(-2))}
            </span>
            <span aria-hidden="true" className="flex h-1.5 gap-1">{tipos.map(({ tipo, color }) => <span key={tipo} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />)}</span>
          </button>;
        })}
      </div>
      <div className="mt-5 border-t border-[#EDF1EC] pt-4"><LeyendaCalendario /></div>
    </section>
    <EstadoAgenda {...carga} />
    {diaSeleccionado && <section aria-labelledby="fecha-seleccionada" className="space-y-5 rounded-[28px] border border-[#E2EAE3] bg-white p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="fecha-seleccionada" aria-live="polite" className="text-base font-semibold capitalize text-[#365D4D]">
            <time dateTime={seleccion.dia}>{fechaCompleta.format(inicioDiaBolivia(seleccion.dia))}</time>
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#EDF4EE] px-3 py-1.5 text-xs text-[#426957]">{diaSeleccionado.bloques.length + diaSeleccionado.sinHora.length} actividades</span>
      </header>
      {diaSeleccionado.bloques.length + diaSeleccionado.sinHora.length === 0 && <p className="text-sm text-[#6B8072]">No tienes actividades para este día.</p>}
      {tiposActividad.map(({ tipo, nombre }) => {
        const bloques = diaSeleccionado.bloques.filter((bloque) => bloque.tipo === tipo);
        const sinHora = tipo === 'tarea' ? diaSeleccionado.sinHora : [];
        if (bloques.length + sinHora.length === 0) return null;
        return <section key={tipo} aria-label={nombre} className="space-y-2">
          <h3 className="text-xs font-semibold text-[#6B8072]">{nombre}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {bloques.map((bloque) => <li key={bloque.id}><TarjetaActividad bloque={bloque} mostrarTipo={false} /></li>)}
            {sinHora.map((tarea) => <li key={tarea.id}><TareaSinHora tarea={tarea} mostrarTipo={false} /></li>)}
          </ul>
        </section>;
      })}
    </section>}
  </section>;
}
