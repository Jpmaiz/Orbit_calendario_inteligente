'use client';

import { useId } from 'react';
import {
  diaISO, horaISO, problemasItem, tiposTarea,
  type ClaseItem, type ItemRevision, type MateriaUsuario,
} from './borradorCaptura';

export const botonCaptura = 'min-h-11 max-w-full rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-sm font-semibold text-[#245B4C] hover:bg-[#E7F2E9] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
export const campoCaptura = 'mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-[#CEDFD5] bg-white px-3 py-2 text-base text-[#263D34] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';

function Campo({ etiqueta, valor, cambiar, tipo = 'text', maxLength }: {
  etiqueta: string; valor: string; cambiar: (valor: string) => void; tipo?: string; maxLength?: number;
}) {
  const id = useId();
  return <div className="min-w-0">
    <label htmlFor={id} className="text-xs font-semibold text-[#526A5A]">{etiqueta}</label>
    <input id={id} type={tipo} value={valor} onChange={(e) => cambiar(e.target.value)} maxLength={maxLength} className={campoCaptura} />
  </div>;
}

export default function TarjetaBorrador({ item, indice, materias, cambiar }: {
  item: ItemRevision; indice: number; materias: MateriaUsuario[];
  cambiar: (cambios: Partial<ItemRevision>) => void;
}) {
  const id = useId();
  const original = item.original;
  const propuesta = original.materiaPropuesta;
  const problemas = problemasItem(item);
  const elegida = item.materia;
  const materiaVinculada = elegida.accion === 'vincular'
    ? materias.find((m) => m.id === elegida.materiaId)?.nombre
      ?? (propuesta.accion === 'vincular' && propuesta.materiaId === elegida.materiaId ? propuesta.nombre : 'Materia seleccionada')
    : '';
  const alternativas = propuesta.accion === 'vincular' ? propuesta.alternativas : [];
  const listaMaterias = [...materias];
  if (propuesta.accion === 'vincular' && !listaMaterias.some((m) => m.id === propuesta.materiaId)) {
    listaMaterias.push({ id: propuesta.materiaId, nombre: propuesta.nombre, codigo: null });
  }
  for (const m of alternativas) if (!listaMaterias.some((existente) => existente.id === m.id)) {
    listaMaterias.push({ ...m, codigo: null });
  }

  function elegirFecha(fecha: string) {
    cambiar({
      fecha, fechaElegida: true,
      fechaFin: !item.fechaFin || item.fechaFin === item.fecha ? fecha : item.fechaFin,
    });
  }

  return (
    <article aria-labelledby={id + '-titulo'} className={'min-w-0 space-y-4 rounded-[20px] border border-[#E3E8DE] bg-[#FAFBF7] p-4 [overflow-wrap:anywhere] ' + (item.excluido ? 'opacity-70' : '')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={id + '-titulo'} className="text-sm font-semibold">Actividad {indice + 1}: {item.titulo || 'Sin título'}</h3>
        <label className="inline-flex min-h-11 items-center gap-2 text-xs text-[#526A5A]">
          <input type="checkbox" checked={item.excluido} onChange={(e) => cambiar({
            excluido: e.target.checked,
            decisionDuplicado: !e.target.checked && original.duplicado && item.clase === 'tarea' ? 'pendiente' : item.decisionDuplicado,
          })} className="h-4 w-4 accent-[#35695D]" />
          Omitir
        </label>
      </header>
      {item.excluido ? <p className="text-xs text-[#657360]">Esta actividad no se enviará a guardar.</p> : <>
        {original.confianza <= 0.6 && <p className="rounded-lg bg-[#FAEBDD] p-2 text-sm font-semibold text-[#914421]">Revisa este ítem</p>}
        <Campo etiqueta="Título" valor={item.titulo} maxLength={200} cambiar={(titulo) => cambiar({ titulo })} />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id + '-clase'} className="text-xs font-semibold text-[#526A5A]">Clase de actividad</label>
            <select id={id + '-clase'} value={item.clase} onChange={(e) => cambiar({
              clase: e.target.value as ClaseItem,
              decisionDuplicado: original.duplicado && e.target.value === 'tarea' ? 'pendiente' : item.decisionDuplicado,
            })} className={campoCaptura}>
              <option value="tarea">Tarea</option><option value="evento">Evento</option><option value="evento_fijo">Clase semanal</option>
            </select>
          </div>
          {item.clase === 'tarea' && <div>
            <label htmlFor={id + '-tipo'} className="text-xs font-semibold text-[#526A5A]">Tipo</label>
            <select id={id + '-tipo'} value={item.tipo} onChange={(e) => cambiar({ tipo: e.target.value })} className={campoCaptura}>
              {tiposTarea.map((tipo) => <option key={tipo} value={tipo}>{({ examen: 'Examen', tarea: 'Tarea', entrega: 'Entrega', proyecto: 'Proyecto', exposicion: 'Exposición' })[tipo]}</option>)}
            </select>
          </div>}
        </div>

        <section aria-labelledby={id + '-materia'} className="space-y-2 rounded-xl bg-white p-3">
          <h4 id={id + '-materia'} className="text-xs font-semibold">Materia</h4>
          <p className="text-sm text-[#526A5A]">
            {elegida.accion === 'vincular' ? materiaVinculada
              : elegida.accion === 'crear' ? 'Se creará una materia nueva.' : 'Sin materia'}
          </p>
          {propuesta.accion === 'vincular' && !propuesta.seguro && <p className="text-xs text-[#916820]">La materia detectada necesita revisión.</p>}
          {elegida.accion === 'crear' && <>
            {propuesta.accion === 'preguntar_nombre' && <p className="text-xs text-[#916820]">¿Cómo se llama la materia {propuesta.codigo}?</p>}
            <Campo etiqueta="Nombre de la materia nueva" valor={elegida.nombre} maxLength={100}
              cambiar={(nombre) => cambiar({ materia: { ...elegida, nombre } })} />
            <Campo etiqueta="Código (opcional)" valor={elegida.codigo ?? ''} maxLength={30}
              cambiar={(codigo) => cambiar({ materia: { ...elegida, codigo: codigo || null } })} />
          </>}
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-[#35695D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]">Editar materia</summary>
            <label htmlFor={id + '-elegir-materia'} className="text-xs font-semibold">Elegir otra materia o crear una</label>
            <select id={id + '-elegir-materia'} value={elegida.accion === 'vincular' ? elegida.materiaId : elegida.accion}
              className={campoCaptura} onChange={(e) => {
                const valor = e.target.value;
                cambiar({ materia: valor === 'ninguna' ? { accion: 'ninguna' }
                  : valor === 'crear' ? { accion: 'crear', nombre: '', codigo: null }
                    : { accion: 'vincular', materiaId: valor } });
              }}>
              <option value="ninguna">Sin materia</option>
              {listaMaterias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              <option value="crear">Crear una materia nueva</option>
            </select>
          </details>
        </section>

        {item.clase !== 'evento_fijo' ? <>
          {original.opcionesFecha?.length ? <section aria-labelledby={id + '-opciones'} className="space-y-2">
            <h4 id={id + '-opciones'} className="text-sm font-semibold">¿Qué fecha quisiste decir?</h4>
            <div className="flex flex-wrap gap-2">
              {original.opcionesFecha.map((opcion) => <button key={opcion.fecha} type="button" className={botonCaptura}
                aria-pressed={item.fechaElegida && item.fecha === diaISO(opcion.fecha)} onClick={() => elegirFecha(diaISO(opcion.fecha))}>
                {opcion.etiqueta} · {diaISO(opcion.fecha)}
              </button>)}
            </div>
          </section> : null}
          {!item.fecha && <p className="text-sm font-semibold text-[#916820]">¿Para cuándo es?</p>}
          <Campo etiqueta={original.opcionesFecha?.length ? 'Fecha (también puedes elegir otra)' : 'Fecha'}
            tipo="date" valor={item.fecha} cambiar={elegirFecha} />
          {original.horaPropuesta && !item.propuestaResuelta && <section className="space-y-2 rounded-xl bg-[#E9F4FB] p-3">
            <h4 className="text-sm font-semibold">¿Es en horario de clase {original.horaPropuesta.inicio}–{original.horaPropuesta.fin}?</h4>
            <p className="text-xs text-[#526A5A]">{original.horaPropuesta.motivo}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botonCaptura} onClick={() => cambiar({
                hora: original.horaPropuesta!.inicio, horaDefinida: true, propuestaResuelta: true,
              })}>Sí</button>
              <button type="button" className={botonCaptura} onClick={() => cambiar({
                hora: '', horaDefinida: true, propuestaResuelta: true,
              })}>Otra hora</button>
            </div>
          </section>}
          {!item.horaDefinida && <p className="text-sm font-medium text-[#657360]">Hora por definir
            {item.clase === 'tarea' && item.tipo === 'entrega' && original.supuestos.includes('hora') &&
              original.inicio && horaISO(original.inicio) === '23:59' && <span className="mt-1 block text-xs font-normal">23:59 (supuesta)</span>}
          </p>}
          {item.clase === 'tarea' && <label className="flex min-h-11 items-center gap-2 text-sm text-[#526A5A]">
            <input type="checkbox" checked={item.horaDefinida} className="h-4 w-4 accent-[#35695D]"
              onChange={(e) => cambiar({ horaDefinida: e.target.checked, hora: e.target.checked ? item.hora : '', propuestaResuelta: true })} />
            Tiene una hora definida
          </label>}
          {(item.horaDefinida || item.clase === 'evento') && <Campo etiqueta={item.clase === 'evento' ? 'Hora de inicio (necesaria)' : 'Hora'}
            tipo="time" valor={item.hora} cambiar={(hora) => cambiar({ hora, horaDefinida: !!hora, propuestaResuelta: true })} />}
          {item.clase === 'evento' && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha de fin (opcional)" tipo="date" valor={item.fechaFin} cambiar={(fechaFin) => cambiar({ fechaFin })} />
            <Campo etiqueta="Hora de fin (opcional)" tipo="time" valor={item.horaFin} cambiar={(horaFin) => cambiar({ horaFin })} />
          </div>}
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
          <details className="rounded-xl bg-white p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold">Vigencia{original.vigencia ? ': ' + original.vigencia.periodo : ' (opcional)'}</summary>
            {!original.vigencia && <p className="mb-2 text-xs text-[#657360]">No se propuso una vigencia. Puedes indicar fechas o dejar ambas vacías.</p>}
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Campo etiqueta="Desde" tipo="date" valor={item.vigenciaDesde} cambiar={(vigenciaDesde) => cambiar({ vigenciaDesde })} />
              <Campo etiqueta="Hasta" tipo="date" valor={item.vigenciaHasta} cambiar={(vigenciaHasta) => cambiar({ vigenciaHasta })} />
            </div>
          </details>
        </>}
        {item.clase !== 'tarea' && <Campo etiqueta="Ubicación (opcional)" valor={item.ubicacion} maxLength={100} cambiar={(ubicacion) => cambiar({ ubicacion })} />}
        {item.clase !== 'evento_fijo' && <details>
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-[#35695D]">Detalles</summary>
          <Campo etiqueta="Descripción (opcional)" valor={item.descripcion} maxLength={2000} cambiar={(descripcion) => cambiar({ descripcion })} />
        </details>}

        {original.duplicado && <section className="space-y-2 rounded-xl border border-[#E8D8AF] bg-[#FCF2DE] p-3">
          <h4 className="text-xs font-semibold text-[#916820]">Posible duplicado</h4>
          <p className="whitespace-pre-wrap text-sm text-[#806020]">{original.duplicado.pregunta}</p>
          {item.clase === 'tarea' ? <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botonCaptura} onClick={() => cambiar({ excluido: true, decisionDuplicado: 'existente' })}>Usar la existente y omitir</button>
              <button type="button" className={botonCaptura} aria-pressed={item.decisionDuplicado === 'nueva'} onClick={() => cambiar({ decisionDuplicado: 'nueva' })}>Es otra actividad: guardar nueva</button>
            </div>
            {original.duplicado.sugerenciasDiferencia?.length ? <p className="text-xs text-[#806020]">Puedes distinguirla en el título: {original.duplicado.sugerenciasDiferencia.join(', ')}.</p> : null}
          </> : <p className="text-xs text-[#806020]">Puedes marcar Omitir. Al confirmar, el servidor también omite las clases que ya existen.</p>}
        </section>}
        {original.choques.length > 0 && <section className="rounded-xl border border-[#E8D8AF] bg-[#FCF2DE] p-3">
          <h4 className="text-xs font-semibold text-[#916820]">Choques de horario detectados</h4>
          <ul className="mt-2 space-y-1 text-xs text-[#806020]">{original.choques.map((choque, posicion) =>
            <li key={posicion}>{choque.titulo} · {choque.cuando}</li>)}</ul>
          <p className="mt-2 text-xs text-[#806020]">Puedes guardar aunque haya un choque. Estos avisos corresponden a la extracción original.</p>
        </section>}
        {original.supuestos.length > 0 && <p className="text-xs text-[#657360]">Supuestos de la extracción: {original.supuestos.map((s) =>
          s === 'hora' ? 'hora interna supuesta' : s === 'anio_siguiente' ? 'año siguiente' : s).join(', ')}.</p>}
        {original.evidencia && <details className="text-xs text-[#657360]">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">Ver fragmento original</summary>
          <p className="whitespace-pre-wrap">{original.evidencia}</p>
        </details>}
        {problemas.length > 0 && <ul aria-label="Datos pendientes" className="list-inside list-disc space-y-1 text-xs text-[#A34955]">
          {problemas.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
        </ul>}
      </>}
    </article>
  );
}
