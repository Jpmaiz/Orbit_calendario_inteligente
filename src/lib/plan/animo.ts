/**
 * "¿Cómo estás hoy?" (D23): tres botones opcionales arriba de Tu día. No guarda nada en el plan: arma una
 * propuesta que el usuario confirma (POST /api/dia/reacomodar).
 * - cansado:     pasa el estudio profundo de hoy a otros días, si alcanza el tiempo antes de la fecha.
 * - con energía: ofrece traer a hoy el próximo bloque de lo que vence antes.
 * - normal:      nada.
 * Un día marcado como cansado no cuenta para aprender la energía del usuario (los cambios confirmados aquí no votan).
 */
import { prisma } from '@/lib/prisma/cliente';
import { instanteEnZona } from '@/lib/fechas/resolverFecha';
import { ritmoDeUsuario, zonaDeUsuario } from '@/lib/usuarios/zona';
import { cargarAprendizaje } from '@/lib/aprendizaje/senales';
import { energiaEfectiva } from '@/lib/aprendizaje/energia';
import { cargarContextoPlan, type ContextoDeUsuario } from './cargar';
import { CONFIG_PLAN, demandaDe, limiteDePlan, textoHoras, topeEstudio, ubicarBloque } from './planificador';
import { diaLocal, sumarDias, claveDia, type HuecosDelDia } from './huecos';
import { limiteParaGuardar } from './validarPlan';

export const ESTADOS_ANIMO = ['energia', 'normal', 'cansado'] as const;
export type EstadoAnimo = (typeof ESTADOS_ANIMO)[number];
export type CambioBloque = {
  id: string; tareaId: string; titulo: string;
  de: { inicio: Date; fin: Date }; a: { inicio: Date; fin: Date }; razon: string | null;
};
export type PropuestaDia = { cambios: CambioBloque[]; mensaje: string | null };

const MIN_MS = 60_000;
const CUARTO_MS = 15 * MIN_MS;
const ABIERTA = { in: ['pendiente', 'en_proceso'] };
const SEL_TAREA = {
  id: true, titulo: true, tipo: true, fechaLimite: true, horaDefinida: true, materiaId: true, estimacion: true, dificultad: true,
} as const;

export const inicioDeDia = (f: Date, zona: string) => instanteEnZona(diaLocal(f, zona), '00:00', zona);
export const finDeDia = (f: Date, zona: string) => instanteEnZona(sumarDias(diaLocal(f, zona), 1), '00:00', zona);
const horaDe = (f: Date, zona: string) =>
  new Intl.DateTimeFormat('es-BO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(f);
const minutosEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MIN_MS);

/** Topes de estudio por día (Mi ritmo) y de 2 h por materia, con lo ya planificado de todas las actividades. */
function topes(ctx: ContextoDeUsuario, maxMin: number, menos: number[]) {
  const usado = new Map(ctx.minutosEstudioPorDia);
  const materia = new Map<string, number>();
  for (const b of ctx.bloquesAceptados ?? []) {
    if (!b.materiaId) continue;
    const k = `${claveDia(diaLocal(b.inicio, ctx.zona))}|${b.materiaId}`;
    materia.set(k, (materia.get(k) ?? 0) + minutosEntre(b.inicio, b.fin));
  }
  return {
    usado,
    topeDia: (materiaId: string | null) => (d: HuecosDelDia) => {
      const estudio = topeEstudio(d.diaSemana, maxMin, menos);
      if (!materiaId) return estudio;
      const libreMateria = CONFIG_PLAN.maxMateriaDiaMin - (materia.get(`${d.dia}|${materiaId}`) ?? 0);
      return Math.min(estudio, (usado.get(d.dia) ?? 0) + libreMateria);
    },
    sumar: (d: string, materiaId: string | null, min: number) => {
      if (materiaId) materia.set(`${d}|${materiaId}`, (materia.get(`${d}|${materiaId}`) ?? 0) + min);
    },
  };
}

