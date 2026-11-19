'use client';

import { useId, useState } from 'react';
import ChipEstimacion from '../estimacion/ChipEstimacion';
import CalendarioFecha, { textoFecha } from './CalendarioFecha';
import GrupoHora from './GrupoHora';
import NotasBorrador from './NotasBorrador';
import {
  diaISO, diasClaseDe, nombresTipo, problemasItem, propuestaHora, referenciaDuplicado, tiposTarea,
  type ItemRevision, type MateriaElegida, type MateriaUsuario,
} from './borradorCaptura';

export const botonCaptura = 'min-h-11 max-w-full rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-sm font-semibold text-[#245B4C] hover:bg-[#E7F2E9] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
export const campoCaptura = 'mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-base text-[#263D34] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
const etiquetaCampo = 'text-xs font-medium text-[#647168]';
const cajaPregunta = 'orbit-aparece space-y-3 rounded-2xl border border-[#D6E4DB] bg-[#EEF4F0] p-3.5';
const chipBase = 'min-h-11 rounded-full border px-3.5 text-[13px] transition-colors ' + foco + ' ';
const chip = (elegido: boolean) => chipBase + (elegido
  ? 'border-[#35695D] bg-[#EEF4F0] font-semibold text-[#1F5D50]'
  : 'border-[#E3E8DE] bg-white text-[#263D34] hover:bg-[#F1F5F0]');
const botonPregunta = 'min-h-11 flex-1 rounded-xl border bg-white px-3 text-sm transition-colors ' + foco + ' ';

function Campo({ etiqueta, valor, cambiar, tipo = 'text', maxLength, principal = false }: {
  etiqueta: string; valor: string; cambiar: (valor: string) => void; tipo?: string; maxLength?: number; principal?: boolean;
}) {
  const id = useId();
  return <div className="min-w-0">
    <label htmlFor={id} className="text-xs font-semibold text-[#526A5A]">{etiqueta}</label>
    <input id={id} type={tipo} value={valor} onChange={(e) => cambiar(e.target.value)} maxLength={maxLength} className={campoCaptura + (principal ? ' font-semibold' : '')} />
  </div>;
}

