'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type Materia = { id: string; nombre: string };
export type ValoresTarea = {
  titulo: string;
  tipo: string;
  fechaLimite: string;
  prioridad: string;
  duracionEstMin: number;
  descripcion: string | null;
  materiaId: string | null;
  materia?: Materia | null;
};
type Props =
  | { modo?: 'crear'; valoresIniciales?: never; tareaId?: never }
  | { modo: 'editar'; valoresIniciales: ValoresTarea; tareaId: string };

// datetime-local usa la hora del dispositivo; no la representacion UTC del ISO.
export function fechaParaInput(valor: string): string {
  const fecha = new Date(valor);
  const dosDigitos = (numero: number) => String(numero).padStart(2, '0');
  return fecha.getFullYear() + '-' + dosDigitos(fecha.getMonth() + 1) + '-' +
    dosDigitos(fecha.getDate()) + 'T' + dosDigitos(fecha.getHours()) + ':' +
    dosDigitos(fecha.getMinutes());
}

type Campo = 'titulo' | 'tipo' | 'fechaLimite' | 'duracionEstMin' | 'prioridad';
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
    if (solicitudEnCurso.current) return;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const titulo = String(datos.get('titulo') ?? '').trim();
    const tipo = String(datos.get('tipo') ?? '');
    const fechaLocal = String(datos.get('fechaLimite') ?? '');
    const prioridad = String(datos.get('prioridad') ?? '');
    const duracionEstMin = Number(datos.get('duracionEstMin'));
    const descripcion = String(datos.get('descripcion') ?? '').trim();
    const materiaId = materiaSeleccionada;
    const nuevosErrores: Partial<Record<Campo, string>> = {};
    if (!titulo) nuevosErrores.titulo = 'Escribe un título.';
    else if (titulo.length > 200) nuevosErrores.titulo = 'El título debe tener como máximo 200 caracteres.';
    if (!tipos.some(([valor]) => valor === tipo)) nuevosErrores.tipo = 'Selecciona un tipo de tarea.';
    if (!fechaLocal || Number.isNaN(new Date(fechaLocal).getTime())) nuevosErrores.fechaLimite = 'Selecciona una fecha y hora válidas.';
    if (!Number.isInteger(duracionEstMin) || duracionEstMin <= 0 || duracionEstMin > 1440) {
      nuevosErrores.duracionEstMin = 'Ingresa una duración de 1 a 1440 minutos, sin decimales.';
    }
    if (!prioridades.some(([valor]) => valor === prioridad)) nuevosErrores.prioridad = 'Selecciona una prioridad.';
    establecerErrores(nuevosErrores);
    establecerError(null);
    const primerCampo = Object.keys(nuevosErrores)[0];
    if (primerCampo) {
      establecerError('Revisa los campos indicados antes de guardar la tarea.');
      (formulario.elements.namedItem(primerCampo) as HTMLElement | null)?.focus();
      return;
    }

    const cambios: Partial<Omit<ValoresTarea, 'materia'>> = {};
    if (iniciales) {
      if (titulo !== iniciales.titulo) cambios.titulo = titulo;
      if (tipo !== iniciales.tipo) cambios.tipo = tipo;
      // No truncar segundos/milisegundos de la fecha guardada si no se edito.
      if (fechaLocal !== fechaInicial) cambios.fechaLimite = new Date(fechaLocal).toISOString();
      if (prioridad !== iniciales.prioridad) cambios.prioridad = prioridad;
      if (duracionEstMin !== iniciales.duracionEstMin) cambios.duracionEstMin = duracionEstMin;
      if (descripcion !== (iniciales.descripcion ?? '')) cambios.descripcion = descripcion || null;
      if (materiaId !== (iniciales.materiaId ?? '')) cambios.materiaId = materiaId || null;
      if (Object.keys(cambios).length === 0) {
        establecerError('No hay cambios para guardar.');
        return;
      }
    }

    solicitudEnCurso.current = true;
    establecerEnviando(true);
    try {
      const respuesta = await fetch(editando ? '/api/tareas/' + encodeURIComponent(props.tareaId) : '/api/tareas', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando ? cambios : {
          titulo, tipo, fechaLimite: new Date(fechaLocal).toISOString(),
          prioridad, duracionEstMin,
          ...(descripcion ? { descripcion } : {}),
          ...(materiaId ? { materiaId } : {}),
        }),
      });
      if (!respuesta.ok) {
        const resultado: unknown = await respuesta.json().catch(() => null);
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

  return (
    <form onSubmit={enviar} noValidate aria-busy={enviando} className="min-w-0 rounded-[28px] border border-[#E4E8DF] bg-white p-5 shadow-[0_3px_14px_rgba(38,61,52,0.035)] md:p-8">
      <p className="mb-6 text-sm leading-6 text-[#647168]">Los campos con * son obligatorios.</p>
      <fieldset disabled={enviando} className="min-w-0 space-y-5">
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
            <input {...accesibilidad('fechaLimite')} name="fechaLimite" defaultValue={fechaInicial} type="datetime-local" required className={estiloCampo} />
            {errorCampo('fechaLimite')}
            <p className="mt-2 text-xs leading-5 text-[#647168]">Se usa la hora local de tu dispositivo.</p>
          </div>
          <div>
            <label htmlFor={prefijo + '-prioridad'} className="text-sm font-semibold">Prioridad</label>
            <select {...accesibilidad('prioridad')} name="prioridad" defaultValue={iniciales?.prioridad ?? 'media'} className={estiloCampo}>
              {prioridades.map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
            </select>
            {errorCampo('prioridad')}
          </div>
          <div>
            <label htmlFor={prefijo + '-duracionEstMin'} className="text-sm font-semibold">Duración estimada (minutos) *</label>
            <input {...accesibilidad('duracionEstMin')} name="duracionEstMin" type="number" required min={1} max={1440} step={1} defaultValue={iniciales?.duracionEstMin ?? 60} className={estiloCampo} />
            {errorCampo('duracionEstMin')}
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
      <div aria-live="polite" aria-atomic="true">
        {error && <p role="alert" className="mt-6 break-words rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">{error}</p>}
      </div>
      <div className="mt-7 flex flex-col gap-3 border-t border-[#EBEEE6] pt-6 sm:flex-row sm:justify-end">
        {enviando ? <span aria-disabled="true" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm text-[#78827B]">Cancelar</span> : <Link href="/dia" className={'inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-[#35695D] hover:bg-[#E7EDE6] ' + foco}>Cancelar</Link>}
        <button type="submit" disabled={enviando} className={'min-h-11 rounded-xl bg-[#234F45] px-6 py-3 text-sm font-semibold text-white hover:bg-[#316457] disabled:cursor-wait disabled:opacity-60 ' + foco}>
          {enviando ? (editando ? 'Guardando cambios…' : 'Creando tarea…') : (editando ? 'Guardar cambios' : 'Crear tarea')}
        </button>
      </div>
      {enviando && <p role="status" className="mt-3 text-sm text-[#35695D]">Guardando tu tarea…</p>}
    </form>
  );
}
