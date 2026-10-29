/**
 * Arma el BORRADOR a partir de los ítems que leyó la IA (de un texto o de una imagen).
 * Es el mismo para todas las entradas: texto, foto, captura, PDF y dictado.
 *
 * Todo lo de aquí es código determinista: fechas, materia propuesta, hora propuesta,
 * vigencia de clases, duplicados y choques.
 */
import { prisma } from '@/lib/prisma/cliente';
import { resolverFecha, HORA_POR_TIPO } from '@/lib/fechas/resolverFecha';
import type { ItemExtraido } from '@/lib/ia/extraccion';
import { periodoVigente, diaEnZona } from '@/lib/periodos/periodos';
import { buscarDuplicada } from '@/lib/tareas/duplicados';
import { DIFERENCIAS_POR_TIPO, preguntaDuplicado } from '@/lib/tareas/comparar';
import {
  proponerMateria, proponerHoraDesdeHorario, choquesDeEvento, revisarClase, nombreDia, normalizarNombre,
  type ClaseFija, type EventoPuntual,
} from '@/lib/borrador/enriquecer';

const DIA_MS = 86_400_000;

/** Datos del usuario que necesita el borrador. Se cargan una vez por pedido. */
export async function cargarContexto(usuarioId: string, ahora: Date) {
  const [usuario, materias, alias, clases, eventos, periodo] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { zonaHoraria: true } }),
    prisma.materia.findMany({
      where: { usuarioId, eliminadoEn: null }, select: { id: true, nombre: true, codigo: true },
    }),
    prisma.aliasMateria.findMany({ where: { usuarioId }, select: { alias: true, materiaId: true } }),
    prisma.eventoFijo.findMany({
      where: { usuarioId, eliminadoEn: null },
      select: { id: true, titulo: true, materiaId: true, diaSemana: true, horaInicio: true, horaFin: true, vigenteDesde: true, vigenteHasta: true },
    }),
    prisma.evento.findMany({
      where: { usuarioId, eliminadoEn: null, inicio: { gte: new Date(ahora.getTime() - DIA_MS), lte: new Date(ahora.getTime() + 365 * DIA_MS) } },
      select: { id: true, titulo: true, inicio: true, fin: true },
    }),
    periodoVigente(usuarioId, ahora),
  ]);
  return {
    zona: usuario?.zonaHoraria ?? 'America/La_Paz',
    materias, alias, clases: clases as ClaseFija[], eventos: eventos as EventoPuntual[], periodo,
  };
}

export type ContextoBorrador = Awaited<ReturnType<typeof cargarContexto>>;

export type OpcionesBorrador = {
  ahora: Date;
  /** Desde qué día se cuentan "mañana" o "el lunes" (una captura de chat de ayer). Por defecto, hoy. */
  referencia?: Date;
  /** Vigencia que trae el propio documento (periodo impreso en el horario). Tiene prioridad. */
  vigencia?: { desde: string; hasta: string; periodo: string } | null;
};

export async function construirBorrador(
  usuarioId: string,
  items: ItemExtraido[],
  ctx: ContextoBorrador,
  opciones: OpcionesBorrador,
) {
  const { ahora } = opciones;
  const { zona, materias, alias, clases, eventos, periodo } = ctx;

  // Clases que vienen en la misma entrada (para proponer la hora de un examen de esa materia)
  const clasesDelTexto = items
    .filter((i) => i.clase === 'evento_fijo')
    .map((i) => ({
      materiaClave: i.materia ? normalizarNombre(i.materia) : null,
      diasSemana: i.diasSemana, hora: i.hora, horaFin: i.horaFin, titulo: i.titulo,
    }));

  const borrador = [];
  for (const item of items) {
    const base = armarFechas(item, referenciaDe(item, opciones, zona), zona);
    const materiaPropuesta = proponerMateria(item.materia, item.codigoMateria, materias, alias);
    const materiaClave = item.materia ? normalizarNombre(item.materia) : null;
    const inicioItem = base.inicio ? new Date(base.inicio) : null;

    let horaPropuesta = null;
    let duplicado: Record<string, unknown> | null = null;
    let choques: { titulo: string; cuando: string }[] = [];
    let vigencia: { desde: string; hasta: string; periodo: string } | null = null;

    if (item.clase === 'tarea' && inicioItem) {
      // Examen o exposición sin hora → ¿es en horario de clase?
      if (!base.horaDefinida && (item.tipo === 'examen' || item.tipo === 'exposicion')) {
        horaPropuesta = proponerHoraDesdeHorario(inicioItem, zona, materiaPropuesta, clases, clasesDelTexto, materiaClave);
      }
      // ¿Ya existe?
      const dup = await buscarDuplicada(usuarioId, {
        titulo: item.titulo,
        fechaLimite: inicioItem,
        materiaId: materiaPropuesta.accion === 'vincular' ? materiaPropuesta.materiaId : null,
        materiaNombre: item.materia,
      });
      if (dup.estado !== 'nuevo') {
        duplicado = {
          tipoDuplicado: dup.estado,
          similitud: dup.similitud,
          tarea: dup.tarea,
          pregunta: preguntaDuplicado(dup.tarea),
          sugerenciasDiferencia: DIFERENCIAS_POR_TIPO[item.tipo ?? 'tarea'] ?? [],
        };
      }
    }

    if (item.clase === 'evento' && inicioItem) {
      const fin = base.fin ? new Date(base.fin) : null;
      // Un evento de varios días (una feria) no ocupa todas esas horas: no se buscan choques
      if (!fin || fin.getTime() - inicioItem.getTime() <= DIA_MS) {
        choques = choquesDeEvento(inicioItem, fin, zona, clases, eventos);
      }
    }

    if (item.clase === 'evento_fijo') {
      if (opciones.vigencia) {
        vigencia = opciones.vigencia;
      } else if (periodo) {
        vigencia = { desde: periodo.inicio.toISOString(), hasta: periodo.fin.toISOString(), periodo: periodo.nombre };
      } else {
        base.faltantes.push('periodo'); // el front pregunta "¿Cuándo termina tu semestre?"
      }
      if (item.hora && item.horaFin) {
        const r = revisarClase(
          item.diasSemana, item.hora, item.horaFin, item.titulo,
          materiaPropuesta.accion === 'vincular' ? materiaPropuesta.materiaId : null,
          clases, ahora,
        );
        choques = r.choques;
        if (r.existentes.length > 0) {
          const dias = r.existentes.map(nombreDia).join(' y ');
          duplicado = {
            tipoDuplicado: r.existentes.length === item.diasSemana.length ? 'seguro' : 'parcial',
            diasExistentes: r.existentes,
            pregunta: `Ya tienes «${item.titulo}» los ${dias} de ${item.hora} a ${item.horaFin}.`,
          };
        }
      }
    }

    borrador.push({ ...base, materiaPropuesta, horaPropuesta, vigencia, duplicado, choques });
  }
  return borrador;
}

