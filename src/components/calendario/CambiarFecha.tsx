'use client';

import { useState } from 'react';
import CalendarioFecha from '../ia/CalendarioFecha';
import GrupoHora from '../ia/GrupoHora';
import { fechaElegidaISO } from '../ia/flujoCaptura';
import { avisarAgendaActualizada } from './actualizacionAgenda';
import { diaEnBolivia } from './organizarTareasDia';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const formatoHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * "Cambiar fecha" (menú ⋯): si el docente posterga. PATCH /api/tareas/{id} { fechaLimite, horaDefinida }.
 * Si la fecha nueva es futura, el back vuelve la tarea a pendiente sola. Lo pasado no se reabre a mano.
 */
export default function CambiarFecha({ tareaId, fechaLimite, horaDefinida, alCancelar, alGuardar }: {
  tareaId: string; fechaLimite: string; horaDefinida: boolean; alCancelar: () => void; alGuardar: () => void;
}) {
  const hoy = diaEnBolivia(new Date());
  const actual = new Date(fechaLimite);
  const diaActual = diaEnBolivia(actual);
  const [dia, establecerDia] = useState(diaActual >= hoy ? diaActual : '');
  const [hora, establecerHora] = useState(horaDefinida ? formatoHora.format(actual) : '');
  const [porDefinir, establecerPorDefinir] = useState(!horaDefinida);
  const [guardando, establecerGuardando] = useState(false);
  const [error, establecerError] = useState<string | null>(null);

  // Sin hora definida, la tarea vence al terminar ese día.
  const instante = dia && (porDefinir || hora) ? fechaElegidaISO(dia + 'T' + (porDefinir ? '23:59' : hora)) : null;
  const sinCambios = instante !== null && +new Date(instante) === +actual && porDefinir === !horaDefinida;
  const falta = !dia ? 'Elige la nueva fecha.'
    : !porDefinir && !hora ? 'Elige la hora o marca «Hora por definir».'
    : instante && new Date(instante) <= new Date() ? 'Esa hora ya pasó. Elige una más adelante.'
    : null;

  async function guardar() {
    if (guardando || falta || !instante || sinCambios) return;
    establecerGuardando(true);
    establecerError(null);
    try {
      const respuesta = await fetch('/api/tareas/' + encodeURIComponent(tareaId), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaLimite: instante, horaDefinida: !porDefinir }),
      });
      if (!respuesta.ok) {
        const datos: unknown = await respuesta.json().catch(() => null);
        establecerError(typeof datos === 'object' && datos !== null && 'error' in datos && typeof datos.error === 'string'
          ? datos.error : 'No se pudo cambiar la fecha. Intenta de nuevo.');
        return;
      }
      avisarAgendaActualizada();
      alGuardar();
    } catch {
      establecerError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      establecerGuardando(false);
    }
  }

  return (
    <section aria-label="Cambiar fecha" className="orbit-aparece space-y-3 rounded-2xl border border-[#D6E4DB] bg-[#F4F8F5] p-3.5"
      onKeyDown={(e) => { if (e.key === 'Escape' && !guardando) { e.stopPropagation(); alCancelar(); } }}>
      <div className="space-y-0.5">
        <h4 className="text-[15px] font-semibold text-[#263D34]">Cambiar fecha</h4>
        <p className="text-[13px] leading-snug text-[#647168]">Si la postergaron. Con una fecha futura vuelve a tus pendientes.</p>
      </div>
      <CalendarioFecha etiqueta="Nueva fecha" valor={dia} cambiar={establecerDia} />
      {!porDefinir && <GrupoHora campos={[{ etiqueta: 'Hora', valor: hora, cambiar: establecerHora }]} />}
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#263D34]">
        <input type="checkbox" checked={porDefinir} onChange={(e) => establecerPorDefinir(e.target.checked)} className="h-4 w-4 accent-[#35695D]" />
        Hora por definir
      </label>
      {falta && <p aria-live="polite" className="text-[13px] text-[#916820]">{falta}</p>}
      {error && <p role="alert" className="rounded-lg border border-[#EED4D7] bg-[#FCF0F1] px-3 py-2 text-[13px] text-[#A34955]">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={guardando} onClick={alCancelar}
          className={'min-h-11 rounded-xl px-3 text-sm font-medium text-[#647168] hover:bg-[#EAF0EB] ' + foco}>Cancelar</button>
        <button type="button" disabled={guardando || !!falta || sinCambios} onClick={() => void guardar()}
          className={'min-h-11 flex-1 rounded-xl bg-[#234F45] text-sm font-semibold text-white transition-colors hover:bg-[#316457] disabled:bg-[#E3E8DE] disabled:text-[#8A958D] ' + foco}>
          {guardando ? 'Guardando…' : 'Guardar fecha'}
        </button>
      </div>
    </section>
  );
}
