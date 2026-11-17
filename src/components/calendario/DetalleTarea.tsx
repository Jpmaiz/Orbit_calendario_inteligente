'use client';

import { useEffect, useRef } from 'react';
import TarjetaTarea from './TarjetaTarea';
import type { TareaAgenda } from './agendaDia';

/** Calendario (semana o mes): al tocar una tarea se ven sus datos y su menú ⋯ (cambiar fecha, editar, eliminar). */
export default function DetalleTarea({ tarea, onCerrar }: { tarea: TareaAgenda; onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogo.current?.showModal(); }, []);
  const cerrar = () => dialogo.current?.close();

  return <dialog ref={dialogo} aria-label={'Tarea: ' + tarea.titulo} onClose={onCerrar}
    onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
    className="orbit-hoja fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border border-[#E4E8DF] bg-[#F7F8F3] p-0 text-[#263D34] shadow-xl backdrop:bg-[#142E27]/35">
    <div className="space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Tu tarea</h2>
        <button type="button" onClick={cerrar}
          className="-mr-1 min-h-11 rounded-[10px] px-2.5 text-sm font-medium text-[#35695D] hover:bg-[#F1F5F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">Cerrar</button>
      </header>
      <TarjetaTarea tarea={{ ...tarea, fechaLimite: tarea.fechaLimite.toISOString() }} contexto="calendario" alTerminar={cerrar} />
    </div>
  </dialog>;
}
