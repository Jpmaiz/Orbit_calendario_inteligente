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
const coloresTipo: Record<string, { linea: string; etiqueta: string }> = {
  examen: { linea: '#E68A94', etiqueta: 'bg-[#FCECEF] text-[#A23F53]' },
  entrega: { linea: '#E6B15B', etiqueta: 'bg-[#FCF2DE] text-[#916820]' },
  tarea: { linea: '#7AB8D6', etiqueta: 'bg-[#E9F4FB] text-[#346D8B]' },
  proyecto: { linea: '#91B88B', etiqueta: 'bg-[#EDF4E8] text-[#4C7544]' },
  exposicion: { linea: '#91B88B', etiqueta: 'bg-[#EDF4E8] text-[#4C7544]' },
  lectura: { linea: '#91B88B', etiqueta: 'bg-[#EDF4E8] text-[#4C7544]' },
};
const estilosPrioridad: Record<string, string> = {
  alta: 'bg-[#F9E7E7] text-[#A34949]',
  media: 'bg-[#FAF0DB] text-[#8B6A2D]',
  baja: 'bg-[#EDF1E7] text-[#667756]',
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
    weekday: 'long', day: 'numeric', month: 'long',
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
      aria-label={tarea.titulo}
      className="relative min-w-0 overflow-hidden [overflow-wrap:anywhere] rounded-[20px] border border-[#EBEEE6] bg-white shadow-[0_3px_14px_rgba(38,61,52,0.035)] transition-shadow hover:shadow-[0_5px_20px_rgba(38,61,52,0.07)]"
    >
      <span aria-hidden="true" className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ backgroundColor: (coloresTipo[tarea.tipo] ?? coloresTipo.lectura).linea }} />
      <div className="px-4 pb-2 pt-4 md:px-6 md:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2 md:gap-3">
          <div className="min-w-0 basis-40 flex-1">
            <h3 className={'break-words text-[15px] md:text-base font-semibold leading-6 tracking-[-0.015em] ' + (completada ? 'text-[#829080] line-through' : 'text-[#2C4236]')}>
              {tarea.titulo}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#7B847A]">
              <time dateTime={tarea.fechaLimite} title={fechaLimite.toLocaleString('es-BO', { timeZone: 'America/La_Paz' })} className="inline-block first-letter:uppercase">{fechaFormateada}</time>
            </p>
          </div>
          <span className={'mt-0.5 max-w-full rounded-md px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] ' + (coloresTipo[tarea.tipo] ?? coloresTipo.lectura).etiqueta}>
            {nombresTipo[tarea.tipo] ?? tarea.tipo}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[#75816F]">
            {tarea.materia && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tarea.materia.color }} />}
            <span className="break-words">{tarea.materia?.nombre ?? 'Sin materia'}</span>
          </span>
          <span className={'rounded px-1.5 py-0.5 ' + (completada ? estilosPrioridad.baja : estilosPrioridad[tarea.prioridad] ?? estilosPrioridad.baja)}>
            Prioridad {nombresPrioridad[tarea.prioridad] ?? tarea.prioridad}
          </span>
          <span className="text-[#75816F]">{nombresEstado[tarea.estado] ?? tarea.estado}</span>
          {vencida && <span className="font-semibold text-[#B24C54]">Vencida</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 border-t border-[#F0F2EC]">
          <label className={'inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#64805F] ' + (ocupada ? 'cursor-wait opacity-60' : 'cursor-pointer')}>
            <input
              type="checkbox"
              checked={completada}
              disabled={ocupada}
              onChange={(evento) => {
                establecerConfirmarEliminacion(false);
                void enviarAccion('PATCH', evento.target.checked ? 'completada' : 'pendiente');
              }}
              aria-label={(completada ? 'Marcar como pendiente: ' : 'Completar: ') + tarea.titulo}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[#35695D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35695D] focus-visible:ring-offset-2 disabled:cursor-wait"
            />
            {completada ? 'Reabrir' : 'Completar'}
          </label>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {ocupada ? (
              <span aria-disabled="true" className="inline-flex min-h-11 items-center px-2 text-xs text-[#A3ABA0]">Editar</span>
            ) : (
              <Link href={'/dia/' + encodeURIComponent(tarea.id) + '/editar'} className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-medium text-[#5D7763] hover:bg-[#F2F6EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35695D]">
                Editar
              </Link>
            )}
            <button
              type="button"
              disabled={ocupada}
              onClick={eliminarTarea}
              aria-label={(confirmarEliminacion ? 'Confirmar eliminación de: ' : 'Eliminar: ') + tarea.titulo}
              className="min-h-11 rounded-lg px-2 text-xs font-medium text-[#AE6167] hover:bg-[#FDF0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B76268] disabled:cursor-wait disabled:opacity-50"
            >
              {confirmarEliminacion ? '¿Eliminar?' : 'Eliminar'}
            </button>
            {confirmarEliminacion && !ocupada && (
              <button type="button" onClick={() => establecerConfirmarEliminacion(false)} className="min-h-11 rounded-lg px-2 text-xs text-[#6D776C] hover:bg-[#F2F6EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#35695D]">
                Cancelar
              </button>
            )}
          </div>
        </div>
        {ocupada && (
          <p role="status" className="mb-2 flex items-center gap-2 text-xs text-[#35695D]">
            <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-[#B8D0BC] border-t-[#35695D] motion-reduce:animate-none" />
            {accion === 'eliminar' ? 'Eliminando...' : accion === 'estado' ? 'Guardando...' : 'Actualizando...'}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-2 break-words rounded-lg border border-[#EED4D7] bg-[#FCF0F1] px-3 py-2 text-xs leading-5 text-[#A34955]">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
