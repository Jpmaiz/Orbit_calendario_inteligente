'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';

type TareaTarjeta = {
  id: string;
  titulo: string;
  fechaLimite: string;
  tipo: string;
  prioridad: string;
  estado: string;
  materia: { nombre: string; color: string } | null;
};

type Props = { tarea: TareaTarjeta };
type EstadoEditable = 'completada' | 'pendiente';

const nombresTipo: Record<string, string> = {
  examen: 'Examen',
  tarea: 'Tarea',
  entrega: 'Entrega',
  proyecto: 'Proyecto',
  exposicion: 'Exposición',
};
const nombresEstado: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  no_realizada: 'No realizada',
};
const estilosPrioridad: Record<string, string> = {
  alta: 'border-red-400/30 bg-red-400/10 text-red-200',
  media: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-200',
  baja: 'border-gray-600 bg-gray-700/40 text-gray-300',
};
const nombresPrioridad: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

// El reloj se actualiza en el navegador sin diferencias de hidratación.
function suscribirseAlReloj(actualizar: () => void) {
  const temporizador = window.setInterval(actualizar, 1000);
  return () => window.clearInterval(temporizador);
}
function obtenerHoraActual() {
  return Math.floor(Date.now() / 1000) * 1000;
}
function obtenerHoraServidor() {
  return null;
}

export default function TarjetaTarea({ tarea }: Props) {
  const router = useRouter();
  const [accion, establecerAccion] = useState<'estado' | 'eliminar' | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [confirmarEliminacion, establecerConfirmarEliminacion] = useState(false);
  const [actualizando, iniciarActualizacion] = useTransition();
  const solicitudEnCurso = useRef(false);
  const ahora = useSyncExternalStore<number | null>(
    suscribirseAlReloj,
    obtenerHoraActual,
    obtenerHoraServidor,
  );
  const completada = tarea.estado === 'completada';
  const ocupada = accion !== null || actualizando;
  const fechaLimite = new Date(tarea.fechaLimite);
  const vencida = !completada && ahora !== null && fechaLimite.getTime() < ahora;
  const fechaFormateada = fechaLimite.toLocaleString('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/La_Paz',
  });

  async function enviarAccion(metodo: 'PATCH' | 'DELETE', estado?: EstadoEditable) {
    if (solicitudEnCurso.current || ocupada) return;
    solicitudEnCurso.current = true;
    establecerError(null);
    establecerAccion(metodo === 'PATCH' ? 'estado' : 'eliminar');

    try {
      const respuesta = await fetch('/api/tareas/' + encodeURIComponent(tarea.id), {
        method: metodo,
        ...(metodo === 'PATCH'
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ estado }),
            }
          : {}),
      });
      if (!respuesta.ok) {
        const datos: unknown = await respuesta.json().catch(() => null);
        const mensaje =
          typeof datos === 'object' && datos !== null &&
          'error' in datos && typeof datos.error === 'string'
            ? datos.error
            : 'No se pudo guardar el cambio. Intenta de nuevo.';
        establecerError(mensaje);
        return;
      }
      iniciarActualizacion(() => router.refresh());
    } catch {
      establecerError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      establecerAccion(null);
      establecerConfirmarEliminacion(false);
      solicitudEnCurso.current = false;
    }
  }

  function eliminarTarea() {
    if (solicitudEnCurso.current || ocupada) return;
    if (!confirmarEliminacion) {
      establecerConfirmarEliminacion(true);
      return;
    }
    void enviarAccion('DELETE');
  }

  return (
    <article
      aria-busy={ocupada}
      className={'space-y-4 rounded-2xl border p-4 sm:p-5 ' +
        (completada ? 'border-gray-800 bg-gray-900' : 'border-gray-700 bg-gray-800')}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={completada}
          disabled={ocupada}
          onChange={(evento) => {
            establecerConfirmarEliminacion(false);
            void enviarAccion('PATCH', evento.target.checked ? 'completada' : 'pendiente');
          }}
          aria-label={(completada ? 'Marcar como pendiente: ' : 'Completar: ') + tarea.titulo}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 disabled:cursor-wait disabled:opacity-50"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className={'break-words text-base font-semibold ' +
            (completada ? 'text-gray-500 line-through' : 'text-gray-100')}>
            {tarea.titulo}
          </h2>
          <p className="flex items-center gap-2 text-sm text-gray-400">
            {tarea.materia && (
              <span
                aria-hidden="true"
                style={{ backgroundColor: tarea.materia.color }}
                className="h-2 w-2 shrink-0 rounded-full"
              />
            )}
            <span className="break-words">{tarea.materia?.nombre ?? 'Sin materia'}</span>
          </p>
          <p className="text-sm text-gray-400">
            Fecha límite: <time dateTime={tarea.fechaLimite}>{fechaFormateada}</time>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-gray-600 px-2.5 py-1 text-gray-300">
          {nombresTipo[tarea.tipo] ?? tarea.tipo}
        </span>
        <span className={'rounded-full border px-2.5 py-1 ' +
          (completada ? estilosPrioridad.baja : estilosPrioridad[tarea.prioridad] ?? estilosPrioridad.baja)}>
          Prioridad {nombresPrioridad[tarea.prioridad] ?? tarea.prioridad}
        </span>
        <span className="rounded-full border border-gray-600 px-2.5 py-1 text-gray-400">
          {nombresEstado[tarea.estado] ?? tarea.estado}
        </span>
        {vencida && (
          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 font-medium text-red-300">
            Vencida
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-700/60 pt-3">
        {ocupada ? (
          <span aria-disabled="true" className="rounded-lg px-3 py-2 text-sm text-gray-500">Editar</span>
        ) : (
          <Link
            href={'/dia/' + encodeURIComponent(tarea.id) + '/editar'}
            className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/10 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Editar
          </Link>
        )}
        <button
          type="button"
          disabled={ocupada}
          onClick={eliminarTarea}
          aria-label={(confirmarEliminacion ? 'Confirmar eliminación de: ' : 'Eliminar: ') + tarea.titulo}
          className="rounded-lg px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-wait disabled:opacity-50"
        >
          {confirmarEliminacion ? '¿Seguro?' : 'Eliminar'}
        </button>
        {confirmarEliminacion && !ocupada && (
          <button
            type="button"
            onClick={() => establecerConfirmarEliminacion(false)}
            className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Cancelar
          </button>
        )}
      </div>
      {ocupada && (
        <p role="status" className="flex items-center gap-2 text-sm text-indigo-300">
          <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300 motion-reduce:animate-none" />
          {accion === 'eliminar' ? 'Eliminando...' : accion === 'estado' ? 'Guardando...' : 'Actualizando...'}
        </p>
      )}
      {error && (
        <p role="alert" className="break-words rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </article>
  );
}
