'use client';

import { useState, type CSSProperties } from 'react';
import { diaEnBolivia, yaPaso } from './organizarTareasDia';
import { formatoHoraBolivia, inicioDiaBolivia, lunesDeSemana, organizarSemana, sumarDias } from './agendaSemana';
import { useAgendaRango } from './useAgendaRango';
import { useAhora } from './useAhora';
import SelectorCalendario from './SelectorCalendario';
import DetalleTarea from './DetalleTarea';
import PanelPlanEstudio from '../plan/PanelPlanEstudio';
import type { AgendaDia, TareaAgenda } from './agendaDia';
import { diasCortos, EstadoAgenda } from './presentacionCalendario';
import { itemsDelDia, minutosLibres, PXM, segmentarDia, type ItemDia, type ItemUbicado } from './semanaCompacta';
import { colorFuerte, cuantoFalta, tipoHito } from './hitosCalendario';
import { Flecha, IconoActividad, IconoHito } from './IconosCalendario';
import { duracion, hhmm, minutoBolivia } from '../plan/grillaPlan';

const zona = 'America/La_Paz';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const formatoMesCorto = new Intl.DateTimeFormat('es-BO', { timeZone: zona, month: 'short' });
const formatoDiaSemana = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'long' });
const formatoDiaCorto = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'short', day: 'numeric' });
const formatoCompleto = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long' });
const sinPunto = (texto: string) => texto.replace(/[.,]/g, '');
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const aMinutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * 60 + m; };

type Plan = { id: string; titulo: string; horaDefinida: boolean };

function rangoSemana(lunes: string, domingo: string) {
  const m1 = sinPunto(formatoMesCorto.format(inicioDiaBolivia(lunes))), m2 = sinPunto(formatoMesCorto.format(inicioDiaBolivia(domingo)));
  const d1 = Number(lunes.slice(-2)), d2 = Number(domingo.slice(-2));
  return m1 === m2 ? `${d1} – ${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`;
}

