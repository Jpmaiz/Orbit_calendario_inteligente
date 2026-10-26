'use client';

import Link from 'next/link';
import { esDificultad } from '@/tipos/tarea';
import type { Dificultad, TareaConHoraDefinida } from '@/tipos/tarea';
import { HORA_POR_TIPO, instanteEnZona } from '@/lib/fechas/resolverFecha';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type Materia = { id: string; nombre: string };
export type ValoresTarea = TareaConHoraDefinida & {
  titulo: string;
  tipo: string;
  fechaLimite: string;
  prioridad: string;
  duracionEstMin: number | null;
  dificultad: Dificultad;
  descripcion: string | null;
  materiaId: string | null;
  materia?: Materia | null;
};
type Props =
  | { modo?: 'crear'; valoresIniciales?: never; tareaId?: never }
  | { modo: 'editar'; valoresIniciales: ValoresTarea; tareaId: string };

// El formulario y la Vista Dia comparten el calendario de Bolivia.
export function fechaParaInput(valor: string): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(valor));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((valor) => valor.type === tipo)!.value;
  return parte('year') + '-' + parte('month') + '-' + parte('day') +
    'T' + parte('hour') + ':' + parte('minute');
}

export function fechaParaEnvio(fecha: string, hora: string, tipo: string, horaDefinida: boolean): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      (horaDefinida && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))) {
    return new Date(NaN);
  }
  const [y, m, d] = fecha.split('-').map(Number);
  const horaInterna = horaDefinida ? hora : HORA_POR_TIPO[tipo] ?? '23:59';
  const limite = instanteEnZona({ y, m, d }, horaInterna, 'America/La_Paz');
  if (Number.isNaN(limite.getTime()) || fechaParaInput(limite.toISOString()).slice(0, 10) !== fecha) {
    return new Date(NaN);
  }
  return limite;
}

type Campo = 'titulo' | 'tipo' | 'fechaLimite' | 'horaLimite' | 'duracionEstMin' | 'prioridad' | 'dificultad';
type DatosCreacion = Omit<ValoresTarea, 'materia'>;
type Duplicado = { pregunta: string; sugerenciasDiferencia: string[]; datos: DatosCreacion };

function leerDuplicado(valor: unknown): valor is { pregunta: string; sugerenciasDiferencia: string[] } {
  return typeof valor === 'object' && valor !== null &&
    'pregunta' in valor && typeof valor.pregunta === 'string' &&
    'sugerenciasDiferencia' in valor && Array.isArray(valor.sugerenciasDiferencia) &&
    valor.sugerenciasDiferencia.every((opcion: unknown) => typeof opcion === 'string');
}
const tipos = [
  ['tarea', 'Tarea'], ['examen', 'Examen'], ['entrega', 'Entrega'],
  ['exposicion', 'Exposición'], ['proyecto', 'Proyecto'],
];
const prioridades = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
const estiloCampo = 'mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-[#DCE3D8] bg-[#FAFBF7] px-3.5 py-3 text-sm text-[#263D34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60';
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4';

function mensajeError(datos: unknown, alternativa: string): string {
  return typeof datos === 'object' && datos !== null &&
    'error' in datos && typeof datos.error === 'string' && datos.error.trim()
    ? datos.error : alternativa;
}

function leerMaterias(datos: unknown): Materia[] {
  if (typeof datos !== 'object' || datos === null ||
      !('materias' in datos) || !Array.isArray(datos.materias)) {
    throw new Error('La respuesta de materias no es válida.');
  }
  return datos.materias.map((materia: unknown) => {
    if (typeof materia !== 'object' || materia === null ||
        !('id' in materia) || typeof materia.id !== 'string' ||
        !('nombre' in materia) || typeof materia.nombre !== 'string') {
      throw new Error('La respuesta de materias no es válida.');
    }
    return { id: materia.id, nombre: materia.nombre };
  });
}

