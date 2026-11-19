import { horarioDelDia, type AgendaDia } from './agendaDia';
import { diaEnBolivia, sumarDias, yaPaso } from './organizarTareasDia';
import { tramosDelDia } from './orbitaDia';
import { duracion, hhmm, minutoBolivia } from '../plan/grillaPlan';
import { formatearHoras } from '../estimacion/estimacionFrontend';

/** "Hoy" en /dia: una línea de tiempo con clases, eventos, estudio y tareas con hora, con los huecos libres entre ellos. */
export type TipoItem = 'clase' | 'evento' | 'estudio' | 'tarea';
export type EstadoItem = 'pasado' | 'actual' | 'futuro';
export type ItemLinea = {
  clave: string; tipo: TipoItem; ini: number; fin: number | null; titulo: string; color: string;
  etiqueta: string; datos: { k: string; v: string }[]; estado: EstadoItem;
  /** Estudio: la tarea del plan. Tarea: la propia tarea (para planificar). */
  tarea: { id: string; titulo: string; horaDefinida: boolean } | null;
};
export type FilaLinea =
  | { tipo: 'item'; item: ItemLinea }
  | { tipo: 'hueco'; clave: string; minutos: number; ahora: boolean };
export type Linea = {
  filas: FilaLinea[]; pasadas: ItemLinea[]; restantes: number; vacio: boolean;
  manana: { hora: string; titulo: string } | null;
};

const COLOR: Record<TipoItem, string> = { clase: '#80ACC3', evento: '#C5A355', estudio: '#9C8BC9', tarea: '#C5A355' };
const ETIQUETA: Record<TipoItem, string> = { clase: 'Clase', evento: 'Evento', estudio: 'Estudio', tarea: 'Entrega' };
const NOMBRE_NOTA: Record<string, string> = { llevar: 'Llevar', temas: 'Temas', bibliografia: 'Leer', duracion: 'Duración', otros: 'Nota' };

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function construirLinea(agenda: AgendaDia, ahora: Date, verPasadas: boolean): Linea {
  const hoy = diaEnBolivia(ahora);
  const m = minutoBolivia(ahora);
  const horario = horarioDelDia(agenda, new Date(hoy + 'T12:00:00-04:00'));
  const cero = new Date(hoy + 'T00:00:00-04:00').getTime();
  const enDia = (fecha: Date) => Math.max(0, Math.min(1440, Math.round((fecha.getTime() - cero) / 60000)));
  const estadoDe = (ini: number, fin: number): EstadoItem => (fin <= m ? 'pasado' : ini <= m ? 'actual' : 'futuro');
  const cuando = (ini: number, fin: number | null): { k: string; v: string }[] =>
    fin !== null && ini <= m && m < fin ? [{ k: 'Termina', v: hhmm(fin) }]
      : ini > m ? [{ k: 'Empieza', v: 'en ' + duracion(ini - m) }] : [];

  const items: ItemLinea[] = [
    ...horario.clases.map((c): ItemLinea => {
      const ini = aMinutos(c.horaInicio), fin = aMinutos(c.horaFin);
      return {
        clave: 'c' + c.id, tipo: 'clase', ini, fin, titulo: c.titulo, color: c.materia?.color ?? COLOR.clase,
        etiqueta: 'Clase' + (c.ubicacion ? ' · ' + c.ubicacion : ''), estado: estadoDe(ini, fin), tarea: null,
        datos: [...cuando(ini, fin), { k: 'Dura', v: duracion(fin - ini) }], // el aula ya va en la etiqueta
      };
    }),
    ...horario.eventos.map((e): ItemLinea => {
      const ini = enDia(e.inicio), fin = e.fin ? enDia(e.fin) : null;
      return {
        clave: 'e' + e.id, tipo: 'evento', ini, fin, titulo: e.titulo, color: e.materia?.color ?? COLOR.evento,
        etiqueta: 'Evento' + (e.ubicacion ? ' · ' + e.ubicacion : ''), estado: estadoDe(ini, fin ?? ini + 60), tarea: null,
        datos: [...cuando(ini, fin ?? ini + 60),
          ...(fin !== null ? [{ k: 'Dura', v: duracion(fin - ini) }] : []), ...(e.descripcion ? [{ k: 'Nota', v: e.descripcion }] : [])],
      };
    }),
    ...horario.bloques.map((b): ItemLinea => {
      const ini = enDia(b.inicio), fin = enDia(b.fin);
      return {
        clave: 'b' + b.id, tipo: 'estudio', ini, fin, titulo: b.tarea.titulo, color: COLOR.estudio,
        etiqueta: b.tipo === 'repaso' ? 'Repaso' : 'Estudio', estado: estadoDe(ini, fin),
        tarea: { id: b.tarea.id, titulo: b.tarea.titulo, horaDefinida: true },
        datos: [...cuando(ini, fin), { k: 'Dura', v: duracion(fin - ini) }, ...(b.tarea.materia ? [{ k: 'Materia', v: b.tarea.materia.nombre }] : [])],
      };
    }),
    ...agenda.tareas
      .filter((t) => t.horaDefinida && diaEnBolivia(t.fechaLimite) === hoy)
      .map((t): ItemLinea => {
        const ini = minutoBolivia(t.fechaLimite);
        const horas = t.estimado ? formatearHoras(t.estimado.horas) : null;
        return {
          clave: 't' + t.id, tipo: 'tarea', ini, fin: null, titulo: t.titulo, color: t.materia?.color ?? COLOR.tarea,
          etiqueta: ETIQUETA.tarea + (t.materia ? ' · ' + t.materia.nombre : ''), estado: yaPaso(t, ahora) ? 'pasado' : 'futuro',
          tarea: { id: t.id, titulo: t.titulo, horaDefinida: true },
          datos: [{ k: 'Vence', v: 'hoy ' + hhmm(ini) + (ini > m ? ' · en ' + duracion(ini - m) : '') },
            ...(horas ? [{ k: 'Horas', v: horas }] : []),
            ...t.notas.slice(0, 2).map((n) => ({ k: NOMBRE_NOTA[n.categoria] ?? 'Nota', v: n.texto }))],
        };
      }),
  ].sort((a, b) => a.ini - b.ini || (a.fin ?? a.ini) - (b.fin ?? b.ini));

  const pasadas = items.filter((i) => i.estado === 'pasado');
  const visibles = verPasadas ? items : items.filter((i) => i.estado !== 'pasado');
  const filas: FilaLinea[] = [];
  let previoFin: number | null = null;
  for (const item of visibles) {
    // Hueco libre de 30 min o más antes de algo que todavía no empieza; si estás en él, "Libre ahora".
    const desde = previoFin ?? m;
    if (item.tipo !== 'tarea' && item.ini > m && item.ini - Math.max(desde, m) >= 30) {
      const ahoraDentro = desde <= m;
      filas.push({ tipo: 'hueco', clave: 'h' + item.clave, minutos: item.ini - Math.max(desde, m), ahora: ahoraDentro });
    }
    filas.push({ tipo: 'item', item });
    previoFin = Math.max(previoFin ?? 0, item.fin ?? item.ini);
  }
  const primeroManana = tramosDelDia(agenda, sumarDias(hoy, 1)).tramos[0] ?? null;
  return {
    filas, pasadas, vacio: items.length === 0,
    restantes: items.filter((i) => i.estado !== 'pasado').length,
    manana: primeroManana ? { hora: hhmm(primeroManana.ini), titulo: primeroManana.titulo } : null,
  };
}
