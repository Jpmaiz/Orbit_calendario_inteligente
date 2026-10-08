import { prisma } from '@/lib/prisma/cliente';
import { obtenerUsuario } from '@/lib/supabase/servidor';

export default async function PaginaDia() {
  const user = await obtenerUsuario();

  const tareas = user
    ? await prisma.tarea.findMany({
        where: { usuarioId: user.id, eliminadoEn: null },
        orderBy: { fechaLimite: 'asc' },
        include: { materia: { select: { nombre: true, color: true } } },
      })
    : [];

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
            <li
              key={t.id}
              className="rounded-lg bg-gray-800 p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{t.titulo}</p>
                <p className="text-sm text-gray-400">
                  {t.materia?.nombre ?? 'Sin materia'} ·{' '}
                  {new Date(t.fechaLimite).toLocaleDateString('es-BO')}
                </p>
              </div>
              <span className="text-xs text-gray-500">{t.estado}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}