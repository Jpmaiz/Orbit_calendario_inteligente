import Link from 'next/link';

/** Cabecera del calendario: el título y el cambio Semana / Mes en una sola fila. */
export default function SelectorCalendario({ vista }: { vista: 'semana' | 'mes' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-[25px] font-bold tracking-[-0.02em] text-[#263D34]">Calendario</h1>
      <nav aria-label="Vista del calendario" className="flex rounded-full bg-[#E9EDE5] p-1">
        {(['semana', 'mes'] as const).map((opcion) => (
          <Link key={opcion} href={'/' + opcion} aria-current={vista === opcion ? 'page' : undefined}
            className={'inline-flex min-h-11 items-center rounded-full px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] ' +
              (vista === opcion ? 'bg-white font-semibold text-[#263D34] shadow-[0_1px_3px_rgba(35,79,69,.12)]' : 'font-medium text-[#647168] hover:text-[#263D34]')}>
            {opcion === 'semana' ? 'Semana' : 'Mes'}
          </Link>
        ))}
      </nav>
    </div>
  );
}
