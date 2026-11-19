'use client';

import { useEffect, useState } from 'react';

/** La hora actual, refrescada cada 30 s (órbita y línea de "Hoy" se mueven solas). */
export function useAhora(cadaMs = 30_000): Date {
  const [ahora, establecerAhora] = useState(() => new Date());
  useEffect(() => {
    const reloj = setInterval(() => establecerAhora(new Date()), cadaMs);
    return () => clearInterval(reloj);
  }, [cadaMs]);
  return ahora;
}
