/**
 * Energía por momento del día (D23): lo que Orbit aprende de los bloques que el usuario mueve, sin preguntarle nada.
 * Código puro (sin base de datos): scripts/probar-energia.ts.
 *
 * - Mover un bloque a otra hora del MISMO día: +1 al momento nuevo y −1 al anterior (la hora no le servía).
 * - Moverlo a OTRO día: nada (el problema era el día, no la hora).
 * - Agregar un bloque propio: +1 a ese momento. Borrar uno sin poner otro: −0,5 (puede que solo no tuviera tiempo).
 * - Lo reciente pesa más (media vida de 120 días).
 * - Si el usuario no marcó ningún momento como alto, un momento con ~3 movimientos y 2 de ventaja pasa a alto ("aprendido").
 * - Si marcó otro, su elección manda; con ~5 movimientos a favor de un momento que no marcó, se le pregunta UNA vez
 *   (no se repite en 60 días).
 */
import { MOMENTOS, momentoDe, type Energia, type Momento } from '@/lib/usuarios/ritmo';

export type VotoMomento = { momento: Momento; voto: number; peso: number; creadoEn: Date };

export const CONFIG_ENERGIA = {
  mediaVidaDias: 120,
  /** ~3 movimientos recientes (los votos pierden un poco de peso con los días: 2,5 deja margen de un mes). */
  puntosAprender: 2.5,
  ventajaAprender: 2,
  /** ~5 movimientos recientes. */
  puntosSugerir: 4.5,
  diasEntreSugerencias: 60,
  /** Peso guardado de un voto (0,5 = 1 punto) y de un bloque borrado sin reemplazo (0,25 = medio punto). */
  pesoVoto: 0.5,
  pesoBorrado: 0.25,
  /** "Sueles estar cansado los lunes": veces en las últimas 8 semanas. */
  vecesCansancio: 3,
  semanasCansancio: 8,
};

export const NOMBRE_MOMENTO: Record<Momento, string> = { manana: 'la mañana', mediodia: 'el mediodía', tarde: 'la tarde', noche: 'la noche' };
const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const DIA_MS = 86_400_000;
const decae = (fecha: Date, ahora: Date, cfg = CONFIG_ENERGIA) =>
  Math.pow(0.5, Math.max(0, ahora.getTime() - fecha.getTime()) / DIA_MS / cfg.mediaVidaDias);

/** Puntos netos por momento (un voto de peso 0,5 = 1 punto), con lo reciente pesando más. */
export function puntosPorMomento(votos: VotoMomento[], ahora: Date = new Date(), cfg = CONFIG_ENERGIA): Record<Momento, number> {
  const p: Record<Momento, number> = { manana: 0, mediodia: 0, tarde: 0, noche: 0 };
  for (const v of votos) {
    if (!MOMENTOS.includes(v.momento)) continue;
    p[v.momento] += v.voto * v.peso * decae(v.creadoEn, ahora, cfg) * 2;
  }
  for (const m of MOMENTOS) p[m] = Math.round(p[m] * 100) / 100;
  return p;
}

export type SugerenciaEnergia = { momento: Momento; texto: string; cambio: Partial<Energia> };
export type EnergiaEfectiva = {
  /** La que usa el planificador: lo que eligió el usuario + lo aprendido (si no eligió ningún momento alto). */
  energia: Energia;
  /** Momentos que Orbit marcó como altos por su cuenta (para la etiqueta "aprendido"). */
  aprendidos: Momento[];
  /** Candidata a preguntar (quien la muestra revisa que no se haya preguntado en los últimos 60 días). */
  sugerencia: SugerenciaEnergia | null;
  puntos: Record<Momento, number>;
};

export function energiaEfectiva(elegida: Energia, votos: VotoMomento[], ahora: Date = new Date(), cfg = CONFIG_ENERGIA): EnergiaEfectiva {
  const puntos = puntosPorMomento(votos, ahora, cfg);
  const [primero, segundo] = [...MOMENTOS].sort((a, b) => puntos[b] - puntos[a]);
  const lider = puntos[primero] >= cfg.puntosAprender && puntos[primero] - puntos[segundo] >= cfg.ventajaAprender ? primero : null;
  const energia: Energia = { ...elegida };
  const aprendidos: Momento[] = [];
  let sugerencia: SugerenciaEnergia | null = null;
  const eligioAlta = MOMENTOS.some((m) => elegida[m] === 'alta');

  if (lider && elegida[lider] !== 'alta') {
    if (!eligioAlta && elegida[lider] === 'normal') {
      energia[lider] = 'alta';
      aprendidos.push(lider);
    } else if (puntos[lider] >= cfg.puntosSugerir) {
      const cambio: Partial<Energia> = { [lider]: 'alta' };
      for (const m of MOMENTOS) if (m !== lider && elegida[m] === 'alta') cambio[m] = 'normal';
      sugerencia = {
        momento: lider,
        texto: `Últimamente mueves tus bloques a ${NOMBRE_MOMENTO[lider]}. ¿Marco ese momento como el mejor para ti?`,
        cambio,
      };
    }
  }
  return { energia, aprendidos, sugerencia, puntos };
}