/** La próxima tarea con fecha por delante, sin plan si hay alguna: a ella va «+ Estudiar». */
function proximaParaEstudiar(agenda: AgendaDia, ahora: Date): Plan | null {
  const pendientes = agenda.tareas.filter((t) => t.fechaLimite > ahora && !yaPaso(t, ahora))
    .sort((a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime());
  const conPlan = new Set(agenda.bloques.map((b) => b.tarea.id));
  const elegida = pendientes.find((t) => !conPlan.has(t.id)) ?? pendientes[0];
  return elegida ? { id: elegida.id, titulo: elegida.titulo, horaDefinida: elegida.horaDefinida } : null;
}

function cuandoTarea(tarea: TareaAgenda, paso: boolean) {
  if (paso) return 'ya pasó';
  if (!tarea.horaDefinida) return 'sin hora';
  return (tipoHito(tarea.tipo) === 'examen' ? 'a las ' : 'hasta las ') + formatoHoraBolivia.format(tarea.fechaLimite);
}

export default function AgendaSemanaVista({ fechaActual, diaInicial = null }: { fechaActual: string; diaInicial?: string | null }) {
  const ahora = useAhora();
  const hoy = diaEnBolivia(ahora);
  const [seleccion, establecerSeleccion] = useState(() => {
    const dia = diaInicial ?? diaEnBolivia(new Date(fechaActual));
    return { lunes: lunesDeSemana(inicioDiaBolivia(dia)), dia };
  });
  const domingo = sumarDias(seleccion.lunes, 6);
  // Tres días más para «Se viene» cuando el día elegido es el fin de semana.
  const carga = useAgendaRango(seleccion.lunes, sumarDias(domingo, 3));
  const [tareaAbierta, establecerTareaAbierta] = useState<TareaAgenda | null>(null);
  const [plan, establecerPlan] = useState<Plan | null>(null);

  const agenda = carga.agenda;
  const dia = agenda ? organizarSemana(agenda, seleccion.lunes).find(({ fecha }) => fecha === seleccion.dia) : undefined;
  const esHoy = seleccion.dia === hoy, pasoDia = seleccion.dia < hoy;
  const minuto = minutoBolivia(ahora);
  const todasDelDia = dia ? [...dia.bloques.flatMap((b) => (b.tipo === 'tarea' ? [b.datos] : [])), ...dia.sinHora] : [];
  // v2.12: un examen con hora y duración va como bloque en la grilla (desde su hora de inicio); el resto, arriba.
  const examenesEnGrilla = todasDelDia.filter((t) => tipoHito(t.tipo) === 'examen' && t.horaDefinida && t.duracionMin);
  const tareasDia = todasDelDia.filter((t) => !examenesEnGrilla.includes(t));
  const items = dia ? [...itemsDelDia(dia.bloques, dia.fecha), ...examenesEnGrilla.map((t): ItemDia => {
    const ini = minutoBolivia(t.fechaLimite);
    return { clave: 'examen-' + t.id, tipo: 'examen', ini, fin: Math.min(1440, ini + t.duracionMin!), titulo: t.titulo,
      detalle: t.materia?.nombre ?? null, color: t.materia?.color ?? '#C5A355', tareaId: t.id };
  })] : [];
  const segmentos = segmentarDia(items);
  // Días sin estudio de «Mi ritmo»: ni horas libres ni «+ Estudiar».
  const ventana = agenda?.ventana;
  const diaSemana = new Date(seleccion.dia + 'T12:00:00Z').getUTCDay() || 7;
  const sinEstudio = !!ventana?.diasLibres.includes(diaSemana);
  const seViene = agenda ? agenda.tareas.filter((t) => {
    const d = diaEnBolivia(t.fechaLimite);
    return d > seleccion.dia && d <= sumarDias(seleccion.dia, 3) && !yaPaso(t, ahora);
  }).sort((a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime()) : [];
  const objetivo = agenda && !pasoDia && !sinEstudio ? proximaParaEstudiar(agenda, ahora) : null;
  const libres = minutosLibres(items, aMinutos(ventana?.desde ?? '07:00'), aMinutos(ventana?.hasta ?? '22:30'));
  const resumen = items.length
    ? `${items.length} ${items.length === 1 ? 'actividad' : 'actividades'}` + (pasoDia ? '' : sinEstudio ? ' · día sin estudio' : ` · ${duracion(libres)} libres`)
    : '';
  const estadoDe = (it: ItemUbicado) => pasoDia || (esHoy && (it.fin ?? it.finVisual) <= minuto) ? 'pasado'
    : esHoy && it.ini <= minuto && minuto < (it.fin ?? it.finVisual) ? 'actual' : 'futuro';

  function moverSemana(dias: number) {
    establecerSeleccion((actual) => ({ lunes: sumarDias(actual.lunes, dias), dia: sumarDias(actual.dia, dias) }));
  }

  return <section aria-label="Agenda semanal" className="min-w-0 space-y-4">
    <SelectorCalendario vista="semana" />

    <div className="space-y-2.5">
      <div className="flex items-center gap-1">
        <h2 aria-live="polite" className="mr-auto text-[15px] font-semibold tabular-nums">{rangoSemana(seleccion.lunes, domingo)}</h2>
        {seleccion.dia !== hoy && <button type="button" onClick={() => establecerSeleccion({ lunes: lunesDeSemana(ahora), dia: hoy })}
          className={'mr-1 min-h-9 rounded-full bg-[#E3EEE6] px-3 text-[13px] font-semibold text-[#1F5D50] hover:bg-[#D7E7DC] ' + foco}>Hoy</button>}
        <button type="button" aria-label="Semana anterior" onClick={() => moverSemana(-7)} className={'flex h-11 w-11 items-center justify-center rounded-[14px] text-[#4C5A51] hover:bg-[#EEF1EA] ' + foco}><Flecha direccion="izquierda" /></button>
        <button type="button" aria-label="Semana siguiente" onClick={() => moverSemana(7)} className={'flex h-11 w-11 items-center justify-center rounded-[14px] text-[#4C5A51] hover:bg-[#EEF1EA] ' + foco}><Flecha direccion="derecha" /></button>
      </div>
      <div role="group" aria-label="Elegir día de la semana" className="grid grid-cols-7 gap-0.5">
        {diasCortos.map((letra, indice) => {
          const fecha = sumarDias(seleccion.lunes, indice);
          const elegido = fecha === seleccion.dia, esDiaHoy = fecha === hoy;
          return <button key={fecha} type="button" aria-pressed={elegido} aria-current={esDiaHoy ? 'date' : undefined}
            aria-label={mayuscula(formatoCompleto.format(inicioDiaBolivia(fecha))) + (esDiaHoy ? ', hoy' : '')}
            onClick={() => establecerSeleccion((actual) => ({ ...actual, dia: fecha }))}
            className={'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors ' + (elegido ? 'bg-[#E3EEE6] ' : 'hover:bg-[#EEF1EA] ') + foco}>
            <span className={'text-[11.5px] font-semibold ' + (esDiaHoy ? 'text-[#1F5D50]' : 'text-[#8A958D]')}>{letra}</span>
            <span className={'flex h-8 w-8 items-center justify-center rounded-full text-[15px] tabular-nums ' +
              (elegido ? 'bg-[#245B4C] font-bold text-white' : esDiaHoy ? 'font-bold text-[#1F5D50]' : fecha < hoy ? 'font-medium text-[#8A958D]' : 'font-medium text-[#263D34]')}>
              {Number(fecha.slice(-2))}
            </span>
          </button>;
        })}
      </div>
    </div>

    <div className="h-px bg-[#E3E8DE]" />

    <div className="orbit-aparece flex items-baseline justify-between gap-2" key={seleccion.dia}>
      <h2 aria-live="polite" className="text-lg font-bold tracking-[-0.01em]">
        <time dateTime={seleccion.dia}>{mayuscula(formatoDiaSemana.format(inicioDiaBolivia(seleccion.dia)))} {Number(seleccion.dia.slice(-2))}</time>{esHoy && ' · hoy'}
      </h2>
      {resumen && <p className="text-right text-[12.5px] text-[#647168]">{resumen}</p>}
    </div>

    <EstadoAgenda {...carga} />

    {dia && <>
      {tareasDia.length > 0 && <ul aria-label="Entregas del día" className="space-y-2">
        {tareasDia.map((tarea) => {
          const paso = yaPaso(tarea, ahora);
          return <li key={tarea.id}>
            <button type="button" onClick={() => establecerTareaAbierta(tarea)}
              className={'flex min-h-11 w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left ' + (paso ? 'bg-[#EEF0EC] text-[#7A847D] ' : 'bg-[#FCF2DE] text-[#6B4F17] hover:bg-[#F8EACD] ') + foco}>
              <IconoHito tipo={tipoHito(tarea.tipo)} className="h-4 w-4 shrink-0" />
              <span className="text-[13px] leading-snug [overflow-wrap:anywhere]"><strong className="font-semibold">{tarea.titulo}</strong> · {cuandoTarea(tarea, paso)}</span>
            </button>
          </li>;
        })}
      </ul>}

      {items.length > 0 && <div aria-label="Horario del día" className="flex flex-col">
        {segmentos.map((segmento) => segmento.tipo === 'libre'
          ? <FranjaLibre key={'l' + segmento.desde} desde={segmento.desde} hasta={segmento.hasta}
            ahora={esHoy ? minuto : null} futuro={!pasoDia && (!esHoy || segmento.hasta > minuto)}
            objetivo={objetivo} alPlanificar={establecerPlan} />
          : <div key={'e' + segmento.a} className="relative" style={{ height: (segmento.b - segmento.a) * PXM }}>
            {segmento.horas.map((h) => <div key={h} aria-hidden="true" className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2" style={{ top: (h - segmento.a) * PXM }}>
              <span className="w-[38px] text-right text-[11px] font-medium tabular-nums text-[#8A958D]">{h === 1440 ? '24:00' : hhmm(h)}</span>
              <span className="h-px flex-1 bg-[#E8ECE4]" />
            </div>)}
            <ol aria-label="Actividades por hora">
              {segmento.items.map((it, i) => <li key={it.clave} className="orbit-aparece absolute" style={{
                '--i': i,
                top: (it.ini - segmento.a) * PXM + 2, height: Math.max(44, (it.finVisual - it.ini) * PXM - 4),
                left: `calc(50px + (100% - 50px) * ${it.carril / it.carriles})`,
                width: `calc((100% - 50px) / ${it.carriles} - 4px)`,
              } as CSSProperties}>
                <BloqueDia item={it} estado={estadoDe(it)} minuto={minuto} alAbrirPlan={establecerPlan}
                  alAbrirTarea={(id) => { const tarea = examenesEnGrilla.find((t) => t.id === id); if (tarea) establecerTareaAbierta(tarea); }} />
              </li>)}
            </ol>
            {esHoy && minuto >= segmento.a && minuto <= segmento.b && <div aria-hidden="true"
              className="pointer-events-none absolute left-[44px] right-0 h-0.5 rounded bg-[#35695D]" style={{ top: (minuto - segmento.a) * PXM - 1 }}>
              <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#35695D]" />
            </div>}
          </div>)}
      </div>}

      {items.length === 0 && tareasDia.length === 0 && <div className="orbit-aparece space-y-2.5 rounded-[20px] bg-white p-5 shadow-[inset_0_0_0_1px_#E3E8DE]">
        <p className="text-base font-bold">Día libre</p>
        <p className="text-[13.5px] leading-relaxed text-[#647168]">No tienes nada programado.{objetivo ? ' Si quieres, Orbit te sugiere un rato para estudiar; si no, disfrútalo.' : ' Disfrútalo.'}</p>
        {objetivo && <button type="button" onClick={() => establecerPlan(objetivo)}
          className={'min-h-11 rounded-full bg-[#E3EEE6] px-4 text-[13px] font-semibold text-[#1F5D50] hover:bg-[#D7E7DC] ' + foco}>Sugerir un rato de estudio</button>}
      </div>}

      {seViene.length > 0 && <section aria-labelledby="se-viene" className="space-y-2 pt-1">
        <h3 id="se-viene" className="text-xs font-bold tracking-[0.06em] text-[#7A847D]">SE VIENE</h3>
        <ul className="space-y-2">
          {seViene.map((tarea) => <li key={tarea.id}>
            <button type="button" onClick={() => establecerTareaAbierta(tarea)}
              className={'flex min-h-12 w-full items-center gap-2.5 rounded-[14px] bg-white px-3 py-2 text-left shadow-[inset_0_0_0_1px_#E3E8DE] hover:bg-[#FAFBF8] ' + foco}>
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tarea.materia?.color ?? '#9AA39C' }} />
              <span className="mr-auto text-[13px] leading-snug [overflow-wrap:anywhere]">
                <strong className="font-semibold">{tarea.titulo}</strong>
                <span className="text-[#647168]"> · {sinPunto(formatoDiaCorto.format(tarea.fechaLimite))}{tarea.horaDefinida && ' · ' + formatoHoraBolivia.format(tarea.fechaLimite)}</span>
              </span>
              <span className="shrink-0 rounded-full bg-[#F1F4EE] px-2.5 py-1 text-xs font-semibold text-[#4C5A51]">{cuantoFalta(hoy, diaEnBolivia(tarea.fechaLimite))}</span>
            </button>
          </li>)}
        </ul>
      </section>}
    </>}

    {tareaAbierta && <DetalleTarea tarea={tareaAbierta} onCerrar={() => establecerTareaAbierta(null)} />}
    {plan && <PanelPlanEstudio tareaId={plan.id} titulo={plan.titulo} horaDefinida={plan.horaDefinida} onCerrar={() => establecerPlan(null)} />}
  </section>;
}

