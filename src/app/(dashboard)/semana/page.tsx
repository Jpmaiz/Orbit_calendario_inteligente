import { connection } from 'next/server';
import AgendaSemanaVista from '@/components/calendario/AgendaSemanaVista';

export default async function PaginaSemana({ searchParams }: { searchParams: Promise<{ dia?: string | string[] }> }) {
  await connection();
  // Desde Mes, «Ver el día en Semana» llega con ?dia=AAAA-MM-DD.
  const { dia } = await searchParams;
  const diaInicial = typeof dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dia) && !Number.isNaN(Date.parse(dia)) ? dia : null;
  return <div className="min-w-0">
    <AgendaSemanaVista fechaActual={new Date().toISOString()} diaInicial={diaInicial} />
  </div>;
}
