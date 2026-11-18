/**
 * Íconos de Home, Calendario y Perfil en la barra de navegación, con el trazo del logo
 * (líneas rectas y el pentágono de las caras del dodecaedro).
 * La animación vive en globals.css (`orbit-nav-*`) y se enciende con `aria-current="page"` en la pestaña:
 * el borde se entinta, la cara se llena de abajo arriba, la cruza un brillo y cada ícono hace su gesto.
 */
type NombreNavegacion = 'home' | 'calendario' | 'perfil';

const CASA = 'M12 3.4 20.94 9.9 17.53 20.4H6.47L3.06 9.9Z';
const HOJA = 'M6.7 5H17.3A3.2 3.2 0 0 1 20.5 8.2V17.3A3.2 3.2 0 0 1 17.3 20.5H6.7A3.2 3.2 0 0 1 3.5 17.3V8.2A3.2 3.2 0 0 1 6.7 5Z';
const CABEZA = 'M12 4.9A3.7 3.7 0 1 1 12 12.3A3.7 3.7 0 1 1 12 4.9Z';
const HOMBROS = 'M4.8 20.4C5.7 16.5 8.5 14.3 12 14.3S18.3 16.5 19.2 20.4';

/** cara: la figura que se rellena (y recorta el brillo); contorno: el trazo que se entinta, desde su punta. */
const FIGURAS: Record<NombreNavegacion, { cara: string; contorno: string }> = {
  home: { cara: CASA, contorno: CASA },
  calendario: { cara: HOJA, contorno: HOJA + 'M3.5 10h17' },
  perfil: { cara: CABEZA + HOMBROS + 'Z', contorno: CABEZA + HOMBROS },
};

export default function IconoNavegacion({ nombre }: { nombre: NombreNavegacion }) {
  const { cara, contorno } = FIGURAS[nombre];
  // Una sola barra en pantalla: el id del recorte puede ser fijo.
  const recorte = `orbit-nav-recorte-${nombre}`;
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      className={'h-6 w-6 overflow-visible' + (nombre === 'perfil' ? ' orbit-nav-asiente' : '')}>
      <defs><clipPath id={recorte}><path d={cara} /></clipPath></defs>
      <path className="orbit-nav-cara" d={cara} />
      <g clipPath={`url(#${recorte})`}>
        <g transform="skewX(-22)"><rect className="orbit-nav-brillo" x="-6" y="0" width="5" height="24" /></g>
      </g>
      <path className="orbit-nav-base" d={contorno} />
      <path className="orbit-nav-tinta" pathLength={1} d={contorno} />
      {nombre === 'home' && <path className="orbit-nav-detalle orbit-nav-puerta" d="M10.2 20.4v-4.1a1.8 1.8 0 0 1 3.6 0v4.1" />}
      {nombre === 'calendario' && <>
        <path className="orbit-nav-detalle orbit-nav-anillas" d="M8 3v4M16 3v4" />
        <path className="orbit-nav-gema" d="M15.4 13.4 17.49 14.92 16.69 17.38H14.11L13.31 14.92Z" />
      </>}
    </svg>
  );
}