/** Hueco de 2 h o más plegado: «Libre · 3 h 30»; con «+ Estudiar» abre el plan de la próxima entrega. */
function FranjaLibre({ desde, hasta, ahora, futuro, objetivo, alPlanificar }: {
  desde: number; hasta: number; ahora: number | null; futuro: boolean; objetivo: Plan | null; alPlanificar: (plan: Plan) => void;
}) {
  const dentro = ahora !== null && ahora >= desde && ahora < hasta;
  return <div className="my-0.5 flex items-center gap-2">
    <span aria-hidden="true" className="w-[38px] text-right text-[11px] text-[#A1AAA3]">⋮</span>
    <div className={'flex min-h-[52px] flex-1 items-center justify-between gap-2.5 rounded-[14px] py-2 pl-3.5 pr-2 ' + (dentro ? 'bg-[#E3EFE7]' : 'bg-white shadow-[inset_0_0_0_1px_#E1E6DC]')}>
      <div className="min-w-0">
        <p className={'flex items-center gap-1.5 text-[13px] ' + (dentro ? 'font-bold text-[#1F5D50]' : 'font-semibold text-[#4C5A51]')}>
          {dentro && <span aria-hidden="true" className="relative h-2 w-2 shrink-0"><span className="orbit-dia-halo absolute inset-0 rounded-full bg-[#35695D]" /><span className="absolute inset-0 rounded-full bg-[#35695D]" /></span>}
          {dentro ? 'Libre ahora · ' + duracion(hasta - ahora) : 'Libre · ' + duracion(hasta - desde)}
        </p>
        <p className="text-xs tabular-nums text-[#7A847D]">{hhmm(desde)} – {hhmm(hasta)}</p>
      </div>
      {futuro && objetivo && <button type="button" onClick={() => alPlanificar(objetivo)} aria-label={'Planificar estudio para ' + objetivo.titulo}
        className={'min-h-11 shrink-0 rounded-full px-3.5 text-[13px] font-semibold text-[#1F5D50] hover:bg-[#D7E7DC] ' + (dentro ? 'bg-white ' : 'bg-[#F1F4EE] ') + foco}>+ Estudiar</button>}
    </div>
  </div>;
}

