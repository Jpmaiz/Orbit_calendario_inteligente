'use client';

import { useEffect, useState } from 'react';
import { leerAgenda, type AgendaDia, type TareaAgenda } from './agendaDia';
import { diaEnBolivia } from './organizarTareasDia';
import {
  formatoHoraBolivia, inicioDiaBolivia, lunesDeSemana, organizarSemana, sumarDias,
  type BloqueSemana,
} from './agendaSemana';

const formatoFecha = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', day: 'numeric', month: 'short', year: 'numeric',
});
const formatoDia = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', weekday: 'long', day: 'numeric', month: 'short',
});
const formatoEvento = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', day: 'numeric', month: 'short', hour: '2-digit',
  minute: '2-digit', hourCycle: 'h23',
});
const boton = 'min-h-11 rounded-xl border border-[#DEE6DA] bg-white px-3 text-sm font-medium text-[#35695D] hover:bg-[#E9EEE5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] disabled:opacity-50';
const estados: Record<string, string> = {
  pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada', no_realizada: 'No realizada',
};

function DatosTarea({ tarea }: { tarea: TareaAgenda }) {
  return (
    <p className="mt-2 text-xs text-[#75816F]">
      {estados[tarea.estado] ?? tarea.estado}
    </p>
  );
}

function Bloque({ bloque }: { bloque: BloqueSemana }) {
  const datos = bloque.datos;
  const color = bloque.tipo === 'clase' ? '#7AB8D6' : bloque.tipo === 'evento' ? '#E6B15B' : '#91B88B';
  return (
    <article className="min-w-0 rounded-xl border border-[#EBEEE6] border-l-4 bg-white p-3 [overflow-wrap:anywhere]" style={{ borderLeftColor: color }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#657360]">
        {bloque.tipo === 'clase' ? 'Clase' : bloque.tipo === 'evento' ? 'Evento' : 'Tarea'}
      </p>
      <h4 className="mt-1 text-sm font-semibold leading-5">{datos.titulo}</h4>
      <p className="mt-1 text-xs leading-5 text-[#526A5A]">
        {bloque.tipo === 'clase' && <>{bloque.datos.horaInicio} – {bloque.datos.horaFin}</>}
        {bloque.tipo === 'tarea' && <time dateTime={bloque.datos.fechaLimite.toISOString()}>{formatoHoraBolivia.format(bloque.datos.fechaLimite)}</time>}
        {bloque.tipo === 'evento' && <>
          <time dateTime={bloque.datos.inicio.toISOString()}>{formatoEvento.format(bloque.datos.inicio)}</time>
          {bloque.datos.fin && <> – <time dateTime={bloque.datos.fin.toISOString()}>{formatoEvento.format(bloque.datos.fin)}</time></>}
        </>}
      </p>
      {datos.materia && <p className="mt-2 flex items-center gap-1.5 text-xs text-[#75816F]">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: datos.materia.color }} />
        {datos.materia.nombre}
      </p>}
      {'ubicacion' in datos && datos.ubicacion && <p className="mt-1 text-xs text-[#75816F]">{datos.ubicacion}</p>}
      {bloque.tipo === 'tarea' && <DatosTarea tarea={bloque.datos} />}
    </article>
  );
}

type Carga = { clave: string; agenda: AgendaDia | null; error: string | null };

