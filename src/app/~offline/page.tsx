import type { Metadata } from 'next';
import Dodecaedro from '@/components/marca/Dodecaedro';

export const metadata: Metadata = { title: 'Sin conexión — Orbit' };

/**
 * Se muestra sin internet cuando la pantalla pedida nunca se abrió antes (no hay copia guardada).
 * Todo va dentro de la página (logo en SVG, colores fijos): sin conexión no se puede pedir nada más.
 */
export default function SinConexion() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 bg-[#F6F7F2] px-8 py-16 text-center text-[#263D34]">
      <Dodecaedro relleno className="h-16 w-16" titulo="Orbit" />
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-sm text-[#647168]">
        Esta pantalla todavía no estaba guardada en tu teléfono. Cuando vuelvas a tener internet, Orbit se actualiza solo.
      </p>
    </main>
  );
}
