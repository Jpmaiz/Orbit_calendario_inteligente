'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { diaEnBolivia } from './organizarTareasDia';
import { formatoHoraBolivia, inicioDiaBolivia, lunesDeSemana, sumarDias } from './agendaSemana';
import { horarioDelDia, type TareaAgenda } from './agendaDia';
import { useAgendaRango } from './useAgendaRango';
import { useAhora } from './useAhora';
import SelectorCalendario from './SelectorCalendario';
import DetalleTarea from './DetalleTarea';
import PanelPlanEstudio from '../plan/PanelPlanEstudio';
import { diasCortos, EstadoAgenda } from './presentacionCalendario';
import { colorFuerte, cuantoFalta, hitosDeAgenda, horasDelDia, nivelCarga, type Hito } from './hitosCalendario';
import { Flecha, IconoHito } from './IconosCalendario';
import { formatearHoras } from '../estimacion/estimacionFrontend';
import { duracion } from '../plan/grillaPlan';

const zona = 'America/La_Paz';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const formatoMes = new Intl.DateTimeFormat('es-BO', { timeZone: zona, month: 'long' });
const formatoCompleto = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long' });
const formatoDiaCorto = new Intl.DateTimeFormat('es-BO', { timeZone: zona, weekday: 'short', day: 'numeric' });
const sinPunto = (texto: string) => texto.replace(/[.,]/g, '');
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
/** Fondo del día según cuánto tiene: de libre a cargado. */
const FONDO_CARGA = ['transparent', '#F2F6F0', '#E5EEE6', '#D5E5D9'];

type Plan = { id: string; titulo: string; horaDefinida: boolean };

function primerDiaMes(fecha: string, desplazamiento = 0) {
  const resultado = new Date(fecha.slice(0, 7) + '-01T12:00:00Z');
  resultado.setUTCMonth(resultado.getUTCMonth() + desplazamiento);
  return resultado.toISOString().slice(0, 10);
}

/** v2.12: «Plan listo» solo si los bloques cubren lo estimado (±15 min, igual que el panel de plan). */
function estadoPlan(tarea: TareaAgenda) {
  const bloques = tarea.plan?.bloques ?? 0, minutos = tarea.plan?.minutos ?? 0;
  const necesarios = tarea.estimado ? tarea.estimado.horas * 60 : null;
  return { bloques, listo: bloques > 0 && (necesarios === null || minutos >= necesarios - 15) };
}
/** Minutos que faltan planificar: lo estimado menos lo que ya tiene bloques. */
function faltaPlanificar(tarea: TareaAgenda) {
  return tarea.estimado ? Math.max(0, tarea.estimado.horas * 60 - (tarea.plan?.minutos ?? 0)) : 0;
}

function cuandoHito(hito: Hito, conTipo: boolean) {
  const hora = formatoHoraBolivia.format(hito.momento);
  const nombre = hito.tipo === 'examen' ? (hito.tarea?.tipo === 'exposicion' ? 'exposición' : 'examen') : hito.tipo;
  const texto = !hito.conHora ? 'sin hora' : hito.tipo === 'entrega' ? 'hasta las ' + hora : 'a las ' + hora;
  return conTipo ? nombre + ' ' + texto : texto;
}