export default function AgendaSemanaVista({ fechaActual }: { fechaActual: string }) {
  const [seleccion, establecerSeleccion] = useState(() => ({
    lunes: lunesDeSemana(new Date(fechaActual)), hoy: diaEnBolivia(new Date(fechaActual)),
  }));
  const [carga, establecerCarga] = useState<Carga | null>(null);
  const [intento, establecerIntento] = useState(0);
  const lunes = seleccion.lunes;
  const domingo = lunes ? sumarDias(lunes, 6) : '';
  const clave = lunes + ':' + intento;

  useEffect(() => {
    if (!lunes) return;
    const controlador = new AbortController();
    async function cargar() {
      try {
        const respuesta = await fetch('/api/agenda?desde=' + lunes + '&hasta=' + domingo, {
          signal: controlador.signal, cache: 'no-store',
        });
        const datos: unknown = await respuesta.json();
        if (!respuesta.ok) {
          const mensaje = typeof datos === 'object' && datos !== null && 'error' in datos &&
            typeof datos.error === 'string' ? datos.error : 'No se pudo cargar la semana.';
          throw new Error(mensaje);
        }
        const agenda = leerAgenda(datos);
        if (!controlador.signal.aborted) establecerCarga({ clave, agenda, error: null });
      } catch (error) {
        if (!controlador.signal.aborted) establecerCarga({
          clave, agenda: null,
          error: error instanceof Error ? error.message : 'No se pudo conectar con el servidor.',
        });
      }
    }
    void cargar();
    return () => controlador.abort();
  }, [lunes, domingo, clave]);

  const lista = carga?.clave === clave;
  const dias = lista && carga.agenda ? organizarSemana(carga.agenda, seleccion.lunes) : null;

  function moverSemana(dias: number) {
    establecerSeleccion((actual) => ({ ...actual, lunes: sumarDias(actual.lunes, dias) }));
  }

  return (
    <section aria-labelledby="rango-semana" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rango-semana" aria-live="polite" className="text-lg font-semibold tracking-[-0.02em]">
          <time dateTime={seleccion.lunes}>{formatoFecha.format(inicioDiaBolivia(seleccion.lunes))}</time>
          {' – '}
          <time dateTime={domingo}>{formatoFecha.format(inicioDiaBolivia(domingo))}</time>
        </h2>
        <nav aria-label="Cambiar semana" className="flex flex-wrap gap-2">
          <button type="button" className={boton} onClick={() => moverSemana(-7)} aria-label="Semana anterior">← Anterior</button>
          <button type="button" className={boton} onClick={() => {
            const ahora = new Date();
            establecerSeleccion({ lunes: lunesDeSemana(ahora), hoy: diaEnBolivia(ahora) });
          }}>Semana actual</button>
          <button type="button" className={boton} onClick={() => moverSemana(7)} aria-label="Semana siguiente">Siguiente →</button>
        </nav>
      </div>
      {!lista && <p role="status" className="text-sm text-[#35695D]">Cargando tu semana…</p>}
      {lista && carga.error && <div role="alert" className="rounded-xl border border-[#EED4D7] bg-[#FCF0F1] p-4 text-sm text-[#A34955]">
        <p>{carga.error}</p>
        <button type="button" className={boton + ' mt-3'} onClick={() => establecerIntento((valor) => valor + 1)}>Volver a cargar</button>
      </div>}
      {dias && <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dias.map((dia) => (
          <section key={dia.fecha} aria-labelledby={'dia-' + dia.fecha} className="min-w-0 space-y-3 rounded-[20px] border border-[#E3E8DE] bg-[#FAFBF7] p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={'dia-' + dia.fecha} className="text-sm font-semibold capitalize">
                <time dateTime={dia.fecha}>{formatoDia.format(inicioDiaBolivia(dia.fecha))}</time>
              </h3>
              {dia.fecha === seleccion.hoy && <span className="rounded-full bg-[#DCE8D5] px-2 py-1 text-xs font-semibold text-[#35695D]">Hoy</span>}
            </header>
            {dia.bloques.length > 0 && <ul className="space-y-3">
              {dia.bloques.map((bloque) => <li key={bloque.id}><Bloque bloque={bloque} /></li>)}
            </ul>}
            {dia.sinHora.length > 0 && <section aria-labelledby={'sin-hora-' + dia.fecha} className="space-y-2 border-t border-[#E3E8DE] pt-3">
              <h4 id={'sin-hora-' + dia.fecha} className="text-xs font-semibold text-[#657360]">Sin hora</h4>
              <ul className="space-y-2">
                {dia.sinHora.map((tarea) => <li key={tarea.id}>
                  <article className="min-w-0 rounded-xl border border-dashed border-[#D8E2D1] bg-white p-3 [overflow-wrap:anywhere]">
                    <p className="text-[10px] font-semibold uppercase text-[#657360]">Tarea</p>
                    <h5 className="mt-1 text-sm font-semibold">{tarea.titulo}</h5>
                    {tarea.materia && <p className="mt-1 text-xs text-[#75816F]">{tarea.materia.nombre}</p>}
                    <DatosTarea tarea={tarea} />
                  </article>
                </li>)}
              </ul>
            </section>}
            {dia.bloques.length === 0 && dia.sinHora.length === 0 && <p className="py-3 text-xs text-[#788174]">Sin actividades.</p>}
          </section>
        ))}
      </div>}
    </section>
  );
}
