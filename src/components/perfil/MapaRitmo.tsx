import { aMinutos, type Ritmo } from './contratoPerfil';

/** Algo que ocupa tiempo fijo cada semana: una clase o un compromiso (trabajo, deporte…). */
export type Ocupado = { dia: number; ini: number; fin: number; titulo: string; color: string };

const X0 = 6 * 60, X1 = 24 * 60;
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const RAYADO = 'repeating-linear-gradient(135deg, #E9ECE6 0 3px, #F6F7F3 3px 8px)';

const izquierda = (m: number) => `${(Math.max(0, Math.min(1, (m - X0) / (X1 - X0))) * 100).toFixed(2)}%`;
const ancho = (a: number, b: number) => `${(Math.max(0, Math.min(X1, b) - Math.max(X0, a)) / (X1 - X0) * 100).toFixed(2)}%`;

/** Tu semana de 06 a 24 h: en verde cuándo estudias (más claro y con ½ los días con menos estudio), rayado lo que no, y encima tus clases y compromisos. */
export default function MapaRitmo({ ritmo, ocupados }: { ritmo: Ritmo; ocupados: Ocupado[] }) {
  const desde = aMinutos(ritmo.desde), hasta = aMinutos(ritmo.hasta);
  const libres = ritmo.diasLibres.map((d) => NOMBRES[d - 1]);
  const etiqueta = `Tu semana: estudio de ${ritmo.desde} a ${ritmo.hasta}` + (libres.length ? `, sin estudio el ${libres.join(' y el ')}` : '') +
    (ritmo.menosEstudio.length ? `, con menos estudio el ${ritmo.menosEstudio.map((d) => NOMBRES[d - 1]).join(' y el ')}` : '') +
    (ocupados.length ? `, con ${ocupados.length} ${ocupados.length === 1 ? 'bloque fijo' : 'bloques fijos'} de clases y compromisos` : '') + '.';

  return <div role="img" aria-label={etiqueta} className="flex flex-col gap-1">
    {LETRAS.map((letra, i) => {
      const libre = ritmo.diasLibres.includes(i + 1);
      const menos = !libre && ritmo.menosEstudio.includes(i + 1);
      return <div key={letra} aria-hidden="true" className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2">
        <span className={'text-center text-[11px] font-semibold ' + (libre ? 'text-[#A1AAA3]' : 'text-[#4C5A51]')}>{letra}</span>
        <div className="relative h-3.5 overflow-hidden rounded-[5px] transition-colors duration-300" style={{ background: libre ? RAYADO : '#F1F4EE' }}>
          {!libre && <span className={'absolute inset-y-0 transition-all duration-300 ' + (menos ? 'bg-[#DCEBE2]' : 'bg-[#BFDCCB]')} style={{ left: izquierda(desde), width: ancho(desde, hasta) }} />}
          {menos && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#4C6A5D]">½</span>}
          {ocupados.filter((o) => o.dia === i + 1).map((o) => <span key={o.titulo + o.ini} title={o.titulo}
            className="absolute inset-y-0.5 rounded-[4px]" style={{ left: izquierda(o.ini), width: ancho(o.ini, o.fin), background: o.color }} />)}
        </div>
      </div>;
    })}
    <div aria-hidden="true" className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
      <span />
      <div className="flex justify-between text-[10.5px] tabular-nums text-[#8A958D]"><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </div>
  </div>;
}
