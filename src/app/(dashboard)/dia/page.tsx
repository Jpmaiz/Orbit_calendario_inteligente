import AgendaDiaVista from '@/components/calendario/AgendaDiaVista';
import PreguntaAprendizaje from '@/components/aprendizaje/PreguntaAprendizaje';
import { diaEnBolivia } from '@/components/calendario/organizarTareasDia';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';

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
    const perfil = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { nombre: true },
    });
    return { nombre: perfil?.nombre || nombreSesion, fechaActual, usuarioId: user.id };
  } catch {
    console.warn('No se pudo cargar el nombre del perfil.');
    return { nombre: nombreSesion, fechaActual, usuarioId: user.id };
  }
}

export default async function PaginaDia() {
  const { nombre, fechaActual, usuarioId } = await cargarDatosDia();
  const primerNombre = nombre.trim().split(/\s+/)[0] || 'estudiante';
  const fechaFormateada = fechaActual.toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/La_Paz',
  });

  return (
    <div className="min-w-0 space-y-6 md:space-y-8 lg:space-y-9">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#708070]">Tu día, en órbita</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em] text-[#233E33] md:text-4xl">
            Hola, <span className="break-words">{primerNombre}</span>
          </h1>
          <time dateTime={fechaActual.toISOString()} className="mt-2 block text-sm text-[#768075] first-letter:uppercase">
            {fechaFormateada}
          </time>
        </div>
      </header>

      {usuarioId && <PreguntaAprendizaje key={usuarioId + ':' + diaEnBolivia(fechaActual)} claveConsulta={usuarioId + ':' + diaEnBolivia(fechaActual)} />}
      <AgendaDiaVista fechaActual={fechaActual.toISOString()} />
    </div>
  );
}
