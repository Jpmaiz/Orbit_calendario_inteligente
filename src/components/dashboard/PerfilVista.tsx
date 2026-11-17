'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AvatarPerfil from './AvatarPerfil';
import IconoDashboard from './IconoDashboard';
import EditarPerfil from './EditarPerfil';
import ConfirmarCerrarSesion from './ConfirmarCerrarSesion';
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

const tarjeta = 'min-w-0 rounded-3xl border border-[#E7ECE3] bg-white p-5 shadow-[0_4px_18px_rgba(38,61,52,0.04)] md:p-6';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';
const boton = 'min-h-11 rounded-xl px-3 text-sm font-medium text-[#35695D] underline underline-offset-4 ' + foco;

function leerPendientes(valor: unknown) {
  return contarPendientes(leerTareasConPrioridad(valor));
}

export default function PerfilVista({ nombre, correo, fotoUrl = null, fechaActual, cerrarSesionAction }: {
  nombre: string | null; correo: string | null; fotoUrl?: string | null; fechaActual: string; cerrarSesionAction: () => Promise<void>;
}) {
  const lunes = lunesDeSemana(new Date(fechaActual));
  const agenda = useAgendaRango(lunes, sumarDias(lunes, 6));
  const materias = useConsultaPerfil('/api/materias', leerMateriasPerfil);
  const pendientes = useConsultaPerfil('/api/tareas', leerPendientes);
  const resumen = agenda.agenda ? resumirSemana(agenda.agenda, lunes) : null;
  const router = useRouter();
  const [nombreGuardado, establecerNombreGuardado] = useState<string | null>(null);
  const [editor, establecerEditor] = useState<'nombre' | 'foto' | null>(null);
  const [confirmandoSalida, establecerConfirmandoSalida] = useState(false);
  const nombreActual = nombreGuardado ?? nombre;
  const nombreVisible = nombreActual?.trim() || correo;

  const indicadores = [
    { etiqueta: 'Actividades esta semana', valor: resumen?.actividades, cargando: agenda.cargando, icono: <IconoDashboard nombre="calendario" className="h-[18px] w-[18px]" /> },
    { etiqueta: 'Tareas pendientes', valor: pendientes.carga?.datos, cargando: !pendientes.carga, icono: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></svg> },
    { etiqueta: 'Horas de estudio planificadas', valor: resumen?.horas, cargando: agenda.cargando, icono: <IconoDashboard nombre="reloj" className="h-[18px] w-[18px]" /> },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-2 [overflow-wrap:anywhere] md:space-y-7">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">Perfil</h1>

      <section aria-label="Datos del perfil" className="relative isolate flex flex-col overflow-hidden rounded-3xl border border-[#DFE8D9] bg-white shadow-[0_6px_24px_rgba(38,61,52,0.05)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-br from-[#E0ECDA] via-[#EDF5E6] to-[#DCEDE6]">
          <span className="absolute -right-10 -top-20 h-60 w-60 rounded-full border border-white/60" />
          <span className="absolute -right-2 -top-12 h-44 w-44 rounded-full border border-white/50" />
        </div>
        <div className="hidden md:flex md:justify-end md:px-6 md:pt-3 md:pb-0">
          <div>
            <button type="button" onClick={() => establecerConfirmandoSalida(true)} aria-haspopup="dialog" className={'inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#CDDBCF] bg-white/50 px-3 py-2 text-xs font-medium text-[#52685C] transition-colors hover:bg-[#F4F8F0] hover:border-[#BCCFBE] ' + foco}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 4H5v16h4m0-8h12m-4-4 4 4-4 4" /></svg>
              Cerrar sesión
            </button>
          </div>
        </div>
        <div className="order-1 flex min-w-0 flex-col items-center gap-4 px-5 pt-6 pb-6 text-center md:order-none md:flex-row md:gap-5 md:px-7 md:pt-5 md:pb-7 md:text-left">
          <div className="relative shrink-0 rounded-full bg-white p-1.5 shadow-[0_5px_18px_rgba(38,61,52,0.08)]">
            <AvatarPerfil nombre={nombreActual} fotoUrl={fotoUrl} />
            <button type="button" aria-label="Editar perfil: foto" title="Editar foto de perfil" onClick={() => establecerEditor('foto')} className={'absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-[#234F45] text-white shadow-sm transition-colors hover:bg-[#316457] ' + foco}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M8 5l2-2h4l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="4" /></svg>
            </button>
          </div>
          <div className="min-w-0 max-w-full md:flex-1">
            {nombreVisible ? <h2 className="text-2xl leading-tight font-semibold tracking-[-0.035em] text-[#234F45] md:text-3xl">{nombreVisible}</h2> : <p className="text-sm leading-6 text-[#647168]">No se pudieron obtener los datos de tu cuenta.</p>}
            {nombreActual?.trim() && correo && <p className="mt-1.5 text-sm leading-6 text-[#718074]">{correo}</p>}
          <button type="button" onClick={() => establecerEditor('nombre')} className={'mt-3 inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-xl border border-[#8AA99B] bg-white/40 px-3 py-1.5 text-xs font-medium text-[#234F45] transition-colors hover:border-[#527867] hover:bg-[#EDF5E8] ' + foco}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" /></svg>
            Editar perfil
          </button>

          </div>
        </div>
      </section>
      <div className="grid min-w-0 items-start gap-5 md:grid-cols-2 md:gap-6">
        <section aria-labelledby="perfil-resumen" className={tarjeta}>
          <h2 id="perfil-resumen" className="text-lg font-semibold tracking-[-0.025em] text-[#234F45]">Resumen</h2>
          <p className="mt-1 text-xs leading-5 text-[#647168]">Semana actual · lunes a domingo</p>
          <dl className="mt-4 divide-y divide-[#EFF2EB]">
            {indicadores.map(({ etiqueta, valor, cargando, icono }) => (
              <div key={etiqueta} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-4 transition-colors hover:bg-[#F8FAF6]">
                <dt className="flex min-w-0 flex-1 items-center gap-2.5 text-sm leading-6 text-[#647168]">
                  <span aria-hidden="true" className="shrink-0 text-[#789380]">{icono}</span>
                  <span className="min-w-0">{etiqueta}</span>
                </dt>
                <dd className={valor != null ? 'max-w-[40%] shrink-0 text-right text-2xl leading-tight font-semibold tracking-tight text-[#234F45] tabular-nums' : 'max-w-[40%] shrink-0 text-right text-xs leading-5 text-[#647168]'}>{valor ?? (cargando ? 'Cargando…' : 'No disponible')}</dd>
              </div>
            ))}
          </dl>
          {agenda.cargando && <p role="status" className="mt-3 text-xs text-[#647168]">Cargando agenda semanal…</p>}
          {agenda.error && <div role="alert" className="mt-4 rounded-xl border border-[#EED4D7] bg-[#FCF5F5] p-3 text-xs leading-5 text-[#A34955]">
            <p>No se pudo cargar la agenda semanal.</p>
            <button type="button" onClick={agenda.recargar} className={boton}>Reintentar agenda</button>
          </div>}
          {pendientes.carga?.error && <div role="alert" className="mt-4 rounded-xl border border-[#EED4D7] bg-[#FCF5F5] p-3 text-xs leading-5 text-[#A34955]">
            <p>No se pudieron cargar las tareas pendientes.</p>
            <button type="button" onClick={pendientes.reintentar} className={boton}>Reintentar tareas</button>
          </div>}
        </section>

        <section aria-labelledby="perfil-materias" className={tarjeta}>
          <h2 id="perfil-materias" className="text-lg font-semibold tracking-[-0.025em] text-[#234F45]">Materias</h2>
          {!materias.carga && <p role="status" className="mt-4 rounded-xl bg-[#F8FAF5] p-4 text-sm text-[#647168]">Cargando materias…</p>}
          {materias.carga?.error && <div role="alert" className="mt-4 rounded-xl border border-[#EED4D7] bg-[#FCF5F5] p-3 text-xs leading-5 text-[#A34955]">
            <p>No se pudieron cargar las materias.</p>
            <button type="button" onClick={materias.reintentar} className={boton}>Reintentar materias</button>
          </div>}
          {materias.carga?.datos?.length === 0 && <div className="mt-4 rounded-xl bg-[#F8FAF5] p-4">
            <p className="text-sm font-medium">Aún no tienes materias</p>
            <p className="mt-1 text-sm leading-6 text-[#647168]">Tus materias aparecerán aquí cuando las registres.</p>
          </div>}
          {!!materias.carga?.datos?.length && <ul className="mt-3 divide-y divide-[#F1F3EE]">
            {materias.carga.datos.map((materia) => <li key={materia.id} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-3.5 text-sm leading-6 transition-colors hover:bg-[#F8FAF6]">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: materia.color }} />
              <span className="min-w-0 font-medium">{materia.nombre}</span>
            </li>)}
          </ul>}
        </section>
      </div>

      <div className="flex justify-center pt-2 pb-6 md:hidden">
        <button type="button" onClick={() => establecerConfirmandoSalida(true)} aria-haspopup="dialog" className={'inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#CDDBCF] bg-white/50 px-3 py-2 text-xs font-medium text-[#52685C] transition-colors hover:bg-[#F4F8F0] hover:border-[#BCCFBE] ' + foco}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 4H5v16h4m0-8h12m-4-4 4 4-4 4" /></svg>
          Cerrar sesión
        </button>
      </div>

      {confirmandoSalida && <ConfirmarCerrarSesion cerrarSesionAction={cerrarSesionAction} onCerrar={() => establecerConfirmandoSalida(false)} />}

      {editor && <EditarPerfil nombre={nombreActual} correo={correo} fotoUrl={fotoUrl} focoFoto={editor === 'foto'}
        onCerrar={() => establecerEditor(null)} onGuardado={(nuevoNombre) => { establecerNombreGuardado(nuevoNombre); router.refresh(); }} />}
    </div>
  );
}
