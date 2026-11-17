/**
 * Dodecaedro regular (logo de Orbit): 20 vértices, 30 aristas y 12 caras pentagonales.
 * Se gira sobre un eje inclinado y se proyecta en un lienzo de 100 × 100; cada cara visible lleva su luz.
 */
type V3 = [number, number, number];

const F = (1 + Math.sqrt(5)) / 2;
const norm = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
const signos2: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

const VERTICES: V3[] = [
  ...[1, -1].flatMap((a) => [1, -1].flatMap((b) => [1, -1].map((c): V3 => [a, b, c]))),
  ...signos2.flatMap(([a, b]): V3[] => [[0, a / F, b * F], [a / F, b * F, 0], [b * F, 0, a / F]]),
].map(norm);

/** Cada cara: los 5 vértices más cercanos a su normal (el icosaedro dual), en orden alrededor de ella. */
const CARAS = signos2.flatMap(([a, b]): V3[] => [[0, a * F, b], [a, 0, b * F], [a * F, b, 0]]).map(norm).map((n) => {
  const punto = (v: V3) => v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
  const ids = VERTICES.map((v, i) => ({ i, p: punto(v) })).sort((x, y) => y.p - x.p).slice(0, 5).map((x) => x.i);
  const u = norm(Math.abs(n[0]) < 0.9 ? [0, -n[2], n[1]] : [-n[2], 0, n[0]]);
  const w: V3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const angulo = (i: number) => Math.atan2(VERTICES[i][0] * w[0] + VERTICES[i][1] * w[1] + VERTICES[i][2] * w[2],
    VERTICES[i][0] * u[0] + VERTICES[i][1] * u[1] + VERTICES[i][2] * u[2]);
  return { ids: ids.sort((x, y) => angulo(x) - angulo(y)), n };
});

/** Giro sobre Y y luego inclinación fija hacia el que mira (X 0,42 rad): se ven la cara de arriba y las de costado. */
const INCLINACION = 0.42;
function girar(v: V3, a: number): V3 {
  const x1 = v[0] * Math.cos(a) + v[2] * Math.sin(a), z1 = -v[0] * Math.sin(a) + v[2] * Math.cos(a);
  return [x1, v[1] * Math.cos(INCLINACION) - z1 * Math.sin(INCLINACION), v[1] * Math.sin(INCLINACION) + z1 * Math.cos(INCLINACION)];
}

// Luz arriba a la izquierda. Paleta de sombra a luz: verde profundo → verde Orbit → salvia → menta.
const LUZ = norm([-0.5, 0.65, 0.58]);
const PALETA = [[18, 52, 45], [40, 104, 86], [94, 160, 133], [196, 232, 212]];
function tono(k: number): number[] {
  const t = Math.max(0, Math.min(1, k)) * (PALETA.length - 1);
  const i = Math.min(PALETA.length - 2, Math.floor(t)), f = t - i;
  return PALETA[i].map((c, j) => Math.round(c + (PALETA[i + 1][j] - c) * f));
}

/** color: la cara; borde: la misma cara un 32 % más clara (bisel, sin halo sobre fondos claros u oscuros). */
export type Faceta = { puntos: string; color: string; borde: string };

/** Solo las caras que miran al frente: en un sólido convexo nunca se tapan entre sí. */
export function facetasDodecaedro(angulo: number, radio = 46): Faceta[] {
  const P = VERTICES.map((v) => girar(v, angulo));
  return CARAS.flatMap(({ ids, n }) => {
    const m = girar(n, angulo);
    if (m[2] <= 0.0001) return [];
    const luz = Math.max(0, m[0] * LUZ[0] + m[1] * LUZ[1] + m[2] * LUZ[2]);
    const rgb = tono(0.08 + 0.92 * luz);
    return [{
      puntos: ids.map((i) => (50 + P[i][0] * radio).toFixed(2) + ',' + (50 - P[i][1] * radio).toFixed(2)).join(' '),
      color: `rgb(${rgb.join(',')})`,
      borde: `rgb(${rgb.map((c) => Math.round(c + (255 - c) * 0.32)).join(',')})`,
    }];
  });
}

/** Ángulo de reposo del logo (ícono, favicon y primera imagen antes de girar). */
export const ANGULO_LOGO = 1.65;

/** Las 30 aristas, sin repetir, sacadas de los bordes de las caras. */
const ARISTAS: [number, number][] = (() => {
  const vistas = new Set<string>();
  const salida: [number, number][] = [];
  for (const { ids } of CARAS) for (let i = 0; i < 5; i++) {
    const a = Math.min(ids[i], ids[(i + 1) % 5]), b = Math.max(ids[i], ids[(i + 1) % 5]);
    if (!vistas.has(a + '-' + b)) { vistas.add(a + '-' + b); salida.push([a, b]); }
  }
  return salida;
})();

/** peso 1 = contorno (firme); de 1 a 0, aristas interiores que se apagan al ponerse de canto; 0 = atrás (tenue). */
export type Arista = { x1: number; y1: number; x2: number; y2: number; peso: number };

/** Paso suave entre 0,02 y 0,26: una cara casi de canto no engrosa sus aristas de golpe (evita líneas dobles al girar). */
const suave = (x: number) => { const t = Math.max(0, Math.min(1, (x - 0.02) / 0.24)); return t * t * (3 - 2 * t); };

/**
 * Versión de alambre: las 30 aristas con su peso, de la más tenue a la más firme (así las firmes quedan encima).
 * Cada arista separa dos caras: si una mira al frente y la otra atrás, es contorno; si ambas al frente,
 * pesa según la menos frontal; si ambas atrás, queda al fondo.
 */
export function aristasDodecaedro(angulo: number, radio = 46): Arista[] {
  const P = VERTICES.map((v) => girar(v, angulo));
  const zs = new Map<string, number[]>();
  for (const { ids, n } of CARAS) {
    const z = girar(n, angulo)[2];
    for (let i = 0; i < 5; i++) {
      const k = Math.min(ids[i], ids[(i + 1) % 5]) + '-' + Math.max(ids[i], ids[(i + 1) % 5]);
      zs.set(k, [...(zs.get(k) ?? []), z]);
    }
  }
  const punto = (i: number) => [+(50 + P[i][0] * radio).toFixed(2), +(50 - P[i][1] * radio).toFixed(2)];
  return ARISTAS.map(([a, b]) => {
    const [z1, z2] = zs.get(a + '-' + b) ?? [0, 0];
    const peso = (z1 > 0) !== (z2 > 0) ? 1 : z1 > 0 ? suave(Math.min(z1, z2)) : 0;
    const [x1, y1] = punto(a), [x2, y2] = punto(b);
    return { x1, y1, x2, y2, peso };
  }).sort((p, q) => p.peso - q.peso);
}
