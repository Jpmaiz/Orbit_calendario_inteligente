import { inicioDiaBolivia, sumarDias, type BloqueSemana } from './agendaSemana';

/**
 * Grilla del día que se ajusta: cada grupo de actividades va a escala (56 px por hora, desde 30 min antes)
 * y los huecos de 2 h o más se pliegan en una franja "Libre". Así el día entero cabe en una pantalla.
 */
export const PXM = 56 / 60;
const PLIEGUE = 120;

export type ItemDia = {
  clave: string; tipo: 'clase' | 'evento' | 'estudio' | 'examen'; ini: number; fin: number | null;
  titulo: string; detalle: string | null; color: string; tareaId: string | null;
};
export type ItemUbicado = ItemDia & { finVisual: number; carril: number; carriles: number };
export type Segmento =
  | { tipo: 'escala'; a: number; b: number; horas: number[]; items: ItemUbicado[] }
  | { tipo: 'libre'; desde: number; hasta: number };

const COLOR = { clase: '#80ACC3', evento: '#C5A355', estudio: '#9C8BC9' } as const;

function aMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Clases, eventos y estudio del día en minutos; las tareas van aparte (arriba, como entregas). */
export function itemsDelDia(bloques: BloqueSemana[], fecha: string): ItemDia[] {
  const cero = inicioDiaBolivia(fecha).getTime(), fin = inicioDiaBolivia(sumarDias(fecha, 1)).getTime();
  const enDia = (d: Date) => Math.round((Math.max(cero, Math.min(fin, d.getTime())) - cero) / 60000);
  return bloques.flatMap((b): ItemDia[] => {
    if (b.tipo === 'clase') return [{
      clave: b.id, tipo: 'clase', ini: aMinutos(b.datos.horaInicio), fin: aMinutos(b.datos.horaFin), titulo: b.datos.titulo,
      detalle: b.datos.ubicacion, color: b.datos.materia?.color ?? COLOR.clase, tareaId: null,
    }];
    if (b.tipo === 'evento') return [{
      clave: b.id, tipo: 'evento', ini: enDia(b.datos.inicio), fin: b.datos.fin ? enDia(b.datos.fin) : null, titulo: b.datos.titulo,
      detalle: b.datos.ubicacion, color: b.datos.materia?.color ?? COLOR.evento, tareaId: null,
    }];
    if (b.tipo === 'estudio') return [{
      clave: b.id, tipo: 'estudio', ini: enDia(b.datos.inicio), fin: enDia(b.datos.fin), titulo: b.datos.titulo,
      detalle: b.datos.tipo === 'repaso' ? 'Repaso' : b.datos.materia?.nombre ?? null, color: COLOR.estudio, tareaId: b.datos.tarea.id,
    }];
    return [];
  });
}

/** Solo lo que se cruza va lado a lado: cada cruce reparte su ancho; lo demás ocupa todo el ancho. */
function ubicarCarriles(items: (ItemDia & { finVisual: number })[]): ItemUbicado[] {
  const salida: ItemUbicado[] = [];
  let cruce: (ItemDia & { finVisual: number; carril: number })[] = [], finCruce = -1, finales: number[] = [];
  const cerrar = () => { const n = Math.max(1, finales.length); salida.push(...cruce.map((it) => ({ ...it, carriles: n }))); };
  for (const it of items) {
    if (it.ini >= finCruce && cruce.length) { cerrar(); cruce = []; finales = []; }
    let carril = finales.findIndex((final) => final <= it.ini);
    if (carril === -1) carril = finales.length;
    finales[carril] = it.finVisual;
    cruce.push({ ...it, carril });
    finCruce = Math.max(finCruce, it.finVisual);
  }
  if (cruce.length) cerrar();
  return salida;
}

export function segmentarDia(items: ItemDia[]): Segmento[] {
  // Un evento sin fin ocupa 45 min en la grilla (solo geometría; su texto dice solo la hora de inicio).
  const orden = items.map((it) => ({ ...it, finVisual: Math.max(it.ini + 30, it.fin ?? it.ini + 45) }))
    .sort((x, y) => x.ini - y.ini || y.finVisual - x.finVisual);
  const grupos: { ini: number; fin: number; items: typeof orden }[] = [];
  for (const it of orden) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && it.ini - ultimo.fin < PLIEGUE) {
      ultimo.items.push(it);
      ultimo.fin = Math.max(ultimo.fin, it.finVisual);
    } else grupos.push({ ini: it.ini, fin: it.finVisual, items: [it] });
  }
  const segmentos: Segmento[] = [];
  grupos.forEach((grupo, indice) => {
    if (indice > 0) segmentos.push({ tipo: 'libre', desde: grupos[indice - 1].fin, hasta: grupo.ini });
    const a = Math.max(0, Math.floor((grupo.ini - 30) / 30) * 30);
    const b = Math.min(1440, Math.ceil((grupo.fin + 30) / 30) * 30);
    const horas: number[] = [];
    for (let h = Math.ceil(a / 60) * 60; h <= b; h += 60) horas.push(h);
    segmentos.push({ tipo: 'escala', a, b, horas, items: ubicarCarriles(grupo.items) });
  });
  return segmentos;
}

/** Minutos libres entre las 08:00 y las 22:00 (lo ocupado se une para no contar dos veces lo simultáneo). */
export function minutosLibres(items: ItemDia[], desde = 8 * 60, hasta = 22 * 60): number {
  const tramos = items.map((it) => [Math.max(desde, it.ini), Math.min(hasta, it.fin ?? it.ini)] as const)
    .filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let ocupado = 0, cursor = desde;
  for (const [a, b] of tramos) {
    if (b <= cursor) continue;
    ocupado += b - Math.max(a, cursor);
    cursor = b;
  }
  return Math.max(0, hasta - desde - ocupado);
}
