import TarjetaTarea from '@/components/calendario/TarjetaTarea';
import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';

async function cargarTareas() {
  const user = await obtenerUsuario();

  return user
    ? await prisma.tarea.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        orderBy: { fechaLimite: 'asc' },
        include: { materia: { select: { nombre: true, color: true } } },
      })
    : [];
}

export default async function PaginaDia() {
  const tareas = await cargarTareas();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hoy</h1>

      {tareas.length === 0 ? (
        <p className="text-gray-400">
          No tenés tareas todavía. Agregá una para empezar.
        </p>
      ) : (
        <ul className="space-y-2">
          {tareas.map((t) => (
            <li key={t.id}>
              <TarjetaTarea
                tarea={{
                  id: t.id,
                  titulo: t.titulo,
                  fechaLimite: t.fechaLimite.toISOString(),
                  tipo: t.tipo,
                  prioridad: t.prioridad,
                  estado: t.estado,
                  materia: t.materia,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}