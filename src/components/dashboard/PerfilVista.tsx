'use client';

import { useEffect, useState } from 'react';
import IconoDashboard from './IconoDashboard';
import { useAgendaRango } from '../calendario/useAgendaRango';
import { lunesDeSemana, sumarDias } from '../calendario/agendaSemana';
import { leerTareasConPrioridad } from '../calendario/agendaDia';
import { AGENDA_ACTUALIZADA } from '../calendario/actualizacionAgenda';
import { contarPendientes, leerMateriasPerfil, resumirSemana } from './resumenPerfil';

type Consulta<T> = { datos: T | null; error: boolean };

function useConsultaPerfil<T>(url: string, leer: (valor: unknown) => T) {
  const [carga, establecerCarga] = useState<Consulta<T> | null>(null);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    const actualizar = () => establecerRevision((valor) => valor + 1);
    window.addEventListener(AGENDA_ACTUALIZADA, actualizar);
    return () => window.removeEventListener(AGENDA_ACTUALIZADA, actualizar);
  }, []);
  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      try {
        const respuesta = await fetch(url, { signal: controlador.signal, cache: 'no-store' });
        if (!respuesta.ok) throw new Error('No se pudo cargar.');
        const datos = leer(await respuesta.json());
        if (!controlador.signal.aborted) establecerCarga({ datos, error: false });
      } catch {
        if (!controlador.signal.aborted) establecerCarga({ datos: null, error: true });
      }
    }
    void cargar();
    return () => controlador.abort();
  }, [url, leer, revision]);
  return { carga, reintentar: () => establecerRevision((valor) => valor + 1) };
}

const tarjeta = 'min-w-0 rounded-[20px] border border-[#EBEEE6] bg-white p-5 shadow-[0_3px_14px_rgba(38,61,52,0.035)] md:p-6';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';
const boton = 'min-h-11 rounded-xl px-3 text-sm font-medium text-[#35695D] underline underline-offset-4 ' + foco;

function leerPendientes(valor: unknown) {
  return contarPendientes(leerTareasConPrioridad(valor));
}

export default function PerfilVista({ nombre, correo, fechaActual, cerrarSesionAction }: {
  nombre: string | null; correo: string | null; fechaActual: string; cerrarSesionAction: () => Promise<void>;
}) {
  const lunes = lunesDeSemana(new Date(fechaActual));
  const agenda = useAgendaRango(lunes, sumarDias(lunes, 6));
  const materias = useConsultaPerfil('/api/materias', leerMateriasPerfil);
  const pendientes = useConsultaPerfil('/api/tareas', leerPendientes);
  const resumen = agenda.agenda ? resumirSemana(agenda.agenda, lunes) : null;
  const iniciales = nombre?.split(/\s+/).slice(0, 2).map((parte) => Array.from(parte)[0]).join('').toLocaleUpperCase('es');

  return (
    <div className="mx-auto max-w-3xl space-y-6 [overflow-wrap:anywhere]">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">Perfil</h1>
      <section aria-label="Datos del perfil" className={tarjeta + ' flex flex-col items-center text-center'}>
        <div aria-hidden="true" className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF0E5] text-2xl font-semibold text-[#245B4C]">
          {iniciales || <IconoDashboard nombre="perfil" className="h-9 w-9" />}
        </div>
        {nombre && <h2 className="max-w-full text-xl font-semibold">{nombre}</h2>}
        {correo && <p className={'max-w-full text-sm leading-6 text-[#647168]' + (nombre ? ' mt-1' : '')}>{correo}</p>}
        {!nombre && !correo && <p className="text-sm text-[#647168]">No se pudieron obtener los datos de tu cuenta.</p>}
      </section>

      <div className="grid min-w-0 items-start gap-6 md:grid-cols-2">
        <section aria-labelledby="perfil-resumen" className={tarjeta}>
          <h2 id="perfil-resumen" className="text-lg font-semibold">Resumen</h2>
          <p className="mt-1 text-xs leading-5 text-[#647168]">Semana actual · lunes a domingo</p>
          <dl className="mt-4 divide-y divide-[#EBEEE6] text-sm">
            {[
              ['Actividades esta semana', resumen?.actividades ?? (agenda.cargando ? 'Cargando…' : 'No disponible')],
              ['Tareas pendientes', pendientes.carga?.datos ?? (pendientes.carga?.error ? 'No disponible' : 'Cargando…')],
              ['Horas de estudio planificadas', resumen?.horas ?? (agenda.cargando ? 'Cargando…' : 'No disponible')],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <dt className="min-w-0 flex-1 text-[#647168]">{etiqueta}</dt>
                <dd className="font-semibold tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>
          {agenda.cargando && <p role="status" className="text-xs text-[#647168]">Cargando agenda semanal…</p>}
          {agenda.error && <div role="alert" className="mt-2 text-xs leading-5 text-[#A34955]">
            <p>No se pudo cargar la agenda semanal.</p>
            <button type="button" onClick={agenda.recargar} className={boton}>Reintentar agenda</button>
          </div>}
          {pendientes.carga?.error && <div role="alert" className="mt-2 text-xs leading-5 text-[#A34955]">
            <p>No se pudieron cargar las tareas pendientes.</p>
            <button type="button" onClick={pendientes.reintentar} className={boton}>Reintentar tareas</button>
          </div>}
        </section>

        <section aria-labelledby="perfil-materias" className={tarjeta}>
          <h2 id="perfil-materias" className="text-lg font-semibold">Materias</h2>
          {!materias.carga && <p role="status" className="mt-4 text-sm text-[#647168]">Cargando materias…</p>}
          {materias.carga?.error && <div role="alert" className="mt-4 text-xs leading-5 text-[#A34955]">
            <p>No se pudieron cargar las materias.</p>
            <button type="button" onClick={materias.reintentar} className={boton}>Reintentar materias</button>
          </div>}
          {materias.carga?.datos?.length === 0 && <p className="mt-4 text-sm leading-6 text-[#647168]">No tienes materias registradas todavía.</p>}
          {!!materias.carga?.datos?.length && <ul className="mt-3 divide-y divide-[#EBEEE6]">
            {materias.carga.datos.map((materia) => <li key={materia.id} className="flex min-w-0 items-center gap-3 py-3 text-sm">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: materia.color }} />
              <span className="min-w-0">{materia.nombre}</span>
            </li>)}
          </ul>}
        </section>
      </div>

      <form action={cerrarSesionAction} className="pt-2">
        <button type="submit" className={'min-h-11 w-full rounded-xl bg-[#234F45] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#316457] ' + foco}>Cerrar sesión</button>
      </form>
    </div>
  );
}
