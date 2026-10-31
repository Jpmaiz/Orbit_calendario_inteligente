/**
 * Resumen del borrador de un horario, agrupado por MATERIA (como piensa el estudiante).
 * En la base cada bloque es una clase fija (lunes 09:00–10:30); en pantalla se muestra
 * "Redes II: Lun, Mié 09:00–10:30 · Vie 09:00–09:45" con un color por materia.
 */
import { normalizarCodigo, normalizarNombre } from '@/lib/borrador/enriquecer';

/** Colores legibles sobre fondo claro; se asignan en orden de aparición. */
export const PALETA_MATERIAS = ['#2F6F5E', '#3B5BA5', '#B4583B', '#7A4EA3', '#A3833B', '#2E8A99', '#A33B6B', '#5E7A2F'];

type ItemClase = {
  clase: string; titulo: string; codigoMateria: string | null; diasSemana: number[];
  hora: string | null; horaFin: string | null; ubicacion: string | null; confianza: number;
};

export type MateriaDelHorario = {
  clave: string;
  nombre: string;
  codigo: string | null;
  color: string;
  indices: number[];      // posiciones en "items" del borrador (para editar o abrir esa clase)
  sesiones: { diasSemana: number[]; hora: string; horaFin: string; aula: string | null; indice: number }[];
  revisar: boolean;       // alguna sesión salió de una lectura dudosa
};

export function agruparPorMateria(items: ItemClase[]): MateriaDelHorario[] {
  const grupos = new Map<string, MateriaDelHorario>();
  items.forEach((it, indice) => {
    if (it.clase !== 'evento_fijo' || !it.hora || !it.horaFin) return;
    const clave = it.codigoMateria ? `c:${normalizarCodigo(it.codigoMateria)}` : `n:${normalizarNombre(it.titulo)}`;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        clave, nombre: it.titulo, codigo: it.codigoMateria,
        color: PALETA_MATERIAS[grupos.size % PALETA_MATERIAS.length],
        indices: [], sesiones: [], revisar: false,
      };
      grupos.set(clave, g);
    }
    g.indices.push(indice);
    g.sesiones.push({ diasSemana: it.diasSemana, hora: it.hora, horaFin: it.horaFin, aula: it.ubicacion, indice });
    g.revisar ||= it.confianza < 0.9;
  });
  return [...grupos.values()];
}
