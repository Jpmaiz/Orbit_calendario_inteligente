import { connection } from 'next/server';
import AgendaSemanaVista from '@/components/calendario/AgendaSemanaVista';

export default async function PaginaSemana() {
  await connection();
  return <div className="min-w-0 space-y-4 md:space-y-5">
    <header>
      <h1 className="text-sm font-semibold text-[#708070]">Calendario</h1>
    </header>
    <AgendaSemanaVista fechaActual={new Date().toISOString()} />
  </div>;
}
