'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  construirPeriodo, esPeriodoActual, leerPeriodoCreado, leerPeriodos, mensajePeriodo,
  type DatosPeriodos, type FormularioPeriodo, type PeriodoAcademico,
} from './periodosFrontend';

async function obtenerDatos(signal?: AbortSignal): Promise<DatosPeriodos> {
  const respuesta = await fetch('/api/periodos', { cache: 'no-store', signal });
  const contenido: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(mensajePeriodo(contenido, 'No se pudieron consultar los per\u00edodos.'));
  return leerPeriodos(contenido);
}

type Origen = 'dashboard' | 'ia';
type EstadoPeriodos = {
  datos: DatosPeriodos | null; cargando: boolean; errorConsulta: string | null; guardando: boolean;
  pospuesto: boolean; formulario: Origen | null;
  abrir: (origen: Origen) => void; posponer: () => void;
  recargar: () => Promise<DatosPeriodos | null>;
  guardar: (valores: FormularioPeriodo) => Promise<PeriodoAcademico>;
};
const ContextoPeriodos = createContext<EstadoPeriodos | null>(null);

export function usePeriodos() {
  const contexto = useContext(ContextoPeriodos);
  if (!contexto) throw new Error('El flujo de períodos necesita ProveedorPeriodos.');
  return contexto;
}

export default function ProveedorPeriodos({ children }: { children: ReactNode }) {
  const [datos, establecerDatos] = useState<DatosPeriodos | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [errorConsulta, establecerErrorConsulta] = useState<string | null>(null);
  const [guardando, establecerGuardando] = useState(false);
  const [pospuesto, establecerPospuesto] = useState(false);
  const [formulario, establecerFormulario] = useState<Origen | null>(null);
  const envioEnCurso = useRef(false);
  const versionConsulta = useRef(0);

  async function consultar(signal?: AbortSignal): Promise<DatosPeriodos | null> {
    const version = ++versionConsulta.current;
    try {
      const resultado = await obtenerDatos(signal);
      if (signal?.aborted || version !== versionConsulta.current) return null;
      establecerDatos(resultado);
      establecerErrorConsulta(null);
      return resultado;
    } catch (error) {
      if (!signal?.aborted && version === versionConsulta.current) {
        establecerErrorConsulta(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
      }
      return null;
    } finally {
      if (!signal?.aborted && version === versionConsulta.current) establecerCargando(false);
    }
  }

  useEffect(() => {
    const controlador = new AbortController();
    const version = ++versionConsulta.current;
    void obtenerDatos(controlador.signal).then((resultado) => {
      if (controlador.signal.aborted || version !== versionConsulta.current) return;
      establecerDatos(resultado);
      establecerErrorConsulta(null);
    }, (error: unknown) => {
      if (!controlador.signal.aborted && version === versionConsulta.current) {
        establecerErrorConsulta(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
      }
    }).finally(() => {
      if (!controlador.signal.aborted && version === versionConsulta.current) establecerCargando(false);
    });
    return () => controlador.abort();
  }, []);

  async function recargar() {
    establecerCargando(true);
    return consultar();
  }

  async function guardar(valores: FormularioPeriodo): Promise<PeriodoAcademico> {
    if (envioEnCurso.current) throw new Error('Ya se está guardando el período.');
    const body = construirPeriodo(valores);
    envioEnCurso.current = true;
    establecerGuardando(true);
    try {
      const respuesta = await fetch('/api/periodos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const contenido: unknown = await respuesta.json().catch(() => null);
      if (respuesta.status !== 201) throw new Error(mensajePeriodo(contenido, 'No se pudo guardar el período.'));
      const periodo = leerPeriodoCreado(contenido);
      // Invalidar una consulta anterior y actualizar inmediatamente tras el 201.
      ++versionConsulta.current;
      establecerDatos((anteriores) => ({
        periodos: [periodo, ...(anteriores?.periodos ?? []).filter((p) => p.id !== periodo.id)],
        actual: esPeriodoActual(periodo) ? periodo : anteriores?.actual ?? null,
      }));
      establecerErrorConsulta(null);
      establecerCargando(false);
      establecerPospuesto(true);
      establecerFormulario(null);
      // El servidor decide "actual"; guardar uno futuro no lo convierte en actual.
      await consultar();
      return periodo;
    } finally {
      envioEnCurso.current = false;
      establecerGuardando(false);
    }
  }

  return <ContextoPeriodos.Provider value={{
    datos, cargando, errorConsulta, guardando, pospuesto, formulario, recargar, guardar,
    abrir: (origen) => { if (!envioEnCurso.current) establecerFormulario(origen); },
    posponer: () => {
      if (envioEnCurso.current) return;
      establecerPospuesto(true);
      establecerFormulario(null);
    },
  }}>{children}</ContextoPeriodos.Provider>;
}
