import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = { title: 'Sin conexión — Orbit' };

/** Se muestra sin internet cuando la pantalla pedida nunca se abrió antes (no hay copia guardada). */
export default function SinConexion() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <Image src="/icons/icon-192.png" alt="" width={72} height={72} priority />
      <h1 className="text-xl font-semibold text-[#263D34]">Sin conexión</h1>
      <p className="max-w-sm text-sm text-[#647168]">
        Esta pantalla todavía no estaba guardada en tu teléfono. Cuando vuelvas a tener internet, Orbit se actualiza solo.
      </p>
    </main>
  );
}
