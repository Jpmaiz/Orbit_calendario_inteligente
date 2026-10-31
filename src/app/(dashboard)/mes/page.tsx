import { connection } from 'next/server';
import AgendaMesVista from '@/components/calendario/AgendaMesVista';

export default async function PaginaMes() {
  await connection();
  return <div className="min-w-0 space-y-4 md:space-y-5">
    <header>
      <p className="text-sm font-semibold text-[#708070]">Calendario</p>
    </header>
    <AgendaMesVista fechaActual={new Date().toISOString()} />
  </div>;
}