export default function AgendaMesVista({ fechaActual }: { fechaActual: string }) {
  const ahora = useAhora();
  const hoy = diaEnBolivia(ahora);
  const [seleccion, establecerSeleccion] = useState(() => {
    const dia = diaEnBolivia(new Date(fechaActual));
    return { mes: primerDiaMes(dia), dia };
  });
  const desde = lunesDeSemana(inicioDiaBolivia(seleccion.mes));
  const ultimoDia = sumarDias(primerDiaMes(seleccion.mes, 1), -1);
  const hasta = sumarDias(lunesDeSemana(inicioDiaBolivia(ultimoDia)), 6);
  const semanas = Math.round((inicioDiaBolivia(hasta).getTime() - inicioDiaBolivia(desde).getTime()) / 86400000 + 1) / 7;
  const carga = useAgendaRango(desde, hasta);
  const [tareaAbierta, establecerTareaAbierta] = useState<TareaAgenda | null>(null);
  const [plan, establecerPlan] = useState<Plan | null>(null);

  const agenda = carga.agenda;
  const hitos = agenda ? hitosDeAgenda(agenda, ahora) : [];
  const porDia = new Map<string, Hito[]>();
  for (const hito of hitos) porDia.set(hito.dia, [...(porDia.get(hito.dia) ?? []), hito]);
  const mesVisible = seleccion.mes.slice(0, 7);
  const importantes = hitos.filter((h) => !h.pasado && h.dia.slice(0, 7) === mesVisible);
  const porPlanificar = importantes.reduce((t, h) => t + (h.tarea ? faltaPlanificar(h.tarea) : 0), 0) / 60;
  const conTarea = importantes.filter((h) => h.tarea);
  const resumenLista = porPlanificar > 0 ? formatearHoras(porPlanificar) + ' por planificar'
    : conTarea.length && conTarea.every((h) => estadoPlan(h.tarea!).listo) ? 'Todo planificado' : '';

  // Vistazo del día elegido: sus hitos y el estudio planificado para ese día.
  const hitosDia = porDia.get(seleccion.dia) ?? [];
  const estudioDia = agenda ? horarioDelDia(agenda, new Date(seleccion.dia + 'T12:00:00-04:00')).bloques : [];
  const clasesDia = agenda ? horasDelDia(agenda, seleccion.dia).clases : 0;

  function moverMes(cantidad: number) {
    establecerSeleccion((actual) => {
      const mes = primerDiaMes(actual.mes, cantidad);
      return { mes, dia: mes };
    });
  }

  return <section aria-label="Agenda mensual" className="min-w-0 space-y-4">
    <SelectorCalendario vista="mes" />

    <div className="flex items-center gap-1">
      <h2 aria-live="polite" className="mr-auto text-[21px] font-bold tracking-[-0.015em]">
        {mayuscula(formatoMes.format(inicioDiaBolivia(seleccion.mes)))} <span className="font-medium text-[#8A958D]">{seleccion.mes.slice(0, 4)}</span>
      </h2>
      {seleccion.dia !== hoy && <button type="button" onClick={() => establecerSeleccion({ mes: primerDiaMes(hoy), dia: hoy })}
        className={'mr-1 min-h-9 rounded-full bg-[#E3EEE6] px-3.5 text-[13.5px] font-semibold text-[#1F5D50] hover:bg-[#D7E7DC] ' + foco}>Hoy</button>}
      <button type="button" aria-label="Mes anterior" onClick={() => moverMes(-1)} className={'flex h-11 w-11 items-center justify-center rounded-[14px] text-[#4C5A51] hover:bg-[#EEF1EA] ' + foco}><Flecha direccion="izquierda" /></button>
      <button type="button" aria-label="Mes siguiente" onClick={() => moverMes(1)} className={'flex h-11 w-11 items-center justify-center rounded-[14px] text-[#4C5A51] hover:bg-[#EEF1EA] ' + foco}><Flecha direccion="derecha" /></button>
    </div>

    <div className="rounded-3xl bg-white px-2 pb-3.5 pt-3 shadow-[inset_0_0_0_1px_#E3E8DE]">
      <div aria-hidden="true" className="grid grid-cols-7 pb-1.5">
        {diasCortos.map((letra, indice) => <span key={indice} className="text-center text-[12.5px] font-semibold text-[#8A958D]">{letra}</span>)}
      </div>
      <div role="group" aria-label="Elegir día del mes" className="grid grid-cols-7">
        {Array.from({ length: semanas * 7 }, (_, indice) => {
          const fecha = sumarDias(desde, indice);
          const delMes = fecha.slice(0, 7) === mesVisible;
          const elegido = fecha === seleccion.dia, esHoy = fecha === hoy, paso = fecha < hoy;
          const delDia = porDia.get(fecha) ?? [];
          const primero = delDia[0];
          const nivel = agenda && delMes ? nivelCarga(horasDelDia(agenda, fecha).total) : 0;
          const etiqueta = mayuscula(formatoCompleto.format(inicioDiaBolivia(fecha))) + (esHoy ? ', hoy' : '') +
            delDia.map((h) => `, ${h.tipo}: ${h.titulo}`).join('');
          return <button key={fecha} type="button" aria-label={etiqueta} aria-pressed={elegido} aria-current={esHoy ? 'date' : undefined}
            onClick={() => establecerSeleccion((actual) => ({ ...actual, dia: fecha }))}
            className={'m-px flex h-16 min-w-0 flex-col items-center gap-[3px] rounded-[14px] pt-1.5 transition-colors hover:brightness-[.98] ' + foco}
            style={{ background: FONDO_CARGA[nivel] }}>
            <span className={'flex h-9 w-9 items-center justify-center rounded-full text-[16.5px] tabular-nums ' +
              (elegido ? 'bg-[#245B4C] font-bold text-white' : !delMes ? 'font-medium text-[#B5BDB6]' : esHoy ? 'font-bold text-[#1F5D50] shadow-[inset_0_0_0_1.5px_#35695D]'
                : paso ? 'font-medium text-[#8A958D]' : 'font-medium text-[#263D34]')}>
              {Number(fecha.slice(-2))}
            </span>
            <span aria-hidden="true" className="flex h-[13px] items-center gap-0.5" style={{ opacity: delMes ? 1 : 0.55 }}>
              {primero && <span style={{ color: primero.pasado ? '#A1AAA3' : colorFuerte(primero.color) }}><IconoHito tipo={primero.tipo} className={primero.tipo === 'evento' ? 'h-2.5 w-2.5' : 'h-3 w-3'} /></span>}
              {delDia.length > 1 && <span className="text-[10.5px] font-bold text-[#647168]">+{delDia.length - 1}</span>}
            </span>
          </button>;
        })}
      </div>
      <ul aria-label="Qué marca cada día" className="mx-2 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#EDF0EA] pt-3 text-[12.5px] text-[#647168]">
        <li className="flex items-center gap-1.5"><span className="text-[#4C5A51]"><IconoHito tipo="examen" className="h-[11px] w-[11px]" /></span>Examen</li>
        <li className="flex items-center gap-1.5"><span className="text-[#4C5A51]"><IconoHito tipo="entrega" className="h-3 w-3" /></span>Entrega</li>
        <li className="flex items-center gap-1.5"><span className="text-[#4C5A51]"><IconoHito tipo="evento" className="h-[9px] w-[9px]" /></span>Evento</li>
        <li className="ml-auto flex items-center gap-1.5">
          <span aria-hidden="true" className="flex gap-0.5">{FONDO_CARGA.slice(1).map((fondo) => <span key={fondo} className="h-2.5 w-2.5 rounded-[3px] shadow-[inset_0_0_0_1px_#E3E8DE]" style={{ background: fondo }} />)}</span>
          Más ocupado
        </li>
      </ul>
    </div>

    <EstadoAgenda {...carga} />

    {agenda && <>
      <section aria-labelledby="dia-elegido" className="orbit-aparece space-y-2.5 rounded-[20px] bg-white px-[18px] py-4 shadow-[inset_0_0_0_1px_#E3E8DE]" key={seleccion.dia}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="dia-elegido" className="text-[17px] font-bold">
            <time dateTime={seleccion.dia}>{mayuscula(formatoCompleto.format(inicioDiaBolivia(seleccion.dia)).replace(',', ''))}</time>{seleccion.dia === hoy && ' · hoy'}
          </h3>
          <p className="shrink-0 text-[13.5px] text-[#647168]">{clasesDia ? duracion(clasesDia * 60) + ' de clases' : 'Sin clases'}</p>
        </div>
        {hitosDia.length + estudioDia.length === 0
          ? <p className="text-[14.5px] text-[#647168]">Sin exámenes ni entregas este día.</p>
          : <ul className="space-y-1.5">
            {hitosDia.map((h) => <li key={h.clave} className="flex items-center gap-2.5 text-[14.5px] leading-snug">
              <span aria-hidden="true" className={'h-[9px] w-[9px] shrink-0 ' + (h.tipo === 'evento' ? 'rounded-full' : 'rounded-[2px]')} style={{ background: h.color ?? '#9AA39C' }} />
              <span className="[overflow-wrap:anywhere]"><strong className="font-semibold">{h.titulo}</strong><span className="text-[#647168]"> · {cuandoHito(h, true)}</span></span>
            </li>)}
            {estudioDia.map((b) => <li key={b.id} className="flex items-center gap-2.5 text-[14.5px] leading-snug">
              <span aria-hidden="true" className="h-[9px] w-[9px] shrink-0 rounded-[2px] bg-[#C9BFE2]" />
              <span className="[overflow-wrap:anywhere]"><strong className="font-semibold">Estudiar: {b.tarea.titulo}</strong>
                <span className="text-[#647168]"> · {formatoHoraBolivia.format(b.inicio)} – {formatoHoraBolivia.format(b.fin)}</span></span>
            </li>)}
          </ul>}
        <Link href={'/semana?dia=' + seleccion.dia}
          className={'inline-flex min-h-11 items-center rounded-full bg-[#F1F4EE] px-4 text-sm font-semibold text-[#263D34] hover:bg-[#E9EDE5] ' + foco}>Ver el día en Semana</Link>
      </section>

      <section aria-labelledby="lo-importante" className="space-y-2.5 pt-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="lo-importante" className="text-[13px] font-bold tracking-[0.06em] text-[#7A847D]">LO IMPORTANTE DE {formatoMes.format(inicioDiaBolivia(seleccion.mes)).toUpperCase()}</h3>
          {resumenLista && <p className="shrink-0 text-[13px] text-[#8A958D]">{resumenLista}</p>}
        </div>
        {importantes.length === 0
          ? <p className="rounded-[18px] bg-white px-[18px] py-4 text-[14.5px] text-[#647168] shadow-[inset_0_0_0_1px_#E3E8DE]">Nada importante por delante este mes.</p>
          : <ul className="space-y-2.5">
            {importantes.map((h, i) => {
              const tarea = h.tarea;
              const plan = tarea ? estadoPlan(tarea) : null;
              const bloques = plan?.bloques ?? 0;
              const horas = tarea?.estimado ? formatearHoras(tarea.estimado.horas) : null;
              const faltan = tarea && plan && bloques > 0 && !plan.listo ? formatearHoras(faltaPlanificar(tarea) / 60) : null;
              const falta = cuantoFalta(hoy, h.dia);
              const cerca = falta === 'hoy' || falta === 'mañana' || falta === 'en 2 días';
              const contenido = <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
                  style={{ background: h.color ? `color-mix(in srgb, ${h.color} 24%, white)` : '#EAF1EC', color: colorFuerte(h.color) }}>
                  <IconoHito tipo={h.tipo} className={h.tipo === 'evento' ? 'h-3 w-3' : 'h-[17px] w-[17px]'} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold leading-tight">{h.titulo}</span>
                  <span className="text-[13.5px] tabular-nums text-[#647168]">
                    {sinPunto(formatoDiaCorto.format(h.momento))}{h.conHora && ' · ' + (h.tipo === 'entrega' ? 'hasta ' : '') + formatoHoraBolivia.format(h.momento)}
                    {' · '}<span className={'font-semibold ' + (cerca ? 'text-[#916820]' : 'text-[#647168]')}>{falta}</span>
                  </span>
                </span>
              </>;
              return <li key={h.clave} className="orbit-aparece flex min-h-[72px] items-center gap-2 rounded-[18px] bg-white py-2.5 pl-3.5 pr-3 shadow-[inset_0_0_0_1px_#E3E8DE]" style={{ '--i': i } as CSSProperties}>
                {tarea
                  ? <button type="button" onClick={() => establecerTareaAbierta(tarea)} aria-label={'Ver ' + h.titulo}
                    className={'flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-left ' + foco}>{contenido}</button>
                  : <div className="flex min-w-0 flex-1 items-center gap-3.5">{contenido}</div>}
                {tarea && (plan?.listo
                  ? <button type="button" onClick={() => establecerPlan({ id: tarea.id, titulo: tarea.titulo, horaDefinida: tarea.horaDefinida })}
                    aria-label={`Plan listo para ${tarea.titulo}: ${bloques} ${bloques === 1 ? 'bloque' : 'bloques'}. Editar`}
                    className={'min-h-11 shrink-0 rounded-full bg-[#E7F8EF] px-3 text-[13px] font-semibold text-[#1F5D50] hover:bg-[#D9F1E4] ' + foco}>
                    Plan listo · {bloques} {bloques === 1 ? 'bloque' : 'bloques'}
                  </button>
                  : <button type="button" onClick={() => establecerPlan({ id: tarea.id, titulo: tarea.titulo, horaDefinida: tarea.horaDefinida })}
                    aria-label={'Planificar ' + tarea.titulo + (horas ? ', ' + horas.replace('~', 'unas ') : '')}
                    className={'min-h-11 shrink-0 rounded-full bg-[#35695D] px-3.5 text-[13.5px] font-semibold text-white hover:bg-[#2D5C51] ' + foco}>
                    {faltan ? 'Faltan ' + faltan : <>Planificar{horas && ' · ' + horas}</>}
                  </button>)}
              </li>;
            })}
          </ul>}
      </section>
    </>}

    {tareaAbierta && <DetalleTarea tarea={tareaAbierta} onCerrar={() => establecerTareaAbierta(null)} />}
    {plan && <PanelPlanEstudio tareaId={plan.id} titulo={plan.titulo} horaDefinida={plan.horaDefinida} onCerrar={() => establecerPlan(null)} />}
  </section>;
}
