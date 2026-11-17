import type { ReactNode } from 'react';
import estilos from './auth.module.css';
import Dodecaedro from '@/components/marca/Dodecaedro';

const slogan = <>Tus actividades, <span>en <em>órbita.</em></span></>;
const textoApoyo = 'Organiza tareas, clases, estudio y más en un solo lugar.';

export function MarcaOrbit() {
  return <div className={estilos.marca}>
    <span className={estilos.logo} aria-hidden="true">
      <Dodecaedro girando className="h-[29px] w-[29px]" />
    </span>
    <span>ORBIT</span>
  </div>;
}

function PanelVisualAuth() {
  return <aside className={estilos.visual} aria-label="Tu espacio académico en ORBIT">
    <header className={estilos.cabeceraVisual}><MarcaOrbit /><span className={estilos.edicion}>TU ESPACIO ACADÉMICO</span></header>
    <div className={estilos.mensajeVisual}>
      <p className={estilos.eyebrow}><span /> UN POCO DE ORDEN. MÁS POSIBILIDADES.</p>
      <h2>{slogan}</h2>
      <p>{textoApoyo}</p>
    </div>
    <div className={estilos.escena} aria-hidden="true">
      <div className={estilos.resplandor} />
      <div className={estilos.orbita}><span /></div>
      <div className={estilos.orbitaInterior} />
      <div className={estilos.calendario}>
        <div className={estilos.cabeceraCalendario}><span>Tu semana</span><span>···</span></div>
        <div className={estilos.dias}>{['L', 'M', 'M', 'J', 'V'].map((dia, i) => <span key={i}>{dia}</span>)}</div>
        <div className={estilos.fechas}>{[12, 13, 14, 15, 16].map((dia) => <span key={dia} className={dia === 14 ? estilos.diaActivo : undefined}>{dia}</span>)}</div>
        <div className={estilos.eventoCalendario}><span /><div><strong>Tiempo para aprender</strong><small>Un espacio para tu estudio</small></div></div>
        <div className={estilos.lineaCalendario} /><div className={estilos.lineaCorta} />
      </div>
      <div className={estilos.tarjetaClase}><span className={estilos.iconoTarjeta}>↗</span><div><small>PRÓXIMA CLASE</small><strong>Matemáticas</strong><span>08:00 · Aula 204</span></div><span className={estilos.puntoTarjeta} /></div>
      <div className={estilos.tarjetaEstudio}><span className={estilos.iconoEstudio}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg></span><div><small>A TU RITMO</small><strong>Una hora de enfoque</strong><span>Un paso más cerca.</span></div><span className={estilos.barras}><i /><i /><i /><i /><i /></span></div>
    </div>
    <footer className={estilos.pieVisual}><span className={estilos.lineaPie} /><p>Menos pendientes en tu cabeza.<br /><strong>Más espacio para lo que viene.</strong></p><span aria-hidden="true">✳</span></footer>
  </aside>;
}

export default function PresentacionAuth({ tipo, children }: { tipo: 'login' | 'registro'; children: ReactNode }) {
  const registro = tipo === 'registro';
  return <main lang="es" className={estilos.pagina}>
    <div className={estilos.composicion}>
      <PanelVisualAuth />
      <section className={estilos.panelFormulario} aria-labelledby="titulo-auth">
        <div className={estilos.identidadMobile}><MarcaOrbit /><p className={estilos.sloganMobile}>{slogan}</p><p>{textoApoyo}</p></div>
        <div className={estilos.contenido} key={tipo}>
          <div className={estilos.introduccion}>
            <p className={estilos.paso}>{registro ? 'UN NUEVO COMIENZO' : 'TU SEMESTRE TE ESPERA'}</p>
            <h1 id="titulo-auth">{registro ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
            <p>{registro ? 'Empieza a organizar tu semestre con ORBIT.' : 'Continúa organizando tus clases, tareas y estudio.'}</p>
          </div>
          {children}
          <p className={estilos.firma}>Tu tiempo, a tu ritmo.<span aria-hidden="true">✳</span></p>
        </div>
      </section>
    </div>
  </main>;
}
