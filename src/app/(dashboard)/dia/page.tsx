import TarjetaTarea from '@/components/calendario/TarjetaTarea';
import ControlesDashboard from '@/components/dashboard/ControlesDashboard';
import { organizarTareasDia } from '@/components/calendario/organizarTareasDia';
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

  if (!user) return { tareas: [], nombre: nombreSesion, fechaActual };

  try {
    const [tareas, perfil] = await Promise.all([
      prisma.tarea.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        orderBy: { fechaLimite: 'asc' },
        include: { materia: { select: { nombre: true, color: true } } },
      }),
      prisma.usuario.findUnique({
        where: { id: user.id },
        select: { nombre: true },
      }).catch(() => null),
    ]);
    return { tareas, nombre: perfil?.nombre || nombreSesion, fechaActual };
  } catch {
    console.warn('Carga real de tareas fallida.');
    return { tareas: [], nombre: nombreSesion, fechaActual };
  }
}

export default async function PaginaDia() {
  const { tareas, nombre, fechaActual } = await cargarDatosDia();
  const primerNombre = nombre.trim().split(/\s+/)[0] || 'estudiante';
  const fechaFormateada = fechaActual.toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/La_Paz',
  });

  const secciones = organizarTareasDia(tareas, fechaActual)
    .filter((seccion) => seccion.tareas.length > 0);

  return (
    <div className="min-w-0 space-y-6 md:space-y-8 lg:space-y-9">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#708070]">Tu día, en órbita</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em] text-[#233E33] md:text-4xl">
            Buenos días, <span className="break-words">{primerNombre}</span>
          </h1>
          <time dateTime={fechaActual.toISOString()} className="mt-2 block text-sm text-[#768075] first-letter:uppercase">
            {fechaFormateada}
          </time>
        </div>
      </header>

      <section aria-labelledby="titulo-tareas" className="space-y-5">
        <ControlesDashboard ubicacion="selector" />
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-tareas" className="text-lg font-semibold tracking-[-0.02em]">Tus tareas</h2>
          <span className="text-xs text-[#788174]">{tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'} en total</span>
        </div>
        {tareas.length === 0 && (
          <p className="text-xs leading-5 text-[#657360]">
            Aún no tienes tareas.
          </p>
        )}
        {tareas.length > 0 && secciones.length === 0 && (
          <p className="text-xs leading-5 text-[#657360]">
            No hay tareas vencidas, para hoy, para los próximos 7 días ni completadas hoy.
          </p>
        )}
        <div className="min-w-0 space-y-6 md:space-y-8">
          {secciones.map((seccion) => (
            <section key={seccion.id} aria-labelledby={'titulo-' + seccion.id} className="min-w-0 space-y-3 md:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={'titulo-' + seccion.id} className="text-base font-semibold tracking-[-0.02em] text-[#233E33]">{seccion.titulo}</h3>
                <span className="text-xs text-[#788174]">{seccion.tareas.length} {seccion.tareas.length === 1 ? 'tarea' : 'tareas'}</span>
              </div>
              <ul className="min-w-0 space-y-3 md:space-y-4">
                {seccion.tareas.map((tarea) => (
                  <li key={tarea.id}>
                    <TarjetaTarea tarea={{
                      id: tarea.id,
                      titulo: tarea.titulo,
                      fechaLimite: tarea.fechaLimite.toISOString(),
                      tipo: tarea.tipo,
                      prioridad: tarea.prioridad,
                      estado: tarea.estado,
                      materia: tarea.materia,
                    }} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