/** Desde qué día se cuenta "mañana": el del mensaje (captura), el del documento, o hoy. */
export function referenciaDe(item: ItemExtraido, opciones: OpcionesBorrador, zona: string): Date {
  const delMensaje = item.fechaReferencia ? diaEnZona(item.fechaReferencia, '12:00', zona) : null;
  // Una fecha de mensaje en el futuro es una mala lectura: se ignora
  if (delMensaje && delMensaje.getTime() <= opciones.ahora.getTime() + DIA_MS) return delMensaje;
  return opciones.referencia ?? opciones.ahora;
}

/** Calcula fechas exactas y lo que falta de un ítem (las fechas las decide el sistema, no la IA). */
export function armarFechas(item: ItemExtraido, referencia: Date, zona: string) {
  const base = {
    ...item,
    inicio: null as string | null,
    fin: null as string | null,
    horaDefinida: false,
    supuestos: [] as string[],
    opcionesFecha: null as { etiqueta: string; fecha: string }[] | null,
    faltantes: [] as string[],
  };

  if (item.clase === 'evento_fijo') {
    if (item.diasSemana.length === 0) base.faltantes.push('dias');
    if (!item.hora) base.faltantes.push('hora');
    base.horaDefinida = item.hora !== null;
    return base;
  }

  const tipoHora = item.clase === 'tarea' ? item.tipo ?? 'tarea' : 'evento';
  const r = resolverFecha(item.fechaDicha, item.hora, tipoHora, referencia, zona);

  if (r.estado === 'falta') {
    base.faltantes.push('fecha');
    return base;
  }
  base.horaDefinida = r.horaDefinida;
  base.supuestos = r.supuestos;

  if (r.estado === 'ambigua') {
    base.faltantes.push('fecha');
    base.opcionesFecha = r.opciones.map((o) => ({ etiqueta: o.etiqueta, fecha: o.fecha.toISOString() }));
    return base;
  }

  base.inicio = r.fecha.toISOString();
  if (item.clase === 'evento') {
    if (item.fechaFinDicha) {
      // Varios días: termina el último día a la hora de cierre (o al final del día)
      const f = resolverFecha(item.fechaFinDicha, item.horaFin ?? '23:59', 'evento', referencia, zona);
      if (f.estado === 'ok') {
        // Una feria que YA empezó y sigue abierta: el inicio es de este año, no del siguiente
        const yaEmpezo = r.supuestos.includes('anio_siguiente') && !f.supuestos.includes('anio_siguiente');
        if (yaEmpezo && item.fechaDicha?.tipo === 'exacta') {
          const original = diaEnZona(item.fechaDicha.fecha, item.hora ?? HORA_POR_TIPO.evento, zona);
          if (original) {
            base.inicio = original.toISOString();
            base.supuestos = base.supuestos.filter((x) => x !== 'anio_siguiente');
          }
        }
        if (f.fecha > new Date(base.inicio!)) {
          base.fin = f.fecha.toISOString();
          base.supuestos.push('varios_dias');
        }
      }
    } else if (item.horaFin) {
      const f = resolverFecha(item.fechaDicha, item.horaFin, 'evento', referencia, zona);
      if (f.estado === 'ok') base.fin = f.fecha.toISOString();
    }
  }
  return base;
}