export async function proponerParaHoy(usuarioId: string, estado: EstadoAnimo, ahora: Date = new Date()): Promise<PropuestaDia> {
  if (estado === 'normal') return { cambios: [], mensaje: null };
  const [zona, ritmo, aprendido] = await Promise.all([zonaDeUsuario(usuarioId), ritmoDeUsuario(usuarioId), cargarAprendizaje(usuarioId, ahora)]);
  const energia = energiaEfectiva(ritmo.energia, aprendido.momentos, ahora).energia;
  const maxMin = Math.round(ritmo.maxHorasDia * 60);
  const finHoy = finDeDia(ahora, zona);
  const base = { usuarioId, ahora, zona, energia, maxMin, menos: ritmo.menosEstudio, finHoy };
  return estado === 'cansado' ? aliviar(base) : adelantar(base);
}

type Base = {
  usuarioId: string; ahora: Date; zona: string; energia: ReturnType<typeof energiaEfectiva>['energia'];
  maxMin: number; menos: number[]; finHoy: Date;
};

/** Cansado: el estudio profundo de hoy pasa a otros días (si alcanza el tiempo); lo liviano se queda. */
async function aliviar({ usuarioId, ahora, zona, energia, maxMin, menos, finHoy }: Base): Promise<PropuestaDia> {
  const deHoy = await prisma.sugerencia.findMany({
    where: { usuarioId, estado: 'aceptada', fechaInicio: { gte: ahora, lt: finHoy }, tarea: { eliminadoEn: null, estado: ABIERTA } },
    select: { id: true, fechaInicio: true, fechaFin: true, motivo: true, tarea: { select: SEL_TAREA } },
    orderBy: { fechaInicio: 'asc' },
  });
  if (!deHoy.length) return { cambios: [], mensaje: 'Hoy no tienes estudio planificado. Descansa.' };
  const pesados = deHoy.filter((b) => b.motivo !== 'repaso' && demandaDe(b.tarea) === 'profundo');
  if (!pesados.length) return { cambios: [], mensaje: 'Hoy solo tienes estudio liviano: tómalo con calma.' };

  const limites = pesados.map((b) => limiteDePlan(b.tarea, zona));
  const hasta = new Date(Math.max(...limites.map((l) => l.getTime())));
  // Sin tareaId: todos los bloques guardados (también los de estas actividades) cuentan como ocupados
  const ctx = hasta > finHoy ? await cargarContextoPlan(usuarioId, finHoy, hasta, ahora) : null;
  const t = ctx ? topes(ctx, maxMin, menos) : null;

  const cambios: CambioBloque[] = [];
  const avisos: string[] = [];
  for (const [i, b] of pesados.entries()) {
    const minutos = minutosEntre(b.fechaInicio, b.fechaFin);
    const limite = limites[i];
    if (!ctx || !t || limite <= finHoy) {
      avisos.push(`No puedo mover «${b.tarea.titulo}»: no queda otro día antes de la fecha.`);
      continue;
    }
    const dias = ctx.dias.filter((d) => d.huecos.length);
    const puesto = ubicarBloque(dias, minutos, 'profundo', {
      zona, ahora: finHoy, limite, energia, topeDia: t.topeDia(b.tarea.materiaId), usadoPorDia: t.usado,
    });
    if (!puesto) {
      avisos.push(`No puedo mover «${b.tarea.titulo}»: no hay otro hueco libre antes de la fecha.`);
      continue;
    }
    t.sumar(claveDia(diaLocal(puesto.inicio, zona)), b.tarea.materiaId, minutos);
    cambios.push({
      id: b.id, tareaId: b.tarea.id, titulo: b.tarea.titulo,
      de: { inicio: b.fechaInicio, fin: b.fechaFin }, a: { inicio: puesto.inicio, fin: puesto.fin }, razon: puesto.razon,
    });
  }
  const movidos = cambios.reduce((s, c) => s + minutosEntre(c.de.inicio, c.de.fin), 0);
  const quedan = deHoy.length - cambios.length;
  const partes = [
    cambios.length ? `Paso ${textoHoras(movidos)} de estudio pesado a otros días. ${quedan ? 'Hoy te queda solo lo liviano.' : 'Hoy te queda libre.'}` : null,
    ...avisos,
  ].filter(Boolean);
  return { cambios, mensaje: partes.join(' ') };
}

