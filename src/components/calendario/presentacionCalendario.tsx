import type { BloqueSemana } from './agendaSemana';
import { formatoHoraBolivia, inicioDiaBolivia, sumarDias } from './agendaSemana';
import type { TareaAgenda } from './agendaDia';
import { diaEnBolivia } from './organizarTareasDia';

export const botonCalendario = 'min-h-11 rounded-full border border-[#DEE8E1] bg-white px-4 text-sm font-medium text-[#35695D] transition-colors hover:bg-[#EDF3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B]';
export const fechaCompleta = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
});
export const diasCortos = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const tiposActividad = [
  { tipo: 'clase', nombre: 'Clases', color: '#80ACC3', fondo: '#E5F0F7' },
  { tipo: 'evento', nombre: 'Eventos', color: '#C5A355', fondo: '#FBF0D9' },
  { tipo: 'tarea', nombre: 'Tareas', color: '#82AB95', fondo: '#E7F2E9' },
] as const;

export function LeyendaCalendario() {
  return <ul aria-label="Tipos de actividad" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#697D72]">
    {tiposActividad.map(({ tipo, nombre, color }) => <li key={tipo} className="flex items-center gap-2">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{nombre}
    </li>)}
  </ul>;
}

const estados: Record<string, string> = {
  pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada', no_realizada: 'No realizada',
};

export function TareaSinHora({ tarea }: { tarea: TareaAgenda }) {
  return <article className="rounded-2xl border border-[#DCE9DE] bg-[#F2F7F1] p-4 [overflow-wrap:anywhere]">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#537663]">Tarea · Hora por definir</p>
    <h4 className="mt-1 text-sm font-semibold">{tarea.titulo}</h4>
    {tarea.materia && <p className="mt-1 text-xs text-[#5C7466]">{tarea.materia.nombre}</p>}
    <p className="mt-2 text-xs text-[#657B70]">{estados[tarea.estado] ?? tarea.estado}</p>
  </article>;
}

export function TarjetaActividad({ bloque }: { bloque: BloqueSemana }) {
  const estilo = tiposActividad.find(({ tipo }) => tipo === bloque.tipo)!;
  const datos = bloque.datos;
  return <article className="h-full min-w-0 overflow-auto rounded-2xl border border-white/80 border-l-[3px] p-3 text-[#294F44] [overflow-wrap:anywhere]"
    style={{ backgroundColor: estilo.fondo, borderLeftColor: datos.materia?.color ?? estilo.color }}>
    <p className="text-[9px] font-semibold uppercase tracking-wider opacity-75">{bloque.tipo === 'clase' ? 'Clase' : bloque.tipo === 'evento' ? 'Evento' : 'Tarea'}</p>
    <h4 className="mt-0.5 text-sm font-semibold leading-snug">{datos.titulo}</h4>
    <p className="mt-1 text-xs leading-5">
      {bloque.tipo === 'clase' && <>{bloque.datos.horaInicio} – {bloque.datos.horaFin}</>}
      {bloque.tipo === 'tarea' && <time dateTime={bloque.datos.fechaLimite.toISOString()}>{formatoHoraBolivia.format(bloque.datos.fechaLimite)}</time>}
      {bloque.tipo === 'evento' && <>
        <time dateTime={bloque.datos.inicio.toISOString()}>{formatoHoraBolivia.format(bloque.datos.inicio)}</time>
        {bloque.datos.fin && <> – <time dateTime={bloque.datos.fin.toISOString()}>{formatoHoraBolivia.format(bloque.datos.fin)}</time>
          {diaEnBolivia(bloque.datos.fin) !== diaEnBolivia(bloque.datos.inicio) && <span> (continúa varios días)</span>}</>}
      </>}
    </p>
    {datos.materia && <p className="mt-1 text-xs opacity-80">{datos.materia.nombre}</p>}
    {'ubicacion' in datos && datos.ubicacion && <p className="mt-1 text-xs opacity-75">{datos.ubicacion}</p>}
    {bloque.tipo === 'tarea' && <p className="mt-1 text-xs opacity-75">{estados[bloque.datos.estado] ?? bloque.datos.estado}</p>}
  </article>;
}

export function EstadoAgenda({ cargando, error, recargar }: { cargando: boolean; error: string | null; recargar: () => void }) {
  return <>
    {cargando && <p role="status" className="rounded-2xl bg-white p-6 text-sm text-[#35695D]">Cargando tu agenda…</p>}
    {error && <div role="alert" className="rounded-2xl border border-[#EED4D7] bg-[#FCF0F1] p-4 text-sm text-[#A34955]">
      <p>{error.includes('America/La_Paz') ? 'Revisa la zona horaria de tu perfil para mostrar el calendario.' : error}</p>
      <button type="button" className={botonCalendario + ' mt-3'} onClick={recargar}>Volver a cargar</button>
    </div>}
  </>;
}

function minutos(hora: string) {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

// Solo geometría visual: las tareas y eventos sin fin son hitos, sin duración asignada.
export function distribuirHorario(bloques: BloqueSemana[], fecha: string) {
  const inicio = inicioDiaBolivia(fecha).getTime();
  const finDia = inicioDiaBolivia(sumarDias(fecha, 1)).getTime();
  const posiciones = bloques.map((bloque) => {
    const desde = minutos(bloque.hora);
    const fin = bloque.tipo === 'clase' ? minutos(bloque.datos.horaFin)
      : bloque.tipo === 'evento' && bloque.datos.fin
        ? (Math.min(finDia, bloque.datos.fin.getTime()) - inicio) / 60000 : null;
    return { bloque, desde, hasta: fin === null ? null : Math.max(desde, fin) };
  });
  const primeraHora = Math.min(7, ...posiciones.map(({ desde }) => Math.floor(desde / 60)));
  const ultimaHora = Math.min(24, Math.max(20, ...posiciones.map(({ desde, hasta }) => Math.ceil((hasta ?? desde) / 60) + 1)));
  const escala = 1.6;
  const carriles: number[] = [];
  const distribuidos = posiciones.map((posicion) => {
    const top = (posicion.desde - primeraHora * 60) * escala;
    const height = Math.max(88, ((posicion.hasta ?? posicion.desde) - posicion.desde) * escala);
    let carril = carriles.findIndex((final) => final <= top);
    if (carril === -1) carril = carriles.length;
    carriles[carril] = top + height + 6;
    return { ...posicion, top, height, carril };
  });
  return {
    bloques: distribuidos, carriles: Math.max(1, carriles.length), primeraHora, ultimaHora,
    altura: Math.max((ultimaHora - primeraHora) * 60 * escala, ...distribuidos.map(({ top, height }) => top + height + 12)),
    escala,
  };
}
