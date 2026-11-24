import Link from 'next/link';
import { Suspense } from 'react';
import AgendaDiaVista from '@/components/calendario/AgendaDiaVista';
import InsigniaAnimo from '@/components/calendario/InsigniaAnimo';
import PreguntaAprendizaje from '@/components/aprendizaje/PreguntaAprendizaje';
import { diaEnBolivia, sumarDias } from '@/components/calendario/organizarTareasDia';
import { cargarAgenda, cargarTareas } from '@/lib/agenda/consultas';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';
import { nombreVisible } from '@/lib/usuarios/perfil';

async function cargarDatosDia() {
  const user = await obtenerUsuario();
  const fechaActual = new Date();
  const nombreSesion = typeof user?.user_metadata?.nombre === 'string'
    ? user.user_metadata.nombre
    : typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : user?.email?.split('@')[0] ?? 'estudiante';

  if (!user) return { nombre: nombreSesion, fechaActual, usuarioId: null };

  try {
    const perfil = await prisma.usuario.findUnique({ where: { id: user.id }, select: { nombre: true, apodo: true } });
    // El apodo (si lo puso en el perfil) manda; si no, el nombre de registro
    return { nombre: perfil ? nombreVisible(perfil) : nombreSesion, fechaActual, usuarioId: user.id };
  } catch {
    console.warn('No se pudo cargar el nombre del perfil.');
    return { nombre: nombreSesion, fechaActual, usuarioId: user.id };
  }
}

/**
 * Agenda y tareas del día, cargadas en el servidor y enviadas en la MISMA respuesta (streaming con Suspense):
 * la cabecera sale de inmediato y los datos llegan apenas están, sin que el celular haga otra vuelta a la base.
 * Mismo rango que pide AgendaDiaVista: desde ayer ("Ya pasaron") hasta mañana. Si algo falla, el cliente los pide.
 */
async function AgendaConDatos({ usuarioId, fechaActual }: { usuarioId: string; fechaActual: Date }) {
  const hoy = diaEnBolivia(fechaActual);
  const [agenda, tareas] = await Promise.allSettled([
    cargarAgenda(usuarioId, sumarDias(hoy, -1), sumarDias(hoy, 1)),
    cargarTareas(usuarioId),
  ]);
  const inicial = agenda.status === 'fulfilled' && agenda.value.ok && tareas.status === 'fulfilled'
    ? JSON.parse(JSON.stringify({ agenda: agenda.value.datos, tareas: tareas.value })) as { agenda: unknown; tareas: unknown }
    : null;
  return <AgendaDiaVista fechaActual={fechaActual.toISOString()} inicial={inicial} />;
}

/** Lo mismo que muestra AgendaDiaVista mientras carga. */
function CargandoDia() {
  return <div className="space-y-4">
    <div aria-hidden="true" className="h-64 animate-pulse rounded-[30px] bg-[#ECEFE7] motion-reduce:animate-none" />
    <p role="status" className="text-sm text-[#647168]">Cargando tu día…</p>
  </div>;
}

const zona = 'America/La_Paz';
/** Buenos días (05–12), buenas tardes (12–19), buenas noches (19–05), en la hora de Bolivia. */
function saludoDe(fecha: Date): string {
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', hourCycle: 'h23' }).format(fecha));
  return hora >= 5 && hora < 12 ? 'Buenos días' : hora >= 12 && hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default async function PaginaDia() {
  const { nombre, fechaActual, usuarioId } = await cargarDatosDia();
  const primero = nombre.trim().split(/\s+/)[0] || 'estudiante';
  const primerNombre = primero.charAt(0).toLocaleUpperCase('es') + primero.slice(1);
  const partes = new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: zona }).formatToParts(fechaActual);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value.replace('.', '') ?? '';
  const fechaCorta = `${parte('weekday')} ${parte('day')} ${parte('month')}`;

  return (
    <div className="min-w-0 space-y-6 md:space-y-8 lg:space-y-9">
      {/* Sin animación de entrada: es lo primero que se ve (LCP) y un fade desde opacidad 0 lo atrasa */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-[#8A958D]">
            <time dateTime={fechaActual.toISOString()} className="uppercase">{fechaCorta}</time>
            {usuarioId && <InsigniaAnimo />}
          </p>
          <h1 className="mt-1.5 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1F3B31] md:text-4xl">
            {saludoDe(fechaActual)},<br /><span className="break-words">{primerNombre}</span>
          </h1>
        </div>
        <Link href="/perfil" aria-label="Tu perfil"
          className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-[#234F45] text-xl font-semibold text-white shadow-[0_0_0_3px_#F6F7F2,0_0_0_4.5px_#CFE2D6] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28746B] focus-visible:ring-offset-4 motion-reduce:transition-none">
          {primerNombre.charAt(0)}
        </Link>
      </header>

      {usuarioId && <PreguntaAprendizaje key={usuarioId + ':' + diaEnBolivia(fechaActual)} claveConsulta={usuarioId + ':' + diaEnBolivia(fechaActual)} />}
      {usuarioId
        ? <Suspense fallback={<CargandoDia />}><AgendaConDatos usuarioId={usuarioId} fechaActual={fechaActual} /></Suspense>
        : <AgendaDiaVista fechaActual={fechaActual.toISOString()} />}
    </div>
  );
}
