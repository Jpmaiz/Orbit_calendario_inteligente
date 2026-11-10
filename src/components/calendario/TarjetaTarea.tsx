'use client';

import Link from 'next/link';
import PanelPlanEstudio from '../plan/PanelPlanEstudio';
import IndicadorEstimacion from '../estimacion/IndicadorEstimacion';
import ChipEstimacion, { type AvisoTiempo } from '../estimacion/ChipEstimacion';
import { formatearHoras } from '../estimacion/estimacionFrontend';
import type { Nota } from '../ia/borradorCaptura';
import { diaEnBolivia } from './organizarTareasDia';
import type { EstimacionTarea, PrioridadCalculada, TareaConHoraDefinida } from '@/tipos/tarea';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type TareaTarjeta = TareaConHoraDefinida & EstimacionTarea & {
  id: string;
  titulo: string;
  fechaLimite: string;
  tipo: string;
  prioridad: string;
  prioridadCalculada?: PrioridadCalculada | null;
  estado: string;
  materia: { nombre: string; color: string } | null;
  notas?: Nota[];
};

type Props = { tarea: TareaTarjeta; contexto?: 'hoy' | 'sin-hora' };

const nombresTipo: Record<string, string> = {
  examen: 'Examen', tarea: 'Tarea', entrega: 'Entrega', proyecto: 'Proyecto', exposicion: 'Exposición',
};
const nombresNota: Record<string, string> = {
  llevar: 'Llevar', temas: 'Temas', bibliografia: 'Bibliografía', duracion: 'Duración', otros: 'Notas',
};
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const zona = 'America/La_Paz';
const formatoHora = new Intl.DateTimeFormat('es-BO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoSemana = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'long' });
const formatoDia = new Intl.DateTimeFormat('es-BO', { timeZone: zona, day: 'numeric' });
const formatoMes = new Intl.DateTimeFormat('es-BO', { timeZone: zona, month: 'long' });

/** "Mañana · 09:00", "Lunes 16 · 14:15"; y para frases: "mañana a las 09:00", "el lunes 16 a las 14:15". */
function cuando(fecha: Date, horaDefinida: boolean, ahora: Date) {
  const [a, b] = [diaEnBolivia(fecha), diaEnBolivia(ahora)].map((d) => { const [y, m, x] = d.split('-').map(Number); return Date.UTC(y, m - 1, x); });
  const dias = Math.round((a - b) / 86_400_000);
  const semana = formatoSemana.format(fecha), dia = formatoDia.format(fecha);
  const nombre = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : dias === -1 ? 'ayer'
    : Math.abs(dias) < 7 ? `${semana} ${dia}` : `${dia} de ${formatoMes.format(fecha)}`;
  const hora = horaDefinida ? formatoHora.format(fecha) : null;
  const mayuscula = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return {
    corto: mayuscula + (hora ? ' · ' + hora : ' · hora por definir'),
    frase: (dias >= 2 ? 'el ' : '') + nombre + (hora ? ' a las ' + hora : ''),
    pronto: dias >= 0 && dias <= 1,
  };
}

/** Una sola línea: los temas primero; si no, lo que hay que llevar; si no, la primera categoría. */
function lineaNotas(notas: Nota[] | undefined): { categoria: string; texto: string } | null {
  if (!notas?.length) return null;
  const categoria = (['temas', 'llevar'] as const).find((c) => notas.some((n) => n.categoria === c)) ?? notas[0].categoria;
  const textos = notas.filter((n) => n.categoria === categoria).map((n) => n.texto);
  const vistos = textos.slice(0, 3);
  const texto = textos.length > 3 ? vistos.join(', ') + ` y ${textos.length - 3} más`
    : vistos.length > 1 ? vistos.slice(0, -1).join(', ') + ' y ' + vistos[vistos.length - 1] : vistos[0];
  return { categoria: nombresNota[categoria] ?? 'Notas', texto };
}

export default function TarjetaTarea({ tarea, contexto }: Props) {
  const router = useRouter();
  const [planAbierto, setPlanAbierto] = useState(false);
  const [menuAbierto, establecerMenuAbierto] = useState(false);
  const [accion, establecerAccion] = useState<'estado' | 'eliminar' | null>(null);
  const [error, establecerError] = useState<string | null>(null);
  const [confirmarEliminacion, establecerConfirmarEliminacion] = useState(false);
  const [actualizando, iniciarActualizacion] = useTransition();
  const solicitudEnCurso = useRef(false);
  const menu = useRef<HTMLDivElement>(null);
  const cerrada = tarea.estado === 'completada' || tarea.estado === 'no_realizada';
  const ocupada = accion !== null || actualizando;
  const fechaLimite = new Date(tarea.fechaLimite);
  const momento = cuando(fechaLimite, tarea.horaDefinida, new Date());

  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) { establecerMenuAbierto(false); establecerConfirmarEliminacion(false); }
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [menuAbierto]);

  async function enviarAccion(metodo: 'PATCH' | 'DELETE', estado?: 'pendiente') {
    if (solicitudEnCurso.current || ocupada) return;
    solicitudEnCurso.current = true;
    establecerError(null);
    establecerAccion(metodo === 'PATCH' ? 'estado' : 'eliminar');
    try {
      const respuesta = await fetch('/api/tareas/' + encodeURIComponent(tarea.id), {
        method: metodo,
        ...(metodo === 'PATCH' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) } : {}),
      });
      if (!respuesta.ok) {
        const datos: unknown = await respuesta.json().catch(() => null);
        establecerError(typeof datos === 'object' && datos !== null && 'error' in datos && typeof datos.error === 'string'
          ? datos.error : 'No se pudo guardar el cambio. Intenta de nuevo.');
        return;
      }
      iniciarActualizacion(() => router.refresh());
    } catch {
      establecerError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      establecerAccion(null);
      establecerConfirmarEliminacion(false);
      establecerMenuAbierto(false);
      solicitudEnCurso.current = false;
    }
  }

  const estado = (ocupada || error) && <>
    {ocupada && <p role="status" className="mb-2 flex items-center gap-2 text-xs text-[#35695D]">
      <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-[#B8D0BC] border-t-[#35695D] motion-reduce:animate-none" />
      {accion === 'eliminar' ? 'Eliminando…' : accion === 'estado' ? 'Guardando…' : 'Actualizando…'}
    </p>}
    {error && <p role="alert" className="mb-2 break-words rounded-lg border border-[#EED4D7] bg-[#FCF0F1] px-3 py-2 text-xs leading-5 text-[#A34955]">{error}</p>}
  </>;

  /* ── Ya pasó: se ve como hecha sola, con "Reabrir" (cero mantenimiento) ── */
  if (cerrada) {
    return (
      <article aria-busy={ocupada} aria-label={tarea.titulo} className="min-w-0 rounded-2xl border border-[#E3E8DE] bg-[#FBFCF9] py-2 pl-4 pr-2 [overflow-wrap:anywhere]">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#E7F8EF] text-[#1F5D50]">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-sm font-medium text-[#647168]">{tarea.titulo}</h3>
            <p className="text-xs text-[#8A958D]"><time dateTime={tarea.fechaLimite}>{momento.corto}</time></p>
          </div>
          <button type="button" disabled={ocupada} onClick={() => void enviarAccion('PATCH', 'pendiente')} aria-label={'Reabrir: ' + tarea.titulo}
            className={'min-h-11 shrink-0 rounded-[10px] px-2.5 text-[13px] font-semibold text-[#35695D] hover:bg-[#F1F5F0] disabled:opacity-50 ' + foco}>Reabrir</button>
        </div>
        {estado}
      </article>
    );
  }

  const calculada = tarea.prioridadCalculada;
  const faltan = calculada?.faltanHoras ?? 0;
  const aviso: AvisoTiempo | null = faltan > 0 && calculada?.horasLibres !== undefined ? {
    texto: `Hasta ${momento.frase} ${calculada.horasLibres > 0
      ? `te queda ${formatearHoras(calculada.horasLibres)} libre` : 'no te queda tiempo libre'}. Te faltarían ${formatearHoras(faltan)}.`,
    accion: { etiqueta: 'Planificar estudio', alHacer: () => setPlanAbierto(true) },
  } : null;
  const notas = lineaNotas(tarea.notas);
  const textoCuando = contexto === 'sin-hora' ? 'Hoy · hora por definir' : momento.corto;

  return (
    <article aria-busy={ocupada} aria-label={tarea.titulo}
      className="relative min-w-0 rounded-[20px] border border-[#EBEEE6] bg-white shadow-[0_3px_14px_rgba(38,61,52,0.035)] transition-shadow [overflow-wrap:anywhere] hover:shadow-[0_5px_20px_rgba(38,61,52,0.07)]">
      <div className="space-y-2.5 px-4 pb-1.5 pt-4 md:px-6 md:pt-5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-[#647168]">
          {tarea.materia && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tarea.materia.color }} />}
          {nombresTipo[tarea.tipo] ?? tarea.tipo}{tarea.materia && <> · {tarea.materia.nombre}</>}
        </p>
        <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em] text-[#263D34]">{tarea.titulo}</h3>
        <p className={'-mt-1 flex items-center gap-1.5 text-sm font-medium ' + (momento.pronto ? 'text-[#916820]' : 'text-[#647168]')}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[15px] w-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <time dateTime={tarea.fechaLimite}>{textoCuando}</time>
        </p>

        {tarea.estimado && <div className="-my-1">
          {tarea.horasDelUsuario || !(tarea.estimado.razones?.length || aviso)
            ? <div className="flex min-h-11 items-center"><IndicadorEstimacion estimado={tarea.estimado} horasDelUsuario={tarea.horasDelUsuario} /></div>
            : <ChipEstimacion estimado={tarea.estimado} razones={tarea.estimado.razones ?? []} aviso={aviso} />}
        </div>}

        {notas && <p className="text-[13px] leading-snug text-[#647168]">
          <span className="font-semibold text-[#263D34]">{notas.categoria}:</span> {notas.texto}
        </p>}

        <div className="-mx-2 flex items-center justify-between gap-2 border-t border-[#F0F2EC] pt-0.5">
          <button type="button" disabled={ocupada} onClick={() => setPlanAbierto(true)}
            className={'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-sm font-semibold text-[#35695D] hover:bg-[#F1F5F0] disabled:opacity-50 ' + foco}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v5M9.5 15.5h5" /></svg>
            Planificar estudio
          </button>
          <div ref={menu} className="relative" onKeyDown={(e) => {
            if (e.key === 'Escape' && menuAbierto) { e.preventDefault(); e.stopPropagation(); establecerMenuAbierto(false); establecerConfirmarEliminacion(false); }
          }}>
            <button type="button" aria-label={'Más opciones: ' + tarea.titulo} aria-expanded={menuAbierto} aria-haspopup="menu" disabled={ocupada}
              onClick={() => { establecerMenuAbierto(!menuAbierto); establecerConfirmarEliminacion(false); }}
              className={'grid h-11 w-11 place-items-center rounded-[10px] text-[#647168] hover:bg-[#F1F5F0] disabled:opacity-50 ' + foco}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
            </button>
            {menuAbierto && <div role="menu" className="orbit-aparece absolute bottom-12 right-0 z-20 w-48 rounded-2xl border border-[#E3E8DE] bg-white p-1.5 shadow-[0_10px_28px_rgba(38,61,52,.14)]">
              <Link role="menuitem" href={'/dia/' + encodeURIComponent(tarea.id) + '/editar'}
                className={'flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-[#263D34] hover:bg-[#F1F5F0] ' + foco}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                Editar
              </Link>
              <button type="button" role="menuitem" onClick={() => confirmarEliminacion ? void enviarAccion('DELETE') : establecerConfirmarEliminacion(true)}
                className={'flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm text-[#A34955] hover:bg-[#FCF0F1] ' + foco}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                {confirmarEliminacion ? 'Sí, eliminar' : 'Eliminar'}
              </button>
            </div>}
          </div>
        </div>
        {estado}
      </div>
      {planAbierto && <PanelPlanEstudio tareaId={tarea.id} titulo={tarea.titulo} horaDefinida={tarea.horaDefinida} onCerrar={() => setPlanAbierto(false)} />}
    </article>
  );
}
