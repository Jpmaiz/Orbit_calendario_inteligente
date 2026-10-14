type NombreIcono = 'home' | 'calendario' | 'orbit' | 'perfil' | 'reloj' | 'ubicacion' | 'mas' | 'cerrar';

export default function IconoDashboard({
  nombre,
  className = 'h-5 w-5',
}: {
  nombre: NombreIcono;
  className?: string;
}) {
  const trazos: Record<NombreIcono, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
    calendario: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1" /></>,
    orbit: <><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)" /><circle cx="12" cy="12" r="2.5" /><circle cx="19" cy="5" r="1.5" fill="currentColor" /></>,
    perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    ubicacion: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    mas: <path d="M12 5v14M5 12h14" />,
    cerrar: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {trazos[nombre]}
    </svg>
  );
}
