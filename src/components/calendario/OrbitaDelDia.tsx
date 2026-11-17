'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { AgendaDia } from './agendaDia';
import { useAhora } from './useAhora';
import { ARCO, arcoEntre, calcularOrbita, puntoDel, RUTA_ARCO, INICIO_DIA, FIN_DIA, type TemaOrbita } from './orbitaDia';

type Paleta = {
  fondo: string; texto: string; sombra: string; pista: string; estela: string; acento: string; suave: string; tenue: string;
  caja: string; planeta: string; anillo: string; halo: string; brillo: string; hito: string; pasado: number;
};
const TEMAS: Record<TemaOrbita, Paleta> = {
  oscuro: { fondo: '#1F463D', texto: '#FFFFFF', sombra: 'rgba(31,70,61,.30)', pista: 'rgba(255,255,255,.28)', estela: 'rgba(255,255,255,.62)',
    acento: '#9BD1B6', suave: 'rgba(255,255,255,.74)', tenue: 'rgba(255,255,255,.5)', caja: 'rgba(255,255,255,.08)',
    planeta: '#FFFFFF', anillo: '#9BD1B6', halo: 'rgba(155,209,182,.55)', brillo: 'rgba(155,209,182,.8)', hito: '#F1D9A0', pasado: 0.32 },
  estudio: { fondo: '#38315C', texto: '#FFFFFF', sombra: 'rgba(56,49,92,.32)', pista: 'rgba(255,255,255,.28)', estela: 'rgba(255,255,255,.62)',
    acento: '#CDBEF0', suave: 'rgba(255,255,255,.74)', tenue: 'rgba(255,255,255,.5)', caja: 'rgba(255,255,255,.08)',
    planeta: '#FFFFFF', anillo: '#CDBEF0', halo: 'rgba(205,190,240,.55)', brillo: 'rgba(205,190,240,.8)', hito: '#F1D9A0', pasado: 0.32 },
  claro: { fondo: '#ECEFE7', texto: '#263D34', sombra: 'rgba(38,61,52,.07)', pista: '#B9C2B4', estela: '#7F8B82',
    acento: '#647168', suave: '#647168', tenue: '#75817A', caja: '#FFFFFF',
    planeta: '#263D34', anillo: '#FFFFFF', halo: 'rgba(38,61,52,.25)', brillo: 'rgba(38,61,52,.25)', hito: '#C5A355', pasado: 0.4 },
  noche: { fondo: '#1B2A31', texto: '#FFFFFF', sombra: 'rgba(27,42,49,.32)', pista: 'rgba(255,255,255,.22)', estela: 'rgba(241,227,189,.55)',
    acento: '#F1D9A0', suave: 'rgba(255,255,255,.72)', tenue: 'rgba(255,255,255,.48)', caja: 'rgba(255,255,255,.07)',
    planeta: '#F1D9A0', anillo: '#1B2A31', halo: 'rgba(241,217,160,.45)', brillo: 'rgba(241,217,160,.9)', hito: '#F1D9A0', pasado: 0.32 },
};
const ESTRELLAS: [number, number, number, number][] = [[9, 20, 2, .7], [18, 10, 1.5, .5], [34, 17, 2, .6], [61, 12, 1.5, .5], [75, 23, 2, .7], [86, 9, 1.5, .45], [25, 40, 1.5, .35], [69, 45, 1.5, .35]];
const conRetraso = (ms: number) => ({ '--t': ms + 'ms' }) as CSSProperties;
const suavizar = (k: number) => 1 - Math.pow(1 - k, 3);

