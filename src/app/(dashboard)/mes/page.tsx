import { connection } from 'next/server';
import AgendaMesVista from '@/components/calendario/AgendaMesVista';

export default async function PaginaMes() {
  await connection();
  return <div className="min-w-0 space-y-6 md:space-y-8">
    <header>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#708070]">Tu tiempo, en órbita</p>
      <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[#233E33] md:text-4xl">Calendario</h1>
      <p className="mt-2 text-sm text-[#768075]">Una mirada a tu mes, un día a la vez.</p>
    </header>
    <AgendaMesVista fechaActual={new Date().toISOString()} />
  </div>;
}
