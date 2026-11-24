'use client';
import { useEffect } from 'react';
import { limpiarDatosOffline } from '@/lib/pwa/cache';

/** En /login y /registro: borra lo guardado para usar sin conexión (puede ser de otra cuenta). */
export default function LimpiarDatosOffline() {
  useEffect(() => {
    void limpiarDatosOffline();
  }, []);
  return null;
}