/** Bloque del día: fondo suave del color de la materia, su ícono, el título y «09:00 – 10:30 · aula». */
function BloqueDia({ item, estado, minuto, alAbrirPlan, alAbrirTarea }: {
  item: ItemUbicado; estado: 'pasado' | 'actual' | 'futuro'; minuto: number; alAbrirPlan: (plan: Plan) => void; alAbrirTarea: (id: string) => void;
}) {
  const compacto = (item.finVisual - item.ini) * PXM - 4 < 64;
  const paso = estado === 'pasado', actual = estado === 'actual';
  const meta = hhmm(item.ini) + (item.fin !== null && item.fin > item.ini ? ' – ' + hhmm(item.fin) : '') + (item.detalle ? ' · ' + item.detalle : '');
  const estilo = {
    background: paso ? '#EEF0EC' : `color-mix(in srgb, ${item.color} 20%, white)`,
    opacity: paso ? 0.7 : 1,
    boxShadow: actual ? `inset 0 0 0 2px ${item.color}, 0 10px 22px -14px rgba(35,79,69,.5)` : undefined,
  };
  const clases = 'flex h-full w-full gap-2.5 overflow-hidden rounded-[14px] text-left ' + (compacto ? 'items-center px-3' : 'items-start px-3 py-2.5');
  const contenido = <>
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
      style={{ background: paso ? '#E1E5DF' : `color-mix(in srgb, ${item.color} 38%, white)`, color: paso ? '#7A847D' : colorFuerte(item.color) }}>
      <IconoActividad tipo={item.tipo} />
    </span>
    <span className={'flex min-w-0 ' + (compacto ? 'items-baseline gap-2' : 'flex-col gap-0.5')}>
      <span className="truncate text-sm font-semibold leading-tight text-[#263D34]">{item.titulo}</span>
      <span className="truncate text-[12.5px] tabular-nums leading-snug text-[#4C5A51]">{meta}</span>
      {actual && item.fin !== null && !compacto && <span className="mt-0.5 self-start rounded-full bg-white px-2 py-0.5 text-[11px] font-bold" style={{ color: colorFuerte(item.color) }}>
        Ahora · quedan {duracion(item.fin - minuto)}
      </span>}
    </span>
  </>;
  const etiqueta = (item.tipo === 'clase' ? 'Clase' : item.tipo === 'evento' ? 'Evento' : item.tipo === 'examen' ? 'Examen' : 'Estudio') + ': ' + item.titulo + ', ' + meta + (actual ? ', ahora' : paso ? ', terminó' : '');
  if (item.tipo === 'examen' && item.tareaId) {
    const tareaId = item.tareaId;
    return <button type="button" onClick={() => alAbrirTarea(tareaId)} aria-label={etiqueta}
      className={clases + ' transition-transform hover:-translate-y-px ' + foco} style={estilo}>{contenido}</button>;
  }
  if (item.tipo === 'estudio' && item.tareaId) {
    const tareaId = item.tareaId;
    return <button type="button" onClick={() => alAbrirPlan({ id: tareaId, titulo: item.titulo, horaDefinida: true })} aria-label={etiqueta + '. Editar el plan'}
      className={clases + ' transition-transform hover:-translate-y-px ' + foco} style={estilo}>{contenido}</button>;
  }
  return <article aria-label={etiqueta} className={clases} style={estilo}>{contenido}</article>;
}
