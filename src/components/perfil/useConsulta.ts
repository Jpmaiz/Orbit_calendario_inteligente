'use client';

import { useEffect, useState } from 'react';
import { AGENDA_ACTUALIZADA } from '../calendario/actualizacionAgenda';

type Consulta<T> = { datos: T | null; error: boolean };

/** GET con lector propio; se vuelve a pedir cuando la agenda cambia (plan guardado, compromisos nuevos…). */
export function useConsulta<T>(url: string, leer: (valor: unknown) => T) {
  const [carga, establecerCarga] = useState<Consulta<T> | null>(null);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    const actualizar = () => establecerRevision((valor) => valor + 1);
    window.addEventListener(AGENDA_ACTUALIZADA, actualizar);
    return () => window.removeEventListener(AGENDA_ACTUALIZADA, actualizar);
  }, []);
  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      try {
        const respuesta = await fetch(url, { signal: controlador.signal, cache: 'no-store' });
        if (!respuesta.ok) throw new Error('No se pudo cargar.');
        const datos = leer(await respuesta.json());
        if (!controlador.signal.aborted) establecerCarga({ datos, error: false });
      } catch {
        if (!controlador.signal.aborted) establecerCarga({ datos: null, error: true });
      }
    }
    void cargar();
    return () => controlador.abort();
  }, [url, leer, revision]);
  return { carga, recargar: () => establecerRevision((valor) => valor + 1) };
}
