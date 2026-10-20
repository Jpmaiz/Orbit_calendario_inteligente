'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import FormularioTarea from '@/components/formularios/FormularioTarea';
import { esDificultad } from '@/tipos/tarea';
import type { ValoresTarea } from '@/components/formularios/FormularioTarea';

type Carga =
  | { id: string; estado: 'cargando' }
  | { id: string; estado: 'error'; mensaje: string }
  | { id: string; estado: 'no-encontrada' }
  | { id: string; estado: 'lista'; tarea: ValoresTarea };

function leerTarea(datos: unknown, id: string): ValoresTarea | null {
  if (typeof datos !== 'object' || datos === null ||
      !('tareas' in datos) || !Array.isArray(datos.tareas)) {
    throw new Error('La respuesta de tareas no es válida.');
  }
  const tarea: unknown = datos.tareas.find((valor: unknown) =>
    typeof valor === 'object' && valor !== null && 'id' in valor && valor.id === id);
  if (!tarea) return null;
  if (typeof tarea !== 'object' || tarea === null ||
      !('titulo' in tarea) || typeof tarea.titulo !== 'string' ||
      !('tipo' in tarea) || typeof tarea.tipo !== 'string' ||
      !('fechaLimite' in tarea) || typeof tarea.fechaLimite !== 'string' ||
      Number.isNaN(new Date(tarea.fechaLimite).getTime()) ||
      !('prioridad' in tarea) || typeof tarea.prioridad !== 'string' ||
      !('duracionEstMin' in tarea) || (tarea.duracionEstMin !== null && typeof tarea.duracionEstMin !== 'number') ||
      !('dificultad' in tarea) || !esDificultad(tarea.dificultad) ||
      !('descripcion' in tarea) || (tarea.descripcion !== null && typeof tarea.descripcion !== 'string') ||
      !('materiaId' in tarea) || (tarea.materiaId !== null && typeof tarea.materiaId !== 'string')) {
    throw new Error('Los datos de la tarea no son válidos.');
  }
  const materia = 'materia' in tarea && typeof tarea.materia === 'object' && tarea.materia !== null &&
    'id' in tarea.materia && typeof tarea.materia.id === 'string' &&
    'nombre' in tarea.materia && typeof tarea.materia.nombre === 'string'
    ? { id: tarea.materia.id, nombre: tarea.materia.nombre } : null;
  return {
    titulo: tarea.titulo, tipo: tarea.tipo, fechaLimite: tarea.fechaLimite,
    prioridad: tarea.prioridad, duracionEstMin: tarea.duracionEstMin, dificultad: tarea.dificultad,
    descripcion: tarea.descripcion, materiaId: tarea.materiaId, materia,
  };
}

export default function PaginaEditarTarea() {
  const { id } = useParams<{ id: string }>();
  const [carga, establecerCarga] = useState<Carga>({ id, estado: 'cargando' });

  useEffect(() => {
    const controlador = new AbortController();
    async function cargarTarea() {
      try {
        const respuesta = await fetch('/api/tareas', {
          signal: controlador.signal, cache: 'no-store',
        });
        const datos: unknown = await respuesta.json().catch(() => null);
        if (!respuesta.ok) {
          const mensaje = typeof datos === 'object' && datos !== null &&
            'error' in datos && typeof datos.error === 'string'
            ? datos.error : 'No se pudo cargar la tarea. Intenta de nuevo.';
          throw new Error(mensaje);
        }
        const tarea = leerTarea(datos, id);
        if (!controlador.signal.aborted) {
          establecerCarga(tarea ? { id, estado: 'lista', tarea } : { id, estado: 'no-encontrada' });
        }
      } catch (fallo) {
        if (!controlador.signal.aborted) {
          establecerCarga({ id, estado: 'error', mensaje: fallo instanceof TypeError ? 'No se pudo conectar con el servidor. Intenta de nuevo.' : fallo instanceof Error ? fallo.message : 'No se pudo cargar la tarea.' });
        }
      }
    }
    void cargarTarea();
    return () => controlador.abort();
  }, [id]);

  const estadoActual = carga.id === id ? carga : { id, estado: 'cargando' as const };

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 md:space-y-8">
      <header>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#708070]">Organiza tu día</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em] text-[#233E33] md:text-4xl">Editar tarea</h1>
        <p className="mt-2 text-sm leading-6 text-[#647168]">Actualiza los datos de tu tarea.</p>
      </header>
      {estadoActual.estado === 'lista' ? (
        <FormularioTarea key={id} modo="editar" tareaId={id} valoresIniciales={estadoActual.tarea} />
      ) : (
        <section aria-busy={estadoActual.estado === 'cargando'} className="min-w-0 rounded-[28px] border border-[#E4E8DF] bg-white p-5 md:p-8">
          {estadoActual.estado === 'cargando' ? (
            <p role="status" className="text-sm text-[#35695D]">Cargando tarea…</p>
          ) : (
            <>
              <p role="alert" className="break-words rounded-xl border border-[#EED4D7] bg-[#FCF0F1] px-4 py-3 text-sm leading-6 text-[#A34955]">
                {estadoActual.estado === 'no-encontrada'
                  ? 'No se encontró esta tarea. Puede haber sido eliminada o no estar disponible para tu cuenta.'
                  : estadoActual.mensaje}
              </p>
              <Link href="/dia" className="mt-5 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-[#35695D] hover:bg-[#E7EDE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4">Volver a Día</Link>
            </>
          )}
        </section>
      )}
    </div>
  );
}