function Flecha({ abierto }: { abierto: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={'h-4 w-4 shrink-0 transition-transform duration-200 ' + (abierto ? 'rotate-180' : '')} fill="none" stroke="#647168" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
}

export default function TarjetaBorrador({ item, indice, total, materias, cambiar }: {
  item: ItemRevision; indice: number; total?: number; materias: MateriaUsuario[];
  cambiar: (cambios: Partial<ItemRevision>) => void;
}) {
  const id = useId();
  const [editandoMateria, establecerEditandoMateria] = useState(false);
  const [materiaConfirmada, establecerMateriaConfirmada] = useState(false);
  const [detallesAbierto, establecerDetallesAbierto] = useState<boolean | null>(null);
  const [tipoAbierto, establecerTipoAbierto] = useState(false);

  const original = item.original;
  const propuestaMateria = original.materiaPropuesta;
  const existente = referenciaDuplicado(item);
  const nombreExistente = existente?.clase === 'tarea' ? original.duplicado?.tarea?.titulo : original.duplicado?.evento?.titulo;
  const problemas = problemasItem(item);
  const elegida = item.materia;
  const materiaVinculada = elegida.accion === 'vincular'
    ? materias.find((m) => m.id === elegida.materiaId)?.nombre
      ?? (propuestaMateria.accion === 'vincular' && propuestaMateria.materiaId === elegida.materiaId ? propuestaMateria.nombre : 'Materia seleccionada')
    : '';
  const nombreMateria = elegida.accion === 'vincular' ? materiaVinculada
    : elegida.accion === 'crear' ? elegida.nombre.trim() || 'Materia nueva' : 'Sin materia';
  const alternativas = propuestaMateria.accion === 'vincular' ? propuestaMateria.alternativas : [];
  const listaMaterias = [...materias];
  if (propuestaMateria.accion === 'vincular' && !listaMaterias.some((m) => m.id === propuestaMateria.materiaId)) {
    listaMaterias.push({ id: propuestaMateria.materiaId, nombre: propuestaMateria.nombre, codigo: null });
  }
  for (const m of alternativas) if (!listaMaterias.some((existente) => existente.id === m.id)) {
    listaMaterias.push({ ...m, codigo: null });
  }
  const preguntarMateria = propuestaMateria.accion === 'vincular' && !propuestaMateria.seguro && !materiaConfirmada && !editandoMateria
    && elegida.accion === 'vincular' && elegida.materiaId === propuestaMateria.materiaId;

  const esTarea = item.clase === 'tarea';
  const esEvento = item.clase === 'evento';
  const tipoListo = !esTarea || original.tipoSeguro || !!item.tipoElegido;
  const detalles = detallesAbierto ?? !tipoListo;
  const propuesta = propuestaHora(item);
  const tituloVisible = item.titulo.trim() || 'Sin título';

  /** Al cambiar la fecha o la materia de una tarea se vuelve a preguntar la hora si salió de la clase o no estaba definida. */
  function reiniciarHora(): Partial<ItemRevision> {
    if (!esTarea) return {};
    return item.horaDeClase || !item.horaDefinida
      ? { propuestaResuelta: false, horaDefinida: false, hora: '', horaDeClase: false, esperandoHoraClase: true }
      : { esperandoHoraClase: true };
  }
  function elegirFecha(fecha: string) {
    cambiar({
      fecha, fechaElegida: true,
      fechaFin: !item.fechaFin || item.fechaFin === item.fecha ? fecha : item.fechaFin,
      ...(fecha !== item.fecha ? reiniciarHora() : {}),
    });
  }
  function elegirMateria(materia: MateriaElegida) {
    establecerEditandoMateria(false);
    establecerMateriaConfirmada(true);
    const igual = materia.accion === elegida.accion && (materia.accion !== 'vincular' || elegida.accion !== 'vincular' || materia.materiaId === elegida.materiaId);
    cambiar({ materia, ...(igual ? {} : reiniciarHora()) });
  }

  const resumenNotas = item.notas.length === 0 ? 'sin notas' : item.notas.length === 1 ? '1 nota' : item.notas.length + ' notas';
  const resumenDetalles = esTarea ? (tipoListo ? nombresTipo[item.tipo] ?? 'Tarea' : 'Falta el tipo') + ' · ' + resumenNotas
    : resumenNotas.charAt(0).toUpperCase() + resumenNotas.slice(1);
  const tipoMismoQueIA = original.clase === 'tarea' && item.tipo === original.tipo;

  return (
    <article aria-labelledby={id + '-titulo'} className="min-w-0 space-y-4 rounded-[20px] border border-[#E3E8DE] bg-[#FCFDFB] p-4 [overflow-wrap:anywhere]">
      <h3 id={id + '-titulo'} className="sr-only">{total && total > 1 ? `Actividad ${indice + 1} de ${total}: ` : ''}{tituloVisible}</h3>

      {item.excluido
        ? <p aria-hidden="true" className="text-[19px] font-semibold leading-snug text-[#8A958D] line-through">{tituloVisible}</p>
        : <textarea aria-label="Título" rows={2} maxLength={200} value={item.titulo} onChange={(e) => cambiar({ titulo: e.target.value.replace(/\n/g, ' ') })}
          className="-mx-2 -mt-1 block w-[calc(100%+1rem)] resize-none rounded-[10px] border border-transparent bg-transparent px-2 py-1.5 text-[19px] font-semibold leading-snug text-[#263D34] transition-colors hover:border-[#E3E8DE] focus:border-[#28746B] focus:bg-white focus:outline-none" />}

      <div className="-mt-2 flex flex-wrap items-center justify-between gap-x-3">
        <div className="flex min-w-0 items-center gap-2">
          {esTarea && !item.excluido && original.estimado && (tipoMismoQueIA
            ? <ChipEstimacion estimado={original.estimado} razones={original.razones} />
            : <span className="text-xs text-[#647168]">Las horas se calculan al guardar.</span>)}
          {total !== undefined && total > 1 && <span className="text-xs font-medium text-[#647168]">{indice + 1} de {total}</span>}
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-[#647168]">
          <input type="checkbox" checked={item.excluido} onChange={(e) => cambiar({
            excluido: e.target.checked,
            decisionDuplicado: !e.target.checked && original.duplicado && item.clase === 'tarea' ? 'pendiente' : item.decisionDuplicado,
          })} className="h-4 w-4 accent-[#35695D]" />
          Omitir
        </label>
      </div>

      {item.excluido ? <p aria-live="polite" className="-mt-2 text-[13px] text-[#647168]">{item.existenteElegido && existente &&
        item.existenteElegido.clase === existente.clase && item.existenteElegido.id === existente.id
        ? <>Se usará la actividad existente «{nombreExistente}» como destino de las tareas vinculadas. No se creará otra.</>
        : 'No se guardará. Desmarca «Omitir» para recuperarla.'}</p> : <>
        {original.confianza <= 0.6 && <p className="rounded-xl bg-[#FCF2DE] px-3 py-2 text-sm font-medium text-[#916820]">Revisa bien esta actividad: Orbit no está seguro.</p>}

        {/* ── Materia ── */}
        <section aria-labelledby={id + '-materia'} className="space-y-1">
          <h4 id={id + '-materia'} className={etiquetaCampo}>Materia</h4>
          <div className="flex min-w-0 items-center gap-0.5">
            <p className="min-w-0 text-[15px] font-medium text-[#263D34]">{nombreMateria}</p>
            <button type="button" aria-label="Cambiar materia" aria-expanded={editandoMateria} onClick={() => establecerEditandoMateria(!editandoMateria)}
              className={'-my-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-[10px] transition-colors ' + foco + ' '
                + (editandoMateria ? 'bg-[#EEF4F0] text-[#35695D]' : 'text-[#647168] hover:bg-[#F1F5F0]')}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /><path d="m14.5 5.5 3 3" /></svg>
            </button>
          </div>
          {preguntarMateria && <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-[#916820]">
            <span>¿Es esta materia?</span>
            <button type="button" onClick={() => establecerMateriaConfirmada(true)} className={'min-h-11 rounded-lg px-2 font-semibold text-[#35695D] hover:bg-[#F1F5F0] ' + foco}>Sí</button>
            <button type="button" onClick={() => establecerEditandoMateria(true)} className={'min-h-11 rounded-lg px-2 font-semibold text-[#35695D] hover:bg-[#F1F5F0] ' + foco}>Cambiar</button>
          </div>}
          {elegida.accion === 'crear' && propuestaMateria.accion === 'preguntar_nombre' && <p className="text-[13px] text-[#916820]">¿Cómo se llama la materia {propuestaMateria.codigo}?</p>}
          {elegida.accion === 'crear' && <div className="grid min-w-0 gap-3 pt-1 sm:grid-cols-2">
            <Campo etiqueta="Nombre de la materia nueva" valor={elegida.nombre} maxLength={100}
              cambiar={(nombre) => cambiar({ materia: { ...elegida, nombre } })} />
            <Campo etiqueta="Código (opcional)" valor={elegida.codigo ?? ''} maxLength={30}
              cambiar={(codigo) => cambiar({ materia: { ...elegida, codigo: codigo || null } })} />
          </div>}
          {editandoMateria && <div role="group" aria-label="Elegir materia" className="orbit-aparece flex flex-wrap gap-2 pt-1">
            {listaMaterias.map((m) => {
              const sel = elegida.accion === 'vincular' && elegida.materiaId === m.id;
              return <button type="button" key={m.id} aria-pressed={sel} className={chip(sel)} onClick={() => elegirMateria({ accion: 'vincular', materiaId: m.id })}>{m.nombre}</button>;
            })}
            <button type="button" aria-pressed={elegida.accion === 'ninguna'} className={chip(elegida.accion === 'ninguna')} onClick={() => elegirMateria({ accion: 'ninguna' })}>Sin materia</button>
            <button type="button" aria-pressed={elegida.accion === 'crear'} className={chip(elegida.accion === 'crear')}
              onClick={() => elegirMateria(elegida.accion === 'crear' ? elegida : { accion: 'crear', nombre: '', codigo: null })}>+ Materia nueva</button>
          </div>}
        </section>

        {item.clase !== 'evento_fijo' ? <>
          {/* ── Fecha ── */}
          {original.opcionesFecha?.length && !item.fechaElegida ? <section aria-labelledby={id + '-opciones'} className={cajaPregunta}>
            <h4 id={id + '-opciones'} className="text-[15px] font-semibold text-[#263D34]">
              {original.opcionesFecha.length === 1 ? `¿Es el ${textoFecha(diaISO(original.opcionesFecha[0].fecha))}?` : '¿Qué fecha quisiste decir?'}
            </h4>
            <div className="flex flex-wrap gap-2">
              {original.opcionesFecha.map((opcion) => <button key={opcion.fecha} type="button" className={botonPregunta + 'border-[#35695D] font-semibold text-[#35695D] hover:bg-[#F1F5F0]'}
                onClick={() => elegirFecha(diaISO(opcion.fecha))}>
                {original.opcionesFecha!.length === 1 ? 'Sí' : opcion.etiqueta}
              </button>)}
            </div>
            <p className="text-xs text-[#647168]">O elige otra fecha abajo.</p>
          </section> : null}
          <CalendarioFecha etiqueta="Fecha" valor={item.fecha} cambiar={elegirFecha}
            diasClase={esTarea && elegida.accion !== 'ninguna' ? diasClaseDe(item) : []} materia={nombreMateria} />

          {/* ── Hora ── */}
          {!item.propuestaResuelta && item.esperandoHoraClase
            ? <p role="status" className="flex items-center gap-2 text-[13px] text-[#647168]">
              <span aria-hidden="true" className="orbit-gira h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#9AA59D] border-r-transparent" />
              Revisando tu horario de ese día…
            </p>
            : !item.propuestaResuelta && propuesta ? <section aria-labelledby={id + '-pregunta-hora'} className={cajaPregunta}>
              <div className="space-y-0.5">
                <h4 id={id + '-pregunta-hora'} className="text-[15px] font-semibold text-[#263D34]">¿Es en horario de clase, {propuesta.inicio} – {propuesta.fin}?</h4>
                <p className="text-[13px] text-[#647168]">{propuesta.motivo}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={botonPregunta + 'border-[#35695D] font-semibold text-[#35695D] hover:bg-[#F1F5F0]'} onClick={() => cambiar({
                  hora: propuesta.inicio, horaDefinida: true, propuestaResuelta: true, horaDeClase: true,
                  ...(esEvento ? { horaFin: propuesta.fin } : {}),
                })}>Sí, a esa hora</button>
                <button type="button" className={botonPregunta + 'border-[#CBD6CC] font-medium text-[#263D34] hover:bg-[#F1F5F0]'} onClick={() => cambiar({
                  hora: '', horaDefinida: true, propuestaResuelta: true, horaDeClase: false,
                })}>Otra hora</button>
              </div>
            </section>
            : !item.propuestaResuelta ? <section aria-labelledby={id + '-a-que-hora'} className={cajaPregunta}>
              <div className="space-y-0.5">
                <h4 id={id + '-a-que-hora'} className="text-[15px] font-semibold text-[#263D34]">¿A qué hora?</h4>
                <p className="text-[13px] text-[#647168]">{elegida.accion !== 'ninguna' ? `No tienes ${nombreMateria} este día.` : 'Elige la hora o déjala por definir.'}</p>
              </div>
              <GrupoHora campos={esEvento ? [
                { etiqueta: 'Desde', valor: item.hora, cambiar: (hora) => cambiar({ hora, horaDefinida: true, propuestaResuelta: true }) },
                { etiqueta: 'Hasta', valor: item.horaFin, minimo: item.hora || undefined, cambiar: (horaFin) => cambiar({ horaFin }) },
              ] : [{ etiqueta: 'Hora', valor: item.hora, cambiar: (hora) => cambiar({ hora, horaDefinida: true, propuestaResuelta: true }) }]} />
              {esTarea && <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#263D34]">
                <input type="checkbox" checked={false} className="h-4 w-4 accent-[#35695D]"
                  onChange={() => cambiar({ horaDefinida: false, hora: '', propuestaResuelta: true })} />
                Hora por definir
              </label>}
            </section>
            : item.horaDeClase && item.horaDefinida ? <div className="orbit-aparece flex min-h-12 items-center gap-2.5 rounded-xl bg-[#E7F8EF] pl-3.5 pr-1 text-[#1F5D50]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <p className="flex-1 text-sm font-semibold tabular-nums">
                {item.hora}{esEvento && item.horaFin ? ' – ' + item.horaFin : propuesta && propuesta.inicio === item.hora ? ' – ' + propuesta.fin : ''}
                <span className="font-normal"> · hora de clase</span>
              </p>
              <button type="button" onClick={() => cambiar({ horaDeClase: false })}
                className={'min-h-11 rounded-lg px-2.5 text-[13px] font-semibold text-[#1F5D50] underline underline-offset-[3px] ' + foco}>Cambiar</button>
            </div>
            : <section aria-labelledby={id + '-hora'} className="space-y-1.5">
              <h4 id={id + '-hora'} className={etiquetaCampo}>Hora</h4>
              {(item.horaDefinida || esEvento) && <GrupoHora campos={esEvento ? [
                { etiqueta: 'Desde', valor: item.hora, cambiar: (hora) => cambiar({ hora, horaDefinida: true, propuestaResuelta: true }) },
                { etiqueta: 'Hasta', valor: item.horaFin, minimo: item.hora || undefined, cambiar: (horaFin) => cambiar({ horaFin }) },
              ] : [{ etiqueta: 'Hora', valor: item.hora, cambiar: (hora) => cambiar({ hora, horaDefinida: true, propuestaResuelta: true }) }]} />}
              {esTarea && <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#263D34]">
                <input type="checkbox" checked={!item.horaDefinida} className="h-4 w-4 accent-[#35695D]"
                  onChange={(e) => cambiar({ horaDefinida: !e.target.checked, hora: e.target.checked ? '' : item.hora, propuestaResuelta: true, horaDeClase: false })} />
                Hora por definir
              </label>}
            </section>}
        </> : <>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-semibold">Días de clase</legend>
            <div className="flex flex-wrap gap-2">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((nombre, dia) => <label key={nombre} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-white px-2 text-xs">
                <input type="checkbox" className="h-4 w-4 accent-[#35695D]" checked={item.diasSemana.includes(dia + 1)}
                  onChange={(e) => cambiar({ diasSemana: e.target.checked ? [...item.diasSemana, dia + 1].sort() : item.diasSemana.filter((d) => d !== dia + 1) })} />
                {nombre}
              </label>)}
            </div>
          </fieldset>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Hora de inicio" tipo="time" valor={item.hora} cambiar={(hora) => cambiar({ hora, horaDefinida: !!hora })} />
            <Campo etiqueta="Hora de fin" tipo="time" valor={item.horaFin} cambiar={(horaFin) => cambiar({ horaFin })} />
          </div>
          <details open={problemas.some((mensaje) => mensaje.includes('vigencia'))} className="border-t border-[#E3E8DE] pt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold">Vigencia{original.vigencia ? ': ' + original.vigencia.periodo : ' (opcional)'}</summary>
            {!original.vigencia && <p className="mb-2 text-xs text-[#657360]">Opcional: indica ambas fechas o deja las dos vacías.</p>}
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Campo etiqueta="Desde" tipo="date" valor={item.vigenciaDesde} cambiar={(vigenciaDesde) => cambiar({ vigenciaDesde })} />
              <Campo etiqueta="Hasta" tipo="date" valor={item.vigenciaHasta} cambiar={(vigenciaHasta) => cambiar({ vigenciaHasta })} />
            </div>
          </details>
          <Campo etiqueta="Ubicación (opcional)" valor={item.ubicacion} maxLength={100} cambiar={(ubicacion) => cambiar({ ubicacion })} />
        </>}

        {/* ── Detalles: tipo, notas, "Añade algo más" y "Tu mensaje" ── */}
        {item.clase !== 'evento_fijo' && <div className="-mx-4 border-t border-[#E3E8DE] px-2 pt-1">
          <button type="button" aria-expanded={detalles} aria-controls={id + '-detalles'} onClick={() => establecerDetallesAbierto(!detalles)}
            className={'flex min-h-14 w-full items-center gap-2.5 rounded-[10px] px-2 text-left text-[#263D34] transition-colors hover:bg-[#F1F5F0] ' + foco}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Detalles</span>
              <span className={'text-xs ' + (tipoListo ? 'text-[#647168]' : 'text-[#916820]')}>{resumenDetalles}</span>
            </span>
            <Flecha abierto={detalles} />
          </button>

          {detalles && <div id={id + '-detalles'} className="orbit-aparece space-y-5 px-2 pb-1 pt-2">
            {esTarea && (!tipoListo ? <section aria-labelledby={id + '-pregunta-tipo'} className={cajaPregunta}>
              <div className="space-y-0.5">
                <h4 id={id + '-pregunta-tipo'} className="text-[15px] font-semibold text-[#263D34]">¿Qué tipo de actividad es?</h4>
                <p className="text-[13px] text-[#647168]">No quedó claro en tu mensaje.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tiposTarea.map((tipo) => <button type="button" key={tipo} aria-pressed={false} className={chip(false)}
                  onClick={() => cambiar({ tipo, tipoElegido: true })}>{nombresTipo[tipo]}</button>)}
              </div>
            </section> : <div className="space-y-1.5">
              <button type="button" aria-expanded={tipoAbierto} onClick={() => establecerTipoAbierto(!tipoAbierto)}
                className={'-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2.5 rounded-[10px] px-2 text-left text-[#263D34] transition-colors hover:bg-[#F1F5F0] ' + foco}>
                <span className="w-10 text-xs font-medium text-[#647168]">Tipo</span>
                <span className="flex-1 text-sm font-medium">{nombresTipo[item.tipo] ?? 'Tarea'}</span>
                <Flecha abierto={tipoAbierto} />
              </button>
              {tipoAbierto && <div role="group" aria-label="Tipo" className="orbit-aparece flex flex-wrap gap-2">
                {tiposTarea.map((tipo) => <button type="button" key={tipo} aria-pressed={item.tipo === tipo} className={chip(item.tipo === tipo)}
                  onClick={() => { cambiar({ tipo, tipoElegido: true }); establecerTipoAbierto(false); }}>{nombresTipo[tipo]}</button>)}
              </div>}
            </div>)}

            <NotasBorrador notas={item.notas} cambiar={(notas) => cambiar({ notas })} titulo={item.titulo} deIA={original.notas.length > 0} />

            {esEvento && <div className="space-y-3">
              <Campo etiqueta="Ubicación (opcional)" valor={item.ubicacion} maxLength={100} cambiar={(ubicacion) => cambiar({ ubicacion })} />
              <CalendarioFecha etiqueta="Termina otro día (opcional)" valor={item.fechaFin === item.fecha ? '' : item.fechaFin}
                vacio="El mismo día" cambiar={(fechaFin) => cambiar({ fechaFin })} />
            </div>}

            {original.origen && <div className="space-y-1.5">
              <p className={etiquetaCampo}>Tu mensaje</p>
              <p className="whitespace-pre-wrap rounded-[10px] bg-[#F4F6F1] px-3 py-2.5 text-[13px] leading-relaxed text-[#647168]">“{original.origen}”</p>
            </div>}
          </div>}
        </div>}

        {original.duplicado && <section className="space-y-2 rounded-xl border border-[#E8D8AF] bg-[#FCF2DE] p-3">
          <h4 className="text-xs font-semibold text-[#916820]">Posible duplicado</h4>
          <p className="whitespace-pre-wrap text-sm text-[#806020]">{original.duplicado.pregunta}</p>
          {(item.clase === 'tarea' || item.clase === 'evento') ? <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botonCaptura} disabled={!existente} onClick={() => {
                if (existente) cambiar({ excluido: true, decisionDuplicado: 'existente', existenteElegido: existente });
              }}>Usar la existente y omitir</button>
              {item.clase === 'tarea' && <button type="button" className={botonCaptura} aria-pressed={item.decisionDuplicado === 'nueva'} onClick={() => cambiar({ decisionDuplicado: 'nueva' })}>Es otra actividad: guardar nueva</button>}
            </div>
            {existente ? <p className="text-xs text-[#806020]">Destino existente: «{nombreExistente}» ({existente.clase === 'tarea' ? 'tarea' : 'evento'}).</p>
              : <p className="text-xs text-[#806020]">Este aviso no identifica una actividad existente válida para vincular.</p>}
            {original.duplicado.sugerenciasDiferencia?.length ? <p className="text-xs text-[#806020]">Puedes distinguirla en el título: {original.duplicado.sugerenciasDiferencia.join(', ')}.</p> : null}
          </> : null}
        </section>}
        {original.choques.length > 0 && <section className="rounded-xl border border-[#E8D8AF] bg-[#FCF2DE] p-3">
          <h4 className="text-xs font-semibold text-[#916820]">Choques de horario detectados</h4>
          <ul className="mt-2 space-y-1 text-xs text-[#806020]">{original.choques.map((choque, posicion) =>
            <li key={posicion}>{choque.titulo} · {choque.cuando}</li>)}</ul>
        </section>}
        {problemas.length > 0 && <ul aria-label="Datos pendientes" className="space-y-1 text-xs text-[#916820]">
          {problemas.map((mensaje) => <li key={mensaje} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C5A355]" />{mensaje}</li>)}
        </ul>}
      </>}
    </article>
  );
}