/** Con energía: trae a hoy el próximo bloque de lo que vence antes (uno solo, para no sobrecargar el día). */
async function adelantar({ usuarioId, ahora, zona, energia, maxMin, menos, finHoy }: Base): Promise<PropuestaDia> {
  const [ctx, futuros] = await Promise.all([
    cargarContextoPlan(usuarioId, ahora, finHoy, ahora),
    prisma.sugerencia.findMany({
      where: { usuarioId, estado: 'aceptada', motivo: { not: 'repaso' }, fechaInicio: { gte: finHoy }, tarea: { eliminadoEn: null, estado: ABIERTA } },
      select: { id: true, fechaInicio: true, fechaFin: true, tarea: { select: SEL_TAREA } },
      orderBy: [{ tarea: { fechaLimite: 'asc' } }, { fechaInicio: 'asc' }],
      take: 20,
    }),
  ]);
  if (!futuros.length) return { cambios: [], mensaje: 'No tienes estudio planificado para adelantar.' };
  const hoy = ctx.dias.filter((d) => d.huecos.length);
  const t = topes(ctx, maxMin, menos);
  const vistas = new Set<string>();
  for (const b of futuros) {
    if (vistas.has(b.tarea.id)) continue; // de cada actividad, solo su próximo bloque
    vistas.add(b.tarea.id);
    const limite = limiteDePlan(b.tarea, zona);
    const minutos = minutosEntre(b.fechaInicio, b.fechaFin);
    const puesto = ubicarBloque(hoy, minutos, demandaDe(b.tarea), {
      zona, ahora, limite: limite < finHoy ? limite : finHoy, energia, topeDia: t.topeDia(b.tarea.materiaId), usadoPorDia: t.usado,
    });
    if (!puesto) continue;
    return {
      cambios: [{
        id: b.id, tareaId: b.tarea.id, titulo: b.tarea.titulo,
        de: { inicio: b.fechaInicio, fin: b.fechaFin }, a: { inicio: puesto.inicio, fin: puesto.fin }, razon: puesto.razon,
      }],
      mensaje: `¿Adelanto ${textoHoras(minutos)} de «${b.tarea.titulo}» para hoy a las ${horaDe(puesto.inicio, zona)}?`,
    };
  }
  return { cambios: [], mensaje: 'Hoy no hay un hueco libre para adelantar estudio.' };
}

/**
 * Aplica los cambios que el usuario confirmó (mover bloques ya guardados). Reglas: el bloque es suyo, todavía no
 * empezó y su actividad sigue abierta; la nueva hora es desde ahora, en cuartos de hora, con la misma duración, antes
 * de la fecha y sin cruzarse con clases, eventos ni otros bloques.
 */