export default function FormularioTarea(props: Props = {}) {
  const editando = props.modo === 'editar';
  const iniciales = props.valoresIniciales;
  const fechaInicial = iniciales ? fechaParaInput(iniciales.fechaLimite) : '';
  const [sinHora, establecerSinHora] = useState(iniciales?.horaDefinida === false);
  const [materiaSeleccionada, establecerMateriaSeleccionada] = useState(iniciales?.materiaId ?? '');
  const router = useRouter();
  const prefijo = useId();
  const [materias, establecerMaterias] = useState<Materia[]>([]);
  const [cargandoMaterias, establecerCargandoMaterias] = useState(true);
  const [errorMaterias, establecerErrorMaterias] = useState<string | null>(null);
  const [errores, establecerErrores] = useState<Partial<Record<Campo, string>>>({});
  const [error, establecerError] = useState<string | null>(null);
  const [enviando, establecerEnviando] = useState(false);
  const solicitudEnCurso = useRef(false);
  const avisoDuplicado = useRef<HTMLDivElement>(null);
  const [duplicado, establecerDuplicado] = useState<Duplicado | null>(null);
  const [otroNombre, establecerOtroNombre] = useState(false);
  const [nuevoTitulo, establecerNuevoTitulo] = useState('');
  const [errorTitulo, establecerErrorTitulo] = useState<string | null>(null);

  useEffect(() => {
    if (duplicado) avisoDuplicado.current?.focus();
  }, [duplicado]);

  useEffect(() => {
    const controlador = new AbortController();
    async function cargarMaterias() {
      try {
        const respuesta = await fetch('/api/materias', {
          signal: controlador.signal, cache: 'no-store',
        });
        const datos: unknown = await respuesta.json();
        if (!respuesta.ok) throw new Error(mensajeError(datos, 'No se pudieron cargar las materias.'));
        if (!controlador.signal.aborted) establecerMaterias(leerMaterias(datos));
      } catch (fallo) {
        if (!controlador.signal.aborted) {
          establecerErrorMaterias(fallo instanceof Error ? fallo.message : 'No se pudieron cargar las materias.');
        }
      } finally {
        if (!controlador.signal.aborted) establecerCargandoMaterias(false);
      }
    }
    void cargarMaterias();
    return () => controlador.abort();
  }, []);

  function accesibilidad(campo: Campo) {
    return {
      id: prefijo + '-' + campo,
      'aria-invalid': !!errores[campo],
      'aria-describedby': errores[campo] ? prefijo + '-' + campo + '-error' : undefined,
    };
  }

  function errorCampo(campo: Campo) {
    return errores[campo] && (
      <p id={prefijo + '-' + campo + '-error'} className="mt-2 text-xs leading-5 text-[#A34955]">
        {errores[campo]}
      </p>
    );
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (solicitudEnCurso.current || duplicado) return;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const titulo = String(datos.get('titulo') ?? '').trim();
    const tipo = String(datos.get('tipo') ?? '');
    const fechaLocal = String(datos.get('fechaLimite') ?? '');
    const horaLocal = String(datos.get('horaLimite') ?? '');
    const horaDefinida = !sinHora;
    const fechaLimite = fechaParaEnvio(fechaLocal, horaLocal, tipo, horaDefinida);
    const prioridad = String(datos.get('prioridad') ?? '');
    const duracionTexto = String(datos.get('duracionEstMin') ?? '').trim();
    const duracionInvalida = (formulario.elements.namedItem('duracionEstMin') as HTMLInputElement).validity.badInput;
    const duracionEstMin = duracionTexto === '' ? null : Number(duracionTexto);
    const dificultadTexto = String(datos.get('dificultad') ?? '');
    const dificultad = dificultadTexto === '' ? null : Number(dificultadTexto);
    const descripcion = String(datos.get('descripcion') ?? '').trim();
    const materiaId = materiaSeleccionada;
    const nuevosErrores: Partial<Record<Campo, string>> = {};
    if (!titulo) nuevosErrores.titulo = 'Escribe un título.';
    else if (titulo.length > 200) nuevosErrores.titulo = 'El título debe tener como máximo 200 caracteres.';
    if (!tipos.some(([valor]) => valor === tipo)) nuevosErrores.tipo = 'Selecciona un tipo de tarea.';
    if (!fechaLocal || Number.isNaN(fechaParaEnvio(fechaLocal, '', tipo, false).getTime())) {
      nuevosErrores.fechaLimite = 'Selecciona una fecha válida.';
    }
    if (horaDefinida && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaLocal)) {
      nuevosErrores.horaLimite = 'Selecciona una hora válida o marca Hora por definir.';
    }
    if (duracionInvalida || (duracionEstMin !== null && (!Number.isInteger(duracionEstMin) || duracionEstMin <= 0 || duracionEstMin > 6000))) {
      nuevosErrores.duracionEstMin = 'Ingresa una duración de 1 a 6000 minutos, sin decimales, o deja el campo vacío.';
    }
    if (!esDificultad(dificultad)) nuevosErrores.dificultad = 'Selecciona una dificultad de 1 a 5 o Sin definir.';
    if (!prioridades.some(([valor]) => valor === prioridad)) nuevosErrores.prioridad = 'Selecciona una prioridad.';
    establecerErrores(nuevosErrores);
    establecerError(null);
    const primerCampo = Object.keys(nuevosErrores)[0];
    if (primerCampo) {
      establecerError('Revisa los campos indicados antes de guardar la tarea.');
      (formulario.elements.namedItem(primerCampo) as HTMLElement | null)?.focus();
      return;
    }

    if (!esDificultad(dificultad)) return;

    const cambios: Partial<Omit<ValoresTarea, 'materia'>> = {};
    if (iniciales) {
      if (titulo !== iniciales.titulo) cambios.titulo = titulo;
      if (tipo !== iniciales.tipo) cambios.tipo = tipo;
      // No truncar segundos/milisegundos de la fecha guardada si no se edito.
      if (fechaLocal !== fechaInicial.slice(0, 10) ||
          horaDefinida !== iniciales.horaDefinida ||
          (horaDefinida && horaLocal !== fechaInicial.slice(11))) {
        cambios.fechaLimite = fechaLimite.toISOString();
      }
      if (horaDefinida !== iniciales.horaDefinida) cambios.horaDefinida = horaDefinida;
      if (prioridad !== iniciales.prioridad) cambios.prioridad = prioridad;
      if (duracionEstMin !== iniciales.duracionEstMin) cambios.duracionEstMin = duracionEstMin;
      if (dificultad !== iniciales.dificultad) cambios.dificultad = dificultad;
      if (descripcion !== (iniciales.descripcion ?? '')) cambios.descripcion = descripcion || null;
      if (materiaId !== (iniciales.materiaId ?? '')) cambios.materiaId = materiaId || null;
      if (Object.keys(cambios).length === 0) {
        establecerError('No hay cambios para guardar.');
        return;
      }
    }

    const creacion: DatosCreacion = {
      titulo, tipo, fechaLimite: fechaLimite.toISOString(), horaDefinida,
      prioridad, duracionEstMin, dificultad,
      descripcion: descripcion || null, materiaId: materiaId || null,
    };
    establecerDuplicado(null);
    await guardar(editando ? cambios : creacion, false, editando ? undefined : creacion);
  }

  async function guardar(
    datos: Partial<DatosCreacion>,
    confirmarNueva = false,
    creacion?: DatosCreacion,
  ) {
    if (solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    establecerEnviando(true);
    establecerError(null);
    try {
      const respuesta = await fetch(editando ? '/api/tareas/' + encodeURIComponent(props.tareaId) : '/api/tareas', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, ...(!editando && confirmarNueva ? { confirmarNueva: true } : {}) }),
      });
      if (!respuesta.ok) {
        const resultado: unknown = await respuesta.json().catch(() => null);
        if (!editando && respuesta.status === 409 && creacion && leerDuplicado(resultado)) {
          establecerDuplicado({ pregunta: resultado.pregunta, sugerenciasDiferencia: resultado.sugerenciasDiferencia, datos: creacion });
          establecerOtroNombre(false);
          establecerNuevoTitulo('');
          establecerErrorTitulo(null);
          return;
        }
        establecerError(mensajeError(resultado, editando ? 'No se pudieron guardar los cambios. Intenta de nuevo.' : 'No se pudo crear la tarea. Intenta de nuevo.'));
        return;
      }
      router.push('/dia');
      router.refresh();
    } catch {
      establecerError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      solicitudEnCurso.current = false;
      establecerEnviando(false);
    }
  }

  function confirmarDuplicado(titulo: string) {
    if (!duplicado || solicitudEnCurso.current) return;
    const final = titulo.trim();
    if (!final || final.length > 200) {
      establecerOtroNombre(true);
      establecerNuevoTitulo(titulo);
      establecerErrorTitulo('El título debe tener entre 1 y 200 caracteres.');
      return;
    }
    establecerErrorTitulo(null);
    const datos = { ...duplicado.datos, titulo: final };
    void guardar(datos, true, datos);
  }

  return (
    <form onSubmit={enviar} noValidate aria-busy={enviando} className="min-w-0 rounded-[28px] border border-[#E4E8DF] bg-white p-5 shadow-[0_3px_14px_rgba(38,61,52,0.035)] md:p-8">
      <p className="mb-6 text-sm leading-6 text-[#647168]">Los campos con * son obligatorios.</p>
      <fieldset disabled={enviando || duplicado !== null} className="min-w-0 space-y-5">
        <legend className="sr-only">{editando ? 'Datos de la tarea' : 'Datos de la nueva tarea'}</legend>
        <div>
          <label htmlFor={prefijo + '-titulo'} className="text-sm font-semibold">Título *</label>
          <input {...accesibilidad('titulo')} name="titulo" defaultValue={iniciales?.titulo ?? ''} type="text" required maxLength={200} className={estiloCampo} />
          {errorCampo('titulo')}
        </div>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor={prefijo + '-tipo'} className="text-sm font-semibold">Tipo *</label>
            <select {...accesibilidad('tipo')} name="tipo" required defaultValue={iniciales?.tipo ?? ''} className={estiloCampo}>
              <option value="" disabled>Selecciona un tipo</option>
              {tipos.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
            </select>
            {errorCampo('tipo')}
          </div>
          <div className="min-w-0">
            <label htmlFor={prefijo + '-fechaLimite'} className="text-sm font-semibold">Fecha límite *</label>
            <input {...accesibilidad('fechaLimite')} name="fechaLimite" defaultValue={fechaInicial.slice(0, 10)} type="date" required className={estiloCampo} />
            {errorCampo('fechaLimite')}
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[#35695D]">
              <input
                type="checkbox"
                name="sinHora"
                checked={sinHora}
                onChange={(evento) => {
                  establecerSinHora(evento.target.checked);
                  establecerErrores((actuales) => ({ ...actuales, horaLimite: undefined }));
                }}
                className="h-4 w-4 shrink-0 accent-[#35695D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-2"
              />
              Hora por definir
            </label>
            {!sinHora && (
              <div className="mt-2">
                <label htmlFor={prefijo + '-horaLimite'} className="text-sm font-semibold">Hora límite *</label>
                <input {...accesibilidad('horaLimite')} name="horaLimite" defaultValue={iniciales?.horaDefinida ? fechaInicial.slice(11) : ''} type="time" required className={estiloCampo} />
                {errorCampo('horaLimite')}
              </div>
            )}
            <p className="mt-2 text-xs leading-5 text-[#647168]">
              {sinHora ? 'Elige la fecha. Puedes definir la hora más adelante.' : 'Fecha y hora de Bolivia (America/La_Paz).'}
            </p>
          </div>
          <div>
            <label htmlFor={prefijo + '-prioridad'} className="text-sm font-semibold">Prioridad</label>
            <select {...accesibilidad('prioridad')} name="prioridad" defaultValue={iniciales?.prioridad ?? 'media'} className={estiloCampo}>
              {prioridades.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
            </select>
            {errorCampo('prioridad')}
          </div>
          <div>
            <label htmlFor={prefijo + '-duracionEstMin'} className="text-sm font-semibold">Duración estimada (minutos) <span className="font-normal text-[#647168]">(opcional)</span></label>
            <input {...accesibilidad('duracionEstMin')} name="duracionEstMin" type="number" min={1} max={6000} step={1} placeholder="Sin estimar" defaultValue={iniciales?.duracionEstMin ?? ''} className={estiloCampo} />
            {errorCampo('duracionEstMin')}
          </div>
          <div>
            <label htmlFor={prefijo + '-dificultad'} className="text-sm font-semibold">Dificultad <span className="font-normal text-[#647168]">(opcional)</span></label>
            <select {...accesibilidad('dificultad')} name="dificultad" defaultValue={iniciales?.dificultad ?? ''} className={estiloCampo}>
              <option value="">Sin definir</option>
              <option value="1">1 Muy fácil</option>
              <option value="2">2 Fácil</option>
              <option value="3">3 Media</option>
              <option value="4">4 Difícil</option>
              <option value="5">5 Muy difícil</option>
            </select>
            {errorCampo('dificultad')}
          </div>
        </div>
        <div>
          <label htmlFor={prefijo + '-descripcion'} className="text-sm font-semibold">Descripción <span className="font-normal text-[#647168]">(opcional)</span></label>
          <textarea id={prefijo + '-descripcion'} name="descripcion" defaultValue={iniciales?.descripcion ?? ''} rows={4} maxLength={2000} className={estiloCampo + ' resize-y'} />
        </div>
        <div>
          <label htmlFor={prefijo + '-materiaId'} className="text-sm font-semibold">Materia <span className="font-normal text-[#647168]">(opcional)</span></label>
          <select id={prefijo + '-materiaId'} name="materiaId" value={materiaSeleccionada} onChange={(evento) => establecerMateriaSeleccionada(evento.target.value)} disabled={cargandoMaterias || !!errorMaterias} aria-describedby={prefijo + '-materias-estado'} className={estiloCampo}>
            <option value="">Sin materia</option>
            {iniciales?.materiaId && !materias.some((materia) => materia.id === iniciales.materiaId) && (
              <option value={iniciales.materiaId}>{iniciales.materia?.nombre ?? 'Materia actual'}</option>
            )}
            {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre}</option>)}
          </select>
          <p id={prefijo + '-materias-estado'} role={errorMaterias ? 'alert' : 'status'} className={'mt-2 text-xs leading-5 ' + (errorMaterias ? 'text-[#A34955]' : 'text-[#647168]')}>
            {cargandoMaterias ? 'Cargando materias…' : errorMaterias ? errorMaterias + (editando ? ' Se conservará la materia actual.' : ' Puedes crear la tarea sin materia.') : materias.length === 0 ? editando ? 'No hay materias disponibles para seleccionar. Puedes conservar la materia actual o elegir Sin materia.' : 'No tienes materias registradas. Puedes crear la tarea sin materia.' : 'Selecciona una materia o deja la tarea sin materia.'}
          </p>
        </div>
      </fieldset>
      {duplicado && (
        <div ref={avisoDuplicado} tabIndex={-1} role="region" aria-labelledby={prefijo + '-duplicado'} className="mt-6 min-w-0 rounded-2xl border border-[#E6D7AC] bg-[#FCF7E8] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B30]">
          <p id={prefijo + '-duplicado'} className="whitespace-pre-wrap break-words text-sm leading-6 text-[#675223]">{duplicado.pregunta}</p>
          <p className="mt-2 text-xs leading-5 text-[#675223]">Se conservaron los datos del formulario.</p>
          <fieldset disabled={enviando} className="mt-4 min-w-0 space-y-4">
            <legend className="sr-only">Resolver posible duplicado</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { establecerDuplicado(null); establecerError(null); }} className={'min-h-11 rounded-xl border border-[#D8C99E] bg-white px-3 py-2 text-sm text-[#675223] disabled:opacity-60 ' + foco}>Es la misma</button>
              {duplicado.sugerenciasDiferencia.map((opcion, indice) => (
                <button key={indice} type="button" onClick={() => confirmarDuplicado(duplicado.datos.titulo + ' (' + opcion + ')')} className={'min-h-11 max-w-full break-words rounded-xl border border-[#D8C99E] bg-white px-3 py-2 text-sm text-[#675223] disabled:opacity-60 ' + foco}>{opcion}</button>
              ))}
              <button type="button" aria-expanded={otroNombre} aria-controls={prefijo + '-otro-nombre-panel'} onClick={() => establecerOtroNombre(true)} className={'min-h-11 rounded-xl border border-[#D8C99E] bg-white px-3 py-2 text-sm text-[#675223] disabled:opacity-60 ' + foco}>Otro nombre.</button>
              <button type="button" onClick={() => confirmarDuplicado(duplicado.datos.titulo)} className={'min-h-11 rounded-xl bg-[#234F45] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ' + foco}>Guardar igual</button>
            </div>
            {otroNombre && (
              <div id={prefijo + '-otro-nombre-panel'}>
                <label htmlFor={prefijo + '-otro-nombre'} className="text-sm font-semibold text-[#675223]">Título diferente</label>
                <input id={prefijo + '-otro-nombre'} type="text" value={nuevoTitulo} onChange={(evento) => establecerNuevoTitulo(evento.target.value)} onKeyDown={(evento) => { if (evento.key === 'Enter') { evento.preventDefault(); confirmarDuplicado(nuevoTitulo); } }} maxLength={200} aria-invalid={!!errorTitulo} aria-describedby={errorTitulo ? prefijo + '-otro-nombre-error' : undefined} className={estiloCampo} />
                {errorTitulo && <p id={prefijo + '-otro-nombre-error'} role="alert" className="mt-2 text-xs text-[#A34955]">{errorTitulo}</p>}
                <button type="button" onClick={() => confirmarDuplicado(nuevoTitulo)} className={'mt-3 min-h-11 rounded-xl bg-[#234F45] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ' + foco}>Guardar con este título</button>
              </div>
            )}
            <button type="button" onClick={() => { establecerDuplicado(null); establecerError(null); }} className={'min-h-11 rounded-lg px-2 text-sm font-medium text-[#675223] underline underline-offset-4 ' + foco}>Volver al formulario</button>
          </fieldset>
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {error && <p role="alert" className="mt-6 break-words rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">{error}</p>}
      </div>
      <div className="mt-7 flex flex-col gap-3 border-t border-[#EBEEE6] pt-6 sm:flex-row sm:justify-end">
        {enviando ? <span aria-disabled="true" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm text-[#78827B]">Cancelar</span> : <Link href="/dia" className={'inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-[#35695D] hover:bg-[#E7EDE6] ' + foco}>Cancelar</Link>}
        <button type="submit" disabled={enviando || duplicado !== null} className={'min-h-11 rounded-xl bg-[#234F45] px-6 py-3 text-sm font-semibold text-white hover:bg-[#316457] disabled:cursor-wait disabled:opacity-60 ' + foco}>
          {enviando ? (editando ? 'Guardando cambios…' : 'Creando tarea…') : (editando ? 'Guardar cambios' : 'Crear tarea')}
        </button>
      </div>
      {enviando && <p role="status" className="mt-3 text-sm text-[#35695D]">Guardando tu tarea…</p>}
    </form>
  );
}
