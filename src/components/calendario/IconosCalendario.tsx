import type { TipoHito } from './hitosCalendario';

/** Gema = examen, bandera = entrega, punto = evento: la forma dice el tipo, el color solo acompaña. */
export function IconoHito({ tipo, className = 'h-3 w-3' }: { tipo: TipoHito; className?: string }) {
  if (tipo === 'examen') return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><path d="M12 2.5 21.5 9.4 17.9 20.6H6.1L2.5 9.4Z" fill="currentColor" /></svg>;
  if (tipo === 'evento') return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}><circle cx="12" cy="12" r="9" fill="currentColor" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 21V4m0 0h12l-2.5 4.5L17 13H5" />
  </svg>;
}

export function IconoActividad({ tipo, className = 'h-4 w-4' }: { tipo: 'clase' | 'evento' | 'estudio' | 'examen'; className?: string }) {
  if (tipo === 'examen') return <IconoHito tipo="examen" className="h-3.5 w-3.5" />;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {tipo === 'clase' && <><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H3z" /><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z" /></>}
    {tipo === 'estudio' && <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />}
    {tipo === 'evento' && <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>}
  </svg>;
}

export function Flecha({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d={direccion === 'izquierda' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
  </svg>;
}
