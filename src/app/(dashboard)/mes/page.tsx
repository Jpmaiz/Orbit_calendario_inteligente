import { connection } from 'next/server';
import AgendaMesVista from '@/components/calendario/AgendaMesVista';

export default async function PaginaMes() {
  await connection();
  return <div className="min-w-0">
    <AgendaMesVista fechaActual={new Date().toISOString()} />
  </div>;
}