/** Cabecera de "Tu día": qué pasa ahora sobre el arco del día (07:00–23:00). Se actualiza cada 30 s. */
export default function OrbitaDelDia({ agenda }: { agenda: AgendaDia }) {
  const ahora = useAhora();
  // 0…1 mientras el planeta viaja desde las 07:00 hasta ahora; null cuando ya llegó.
  const [viaje, establecerViaje] = useState<number | null>(0);

  useEffect(() => {
    let cuadro = 0;
    let inicio: number | null = null;
    const paso = (t: number) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { establecerViaje(null); return; }
      inicio ??= t + 380;
      const k = Math.min(1, Math.max(0, (t - inicio) / 400));
      establecerViaje(k >= 1 ? null : k);
      if (k < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, []);

  const o = calcularOrbita(agenda, ahora);
  const t = TEMAS[o.tema];
  const fraccion = viaje === null ? o.fraccion : o.fraccion * suavizar(viaje);
  const [px, py] = puntoDel(INICIO_DIA + fraccion * (FIN_DIA - INICIO_DIA));

  return (
    <section aria-label={`${o.etiqueta}: ${o.grande}, ${o.bajo}`}
      className="orbit-dia-sube relative overflow-hidden rounded-[30px] px-4 pb-4 pt-5 transition-colors duration-500 sm:px-6"
      style={{ ...conRetraso(60), background: t.fondo, color: t.texto, boxShadow: `0 20px 44px ${t.sombra}` }}>
      {o.tema === 'noche' && ESTRELLAS.map(([x, y, s, op], i) => <span key={i} aria-hidden="true" className="orbit-dia-aparece absolute rounded-full bg-[#F1E3BD]"
        style={{ ...conRetraso(120), left: x + '%', top: y + '%', width: s, height: s, opacity: op }} />)}

      <div className="relative mx-auto w-full max-w-[420px]" style={{ aspectRatio: `${ARCO.ancho} / ${ARCO.alto}` }}>
        <svg aria-hidden="true" viewBox={`0 0 ${ARCO.ancho} ${ARCO.alto}`} fill="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path className="orbit-dia-aparece" style={conRetraso(120)} d={RUTA_ARCO} stroke={t.pista} strokeWidth={1.5} strokeDasharray="2 7" strokeLinecap="round" />
          <path d={RUTA_ARCO} pathLength={1} stroke={t.estela} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={`${fraccion} 2`} />
          {o.tramos.map((tramo, i) => <path key={tramo.clave} className="orbit-dia-tramo" pathLength={1} d={arcoEntre(tramo.ini, tramo.fin)}
            stroke={tramo.actual ? t.acento : tramo.color} strokeWidth={tramo.actual ? 11 : 8} strokeLinecap="round"
            style={{ ...conRetraso(180 + i * 70), opacity: tramo.actual ? 1 : tramo.pasado ? t.pasado : 0.9 }} />)}
          {o.hitos.map((h) => { const [x, y] = puntoDel(h.minuto); return <circle key={h.clave} className="orbit-dia-aparece" style={conRetraso(500)}
            cx={x} cy={y} r={4.5} fill={t.fondo} stroke={t.hito} strokeWidth={2.5} />; })}
          <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`} style={{ filter: `drop-shadow(0 0 6px ${t.brillo})` }}>
            {viaje === null && <circle className="orbit-dia-halo" r={8} fill={t.halo} />}
            <circle r={6.5} fill={t.planeta} stroke={t.anillo} strokeWidth={3} />
          </g>
        </svg>
        <div className="orbit-dia-sube absolute inset-x-0 bottom-1 mx-auto flex w-[68%] flex-col items-center gap-1.5 text-center" style={conRetraso(260)}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: t.acento }}>{o.etiqueta}</p>
          <p className={o.grandeEsNumero ? 'text-[42px] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-5xl'
            : 'line-clamp-2 text-[22px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-2xl'}>{o.grande}</p>
          <p className="text-[15px] leading-snug" style={{ color: t.suave }}>{o.bajo}</p>
        </div>
      </div>

      <div className="orbit-dia-aparece mx-auto flex max-w-[420px] justify-between px-1.5 text-xs tabular-nums" style={{ ...conRetraso(560), color: t.tenue }}>
        <span>07:00</span><span>23:00</span>
      </div>

      {o.despues && <div className="orbit-dia-aparece mx-auto mt-2 flex max-w-[420px] items-center gap-3 rounded-[18px] px-4 py-3" style={{ ...conRetraso(560), background: t.caja }}>
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.despues.color }} />
        <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: t.tenue }}>Después</span>
        <span className="min-w-0 flex-1 truncate text-[15px]"><span className="font-bold tabular-nums">{o.despues.hora}</span>  {o.despues.titulo}</span>
      </div>}
    </section>
  );
}
