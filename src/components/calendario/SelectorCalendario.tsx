import Link from 'next/link';
import IconoDashboard from '@/components/dashboard/IconoDashboard';

export default function SelectorCalendario({ vista }: { vista: 'semana' | 'mes' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Vista del calendario" className="inline-flex rounded-full border border-[#E0E9E3] bg-[#EDF2ED] p-1">
        {(['semana', 'mes'] as const).map((opcion) => (
          <Link key={opcion} href={'/' + opcion} aria-current={vista === opcion ? 'page' : undefined}
            className={'inline-flex min-h-11 items-center justify-center rounded-full px-7 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] ' +
              (vista === opcion ? 'bg-[#245C52] text-white shadow-sm' : 'text-[#657B70] hover:bg-white/70')}>
            {opcion === 'semana' ? 'Semana' : 'Mes'}
          </Link>
        ))}
      </nav>
      <Link href="/dia/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[#35695D] hover:bg-[#E7EDE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] sm:text-sm">
        <IconoDashboard nombre="mas" className="h-4 w-4" /> Agregar tarea
      </Link>
    </div>
  );
}
