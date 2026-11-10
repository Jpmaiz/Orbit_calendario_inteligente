/**
 * Ajusta los ítems que leyó la IA ANTES de armar el borrador (código determinista).
 *
 * 1) Evento con preparación ("cirugía el miércoles; estudiar semiología de apéndice y nudos"):
 *    se agrega una tarea "Preparación: …" que vence cuando empieza el evento. El evento en sí no se prepara (0 h).
 * 2) "venceCon": una entrega que se hace al empezar otro ítem ("entregar al ingresar al examen")
 *    toma la fecha y la hora de ese ítem. Si el examen no tiene hora, la entrega queda "hora por definir".
 * 3) Preparativos, referencias y temas ya NO se copian a la descripción: van como notas (src/lib/borrador/notas.ts).
 *
 * La lista que devuelve es la que se guarda en InterpretacionIA: los índices del borrador
 * (y "venceCon") se refieren a ESTA lista.
 */
import type { ItemExtraido } from '@/lib/ia/extraccion';

export function prepararItems(leidos: ItemExtraido[]): ItemExtraido[] {
  const salida: ItemExtraido[] = [];
  const nuevoIndice: number[] = [];
  const preparaciones = new Map<number, number>(); // índice de la tarea de preparación → índice de su evento

  leidos.forEach((it, i) => {
    nuevoIndice[i] = salida.length;
    salida.push(it);
    if (it.clase === 'evento' && it.preparacion?.estimacion) {
      const temas = it.preparacion.estimacion.temas;
      preparaciones.set(salida.length, nuevoIndice[i]);
      salida.push({
        ...it,
        clase: 'tarea',
        tipo: 'tarea',
        titulo: `Preparación: ${it.titulo}`.slice(0, 200),
        fechaFinDicha: null,
        horaFin: null,
        diasSemana: [],
        ubicacion: null,
        descripcion: temas.length ? null : it.preparacion.titulo, // los temas salen como notas
        estimacion: it.preparacion.estimacion,
        preparacion: null,
        preparativos: [],
        referencias: [],
        duracion: null,
        tipoSeguro: true,
        venceCon: null,
      });
    }
  });

  // Índices de "venceCon" con la lista nueva
  const conVinculos = salida.map((it, j) => {
    const evento = preparaciones.get(j);
    if (evento !== undefined) return { ...it, venceCon: evento };
    if (it.venceCon === null) return it;
    const destino = nuevoIndice[it.venceCon];
    return { ...it, venceCon: destino === undefined || destino === j ? null : destino };
  });

  return conVinculos.map((it) => {
    let item = it;
    if (item.clase === 'tarea' && item.venceCon !== null) {
      const destino = conVinculos[item.venceCon];
      if (destino && destino.clase !== 'evento_fijo') {
        item = {
          ...item,
          fechaDicha: item.fechaDicha ?? destino.fechaDicha,
          fechaReferencia: item.fechaReferencia ?? destino.fechaReferencia,
          fechaInferida: item.fechaDicha ? item.fechaInferida : destino.fechaInferida,
          hora: destino.hora ?? item.hora,
        };
      } else {
        item = { ...item, venceCon: null };
      }
    }
    return item;
  });
}