export async function aplicarCambios(
  usuarioId: string, body: unknown, ahora: Date = new Date(),
): Promise<{ ok: true; bloques: { id: string; tareaId: string; inicio: Date; fin: Date }[] } | { ok: false; error: string; status: number }> {
  const lista = (body as { cambios?: unknown })?.cambios;
  if (!Array.isArray(lista) || !lista.length || lista.length > 10) return { ok: false, error: 'Usa { cambios: [{ id, inicio, fin }] } (1 a 10)', status: 400 };
  const pedidos: { id: string; inicio: Date; fin: Date }[] = [];
  for (const [i, x] of lista.entries()) {
    const r = (x ?? {}) as Record<string, unknown>;
    const inicio = typeof r.inicio === 'string' ? new Date(r.inicio) : null;
    const fin = typeof r.fin === 'string' ? new Date(r.fin) : null;
    if (typeof r.id !== 'string' || !inicio || !fin || isNaN(+inicio) || isNaN(+fin) || fin <= inicio) {
      return { ok: false, error: `Cambio ${i + 1}: usa { id, inicio, fin } con fechas válidas`, status: 400 };
    }
    pedidos.push({ id: r.id, inicio, fin });
  }
  if (new Set(pedidos.map((p) => p.id)).size !== pedidos.length) return { ok: false, error: 'Un bloque aparece dos veces', status: 400 };

  const zona = await zonaDeUsuario(usuarioId);
  const actuales = await prisma.sugerencia.findMany({
    where: { id: { in: pedidos.map((p) => p.id) }, usuarioId, estado: 'aceptada', tarea: { eliminadoEn: null, estado: ABIERTA } },
    select: { id: true, tareaId: true, fechaInicio: true, fechaFin: true, tarea: { select: { fechaLimite: true, horaDefinida: true } } },
  });
  const porId = new Map(actuales.map((a) => [a.id, a]));
  const desdeAhora = Math.floor(ahora.getTime() / CUARTO_MS) * CUARTO_MS;
  for (const [i, p] of pedidos.entries()) {
    const a = porId.get(p.id);
    const n = `Cambio ${i + 1}`;
    if (!a) return { ok: false, error: `${n}: bloque no encontrado`, status: 404 };
    if (a.fechaInicio <= ahora) return { ok: false, error: `${n}: ese bloque ya empezó`, status: 409 };
    if (+p.inicio % CUARTO_MS || +p.fin % CUARTO_MS) return { ok: false, error: `${n}: empieza y termina en :00, :15, :30 o :45`, status: 400 };
    if (minutosEntre(p.inicio, p.fin) !== minutosEntre(a.fechaInicio, a.fechaFin)) return { ok: false, error: `${n}: el bloque debe durar lo mismo`, status: 400 };
    if (+p.inicio < desdeAhora) return { ok: false, error: `${n}: empieza antes de ahora`, status: 400 };
    if (p.fin > limiteParaGuardar(a.tarea, zona)) return { ok: false, error: `${n}: termina después de la fecha de la actividad`, status: 400 };
  }
  for (let i = 0; i < pedidos.length; i++) for (let j = i + 1; j < pedidos.length; j++) {
    if (pedidos[i].inicio < pedidos[j].fin && pedidos[j].inicio < pedidos[i].fin) return { ok: false, error: 'Dos bloques quedarían cruzados', status: 400 };
  }
  const desde = new Date(Math.min(...pedidos.map((p) => +p.inicio)));
  const hasta = new Date(Math.max(...pedidos.map((p) => +p.fin)));
  const ctx = await cargarContextoPlan(usuarioId, desde, hasta, ahora);
  // Los bloques que se mueven no chocan consigo mismos en su hora anterior
  const viejos = actuales.map((a) => `${+a.fechaInicio}|${+a.fechaFin}`);
  const ocupaciones = ctx.ocupaciones.filter((o) => !(o.titulo.startsWith('Estudio: ') && viejos.includes(`${+o.inicio}|${+o.fin}`)));
  for (const [i, p] of pedidos.entries()) {
    const choca = ocupaciones.find((o) => p.inicio < o.fin && o.inicio < p.fin);
    if (choca) return { ok: false, error: `Cambio ${i + 1}: se cruza con «${choca.titulo}»`, status: 400 };
  }

  await prisma.$transaction(pedidos.map((p) => prisma.sugerencia.update({ where: { id: p.id }, data: { fechaInicio: p.inicio, fechaFin: p.fin } })));
  return { ok: true, bloques: pedidos.map((p) => ({ id: p.id, tareaId: porId.get(p.id)!.tareaId, inicio: p.inicio, fin: p.fin })) };
}
