'use client';

import { useEffect, useState } from 'react';
import { leerAgenda, type AgendaDia } from './agendaDia';
import { AGENDA_ACTUALIZADA } from './actualizacionAgenda';

type Carga = { clave: string; agenda: AgendaDia | null; error: string | null };

export function useAgendaRango(desde: string, hasta: string) {
  const [carga, establecerCarga] = useState<Carga | null>(null);
  const [intento, establecerIntento] = useState(0);
  const clave = `${desde}:${hasta}:${intento}`;

  useEffect(() => {
    const actualizar = () => establecerIntento((valor) => valor + 1);
    window.addEventListener(AGENDA_ACTUALIZADA, actualizar);
    return () => window.removeEventListener(AGENDA_ACTUALIZADA, actualizar);
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      try {
        const respuesta = await fetch(`/api/agenda?desde=${desde}&hasta=${hasta}`, {
          signal: controlador.signal, cache: 'no-store',
        });
        const datos: unknown = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(typeof datos === 'object' && datos !== null && 'error' in datos &&
            typeof datos.error === 'string' ? datos.error : 'No se pudo cargar tu agenda.');
        }
        const agenda = leerAgenda(datos);
        if (!controlador.signal.aborted) establecerCarga({ clave, agenda, error: null });
      } catch (error) {
        if (!controlador.signal.aborted) establecerCarga({
          clave, agenda: null,
          error: error instanceof Error ? error.message : 'No se pudo conectar con el servidor.',
        });
      }
    }
    void cargar();
    return () => controlador.abort();
  }, [desde, hasta, clave]);

  return {
    agenda: carga?.clave === clave ? carga.agenda : null,
    error: carga?.clave === clave ? carga.error : null,
    cargando: carga?.clave !== clave,
    recargar: () => establecerIntento((valor) => valor + 1),
  };
}
