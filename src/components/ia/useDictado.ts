'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Dictado con el reconocimiento de voz del navegador (Chrome, Edge, Safari).
 * Gratis y sin backend: el texto dictado entra al mismo campo y sigue el flujo normal.
 * Si el navegador no lo tiene, `disponible` es false y el botón no se muestra
 * (en el celular siempre queda el micrófono del teclado).
 */
type Reconocimiento = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
};
type ClaseReconocimiento = new () => Reconocimiento;

function claseReconocimiento(): ClaseReconocimiento | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: ClaseReconocimiento; webkitSpeechRecognition?: ClaseReconocimiento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const sinSuscripcion = () => () => {};

export function useDictado(alTexto: (texto: string) => void) {
  // En el servidor no hay micrófono; en el navegador se detecta sin romper la hidratación
  const disponible = useSyncExternalStore(sinSuscripcion, () => claseReconocimiento() !== null, () => false);
  const [escuchando, establecerEscuchando] = useState(false);
  const rec = useRef<Reconocimiento | null>(null);
  const alTextoRef = useRef(alTexto);

  useEffect(() => { alTextoRef.current = alTexto; });
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* ya estaba detenido */ } }, []);

  function alternar() {
    if (escuchando) { rec.current?.stop(); return; }
    const Clase = claseReconocimiento();
    if (!Clase) return;
    if (!rec.current) {
      const r = new Clase();
      r.lang = 'es-BO';
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        const partes: string[] = [];
        for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) partes.push(e.results[i][0].transcript);
        if (partes.length) alTextoRef.current(partes.join(' ').trim());
      };
      r.onend = () => establecerEscuchando(false);
      r.onerror = () => establecerEscuchando(false);
      rec.current = r;
    }
    try { rec.current.start(); establecerEscuchando(true); } catch { establecerEscuchando(false); }
  }

  return { disponible, escuchando, alternar };
}