type Tramo = { inicio: Date; fin: Date };
const cruza = (a: Tramo, b: Tramo) => a.inicio < b.fin && b.inicio < a.fin;
const diaDe = (f: Date, zona: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(f);

/**
 * Votos que deja guardar un plan, comparando lo que Orbit propuso con lo que el usuario guardó.
 * Puestos = bloques del usuario (origen "usuario") que no coinciden con la propuesta. Sacados = propuestos que no guardó.
 */
export function votosDelPlan(
  propuestos: Tramo[], guardados: (Tramo & { origen: string })[], zona: string, cfg = CONFIG_ENERGIA,
): { momento: Momento; voto: number; peso: number }[] {
  const puestos = guardados.filter((g) => g.origen === 'usuario' && !propuestos.some((p) => cruza(g, p)));
  const sacados = propuestos.filter((p) => !guardados.some((g) => cruza(g, p)));
  const votos: { momento: Momento; voto: number; peso: number }[] = [];
  const restoP: Tramo[] = [];
  const restoS: Tramo[] = [];

  // 1) Mismo día: es un cambio de hora
  const dias = new Set([...puestos, ...sacados].map((b) => diaDe(b.inicio, zona)));
  for (const dia of dias) {
    const p = puestos.filter((b) => diaDe(b.inicio, zona) === dia).sort((a, b) => +a.inicio - +b.inicio);
    const s = sacados.filter((b) => diaDe(b.inicio, zona) === dia).sort((a, b) => +a.inicio - +b.inicio);
    const pares = Math.min(p.length, s.length);
    for (let i = 0; i < pares; i++) {
      const nuevo = momentoDe(p[i].inicio, zona), viejo = momentoDe(s[i].inicio, zona);
      if (nuevo === viejo) continue;
      votos.push({ momento: nuevo, voto: 1, peso: cfg.pesoVoto }, { momento: viejo, voto: -1, peso: cfg.pesoVoto });
    }
    restoP.push(...p.slice(pares));
    restoS.push(...s.slice(pares));
  }
  // 2) Movidos a otro día: no dicen nada de la hora
  const movidos = Math.min(restoP.length, restoS.length);
  // 3) Lo que queda: bloques agregados (+1) o borrados sin reemplazo (−0,5)
  for (const b of restoP.slice(movidos)) votos.push({ momento: momentoDe(b.inicio, zona), voto: 1, peso: cfg.pesoVoto });
  for (const b of restoS.slice(movidos)) votos.push({ momento: momentoDe(b.inicio, zona), voto: -1, peso: cfg.pesoBorrado });
  return votos;
}

/** "Los lunes sueles tener poca energía": día de la semana (1–7) con 3 o más "cansado" en las últimas 8 semanas. */
export function patronCansancio(
  animos: { fecha: Date; estado: string }[], zona: string, ahora: Date = new Date(), excluir: number[] = [], cfg = CONFIG_ENERGIA,
): { diaSemana: number; texto: string } | null {
  const desde = ahora.getTime() - cfg.semanasCansancio * 7 * DIA_MS;
  const veces = new Map<number, number>();
  for (const a of animos) {
    if (a.estado !== 'cansado' || a.fecha.getTime() < desde) continue;
    const corto = new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short' }).format(a.fecha);
    const dia = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(corto) + 1;
    if (dia > 0 && !excluir.includes(dia)) veces.set(dia, (veces.get(dia) ?? 0) + 1);
  }
  const [mejor] = [...veces.entries()].sort((a, b) => b[1] - a[1]);
  if (!mejor || mejor[1] < cfg.vecesCansancio) return null;
  const nombre = DIAS_PLURAL[mejor[0] - 1];
  return { diaSemana: mejor[0], texto: `Los ${nombre} sueles tener poca energía. ¿Te pongo menos estudio ese día?` };
}
