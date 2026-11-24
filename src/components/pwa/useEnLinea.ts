'use client';
import { useSyncExternalStore } from 'react';

const suscribir = (aviso: () => void) => {
  window.addEventListener('online', aviso);
  window.addEventListener('offline', aviso);
  return () => {
    window.removeEventListener('online', aviso);
    window.removeEventListener('offline', aviso);
  };
};

/** true si hay internet. En el servidor (y en el primer render) se asume que sí. */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true);
}
