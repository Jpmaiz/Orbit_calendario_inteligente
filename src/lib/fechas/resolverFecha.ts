/**
 * Resolver fechas: la IA dice QUÉ entendió ("miércoles", "la siguiente semana"),
 * este código calcula la fecha EXACTA. Las fechas nunca dependen de que la IA sume bien.
 *
 * Días de la semana en formato ISO: 1 = lunes … 7 = domingo.
 */

export type FechaDicha =
  | { tipo: 'exacta'; fecha: string } // "29 de octubre" → "2026-10-29"
  | { tipo: 'relativa'; dias: number } // hoy = 0, mañana = 1, "en 3 días" = 3
  | {
      tipo: 'diaSemana';
      dia: number; // 1–7
      semana: 'esta' | 'siguiente' | 'ambigua' | 'sin_especificar';
      // "este miércoles" | "el miércoles de la siguiente semana" | "el próximo miércoles" | "el miércoles"
    };

export type ResultadoFecha =
  | { estado: 'ok'; fecha: Date; horaDefinida: boolean; supuestos: string[] }
  | { estado: 'ambigua'; opciones: { etiqueta: string; fecha: Date }[]; horaDefinida: boolean; supuestos: string[] }
  | { estado: 'falta' };

/** Hora por defecto si no se dijo: un examen se rinde temprano; una entrega vence al final del día. */
export const HORA_POR_TIPO: Record<string, string> = {
  examen: '08:00',
  exposicion: '08:00',
  entrega: '23:59',
  tarea: '23:59',
  proyecto: '23:59',
  evento: '08:00', // un evento sin hora queda "por definir"; esto solo sirve para ordenarlo
};

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type Dia = { y: number; m: number; d: number }; // m: 1–12

/** Fecha y día de la semana de un instante, vistos en la zona horaria del usuario. */
function hoyEnZona(ahora: Date, zona: string): Dia & { diaSemana: number } {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(ahora);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  const semana = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(v('weekday')) + 1;
  return { y: +v('year'), m: +v('month'), d: +v('day'), diaSemana: semana };
}

/** Suma días a una fecha de calendario (sin horas, sin zona). */
function sumarDias(base: Dia, dias: number): Dia {
  const t = new Date(Date.UTC(base.y, base.m - 1, base.d + dias));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Instante real de "día D a las HH:mm" en la zona del usuario. */
export function instanteEnZona(dia: Dia, hora: string, zona: string): Date {
  const [hh, mm] = hora.split(':').map(Number);
  const comoUTC = Date.UTC(dia.y, dia.m - 1, dia.d, hh, mm);
  // Diferencia entre la zona y UTC en ese momento (funciona también con horario de verano)
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(comoUTC));
  const v = (t: string) => +p.find((x) => x.type === t)!.value;
  const visto = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'));
  return new Date(comoUTC - (visto - comoUTC));
}

const etiqueta = (dia: Dia, base: Dia & { diaSemana: number }) => {
  const dif = Math.round((Date.UTC(dia.y, dia.m - 1, dia.d) - Date.UTC(base.y, base.m - 1, base.d)) / 864e5);
  const ds = ((base.diaSemana - 1 + dif) % 7 + 7) % 7;
  return dif === 0 ? `Hoy ${dia.d}` : `${DIAS_CORTOS[ds]} ${dia.d}`;
};

/**
 * @param dicha  lo que entendió la IA (null si el texto no dice cuándo)
 * @param hora   "HH:mm" si el texto la dice, null si no
 * @param tipo   examen | entrega | … (decide la hora por defecto)
 */
export function resolverFecha(
  dicha: FechaDicha | null,
  hora: string | null,
  tipo: string,
  ahora: Date = new Date(),
  zona = 'America/La_Paz',
): ResultadoFecha {
  if (!dicha) return { estado: 'falta' };

  const horaValida = hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : null;
  const horaFinal = horaValida ?? HORA_POR_TIPO[tipo] ?? '23:59';
  const horaDefinida = horaValida !== null;
  const supuestos: string[] = horaDefinida ? [] : ['hora'];
  const hoy = hoyEnZona(ahora, zona);
  const ok = (dia: Dia, extra: string[] = []): ResultadoFecha => ({
    estado: 'ok', fecha: instanteEnZona(dia, horaFinal, zona), horaDefinida, supuestos: [...supuestos, ...extra],
  });

  if (dicha.tipo === 'relativa') {
    if (!Number.isInteger(dicha.dias) || dicha.dias < 0 || dicha.dias > 365) return { estado: 'falta' };
    return ok(sumarDias(hoy, dicha.dias));
  }

  if (dicha.tipo === 'exacta') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dicha.fecha);
    if (!m) return { estado: 'falta' };
    let dia: Dia = { y: +m[1], m: +m[2], d: +m[3] };
    const enDias = (x: Dia) => Date.UTC(x.y, x.m - 1, x.d);
    if (Number.isNaN(enDias(dia))) return { estado: 'falta' };
    // "15 de marzo" dicho en octubre → el próximo marzo
    if (enDias(dia) < enDias(hoy)) return ok({ ...dia, y: dia.y + 1 }, ['anio_siguiente']);
    return ok(dia);
  }

  // diaSemana
  if (!Number.isInteger(dicha.dia) || dicha.dia < 1 || dicha.dia > 7) return { estado: 'falta' };
  const hastaProximo = (dicha.dia - hoy.diaSemana + 7) % 7; // 0 = hoy es ese día
  const proximo = sumarDias(hoy, hastaProximo === 0 ? 7 : hastaProximo); // el más cercano después de hoy
  const lunesSiguiente = sumarDias(hoy, 8 - hoy.diaSemana);
  const deLaSiguiente = sumarDias(lunesSiguiente, dicha.dia - 1); // ese día en la semana calendario siguiente

  switch (dicha.semana) {
    case 'siguiente':
      return ok(deLaSiguiente);
    case 'esta':
      return ok(hastaProximo === 0 ? hoy : proximo);
    case 'sin_especificar':
      if (hastaProximo !== 0) return ok(proximo);
      // "el miércoles" dicho un miércoles: ¿hoy o el de la otra semana?
      return {
        estado: 'ambigua', horaDefinida, supuestos,
        opciones: [hoy, proximo].map((d) => ({ etiqueta: etiqueta(d, hoy), fecha: instanteEnZona(d, horaFinal, zona) })),
      };
    case 'ambigua': {
      // "el próximo miércoles": solo es ambiguo si las dos lecturas dan días distintos
      const iguales = proximo.y === deLaSiguiente.y && proximo.m === deLaSiguiente.m && proximo.d === deLaSiguiente.d;
      if (iguales) return ok(proximo);
      return {
        estado: 'ambigua', horaDefinida, supuestos,
        opciones: [proximo, deLaSiguiente].map((d) => ({ etiqueta: etiqueta(d, hoy), fecha: instanteEnZona(d, horaFinal, zona) })),
      };
    }
  }
}