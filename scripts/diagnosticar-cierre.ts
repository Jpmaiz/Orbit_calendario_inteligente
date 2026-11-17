/**
 * Diagnóstico del cierre automático: por qué hay tareas pasadas que siguen pendientes.
 * No borra nada. Muestra cada tarea pasada abierta, por qué no se cerró y prueba el cierre.
 *
 * Uso: npx tsx scripts/diagnosticar-cierre.ts
 */
import { prisma } from '../src/lib/prisma/cliente';
import { cerrarVencidas } from '../src/lib/tareas/cierre';

async function main() {
  const ahora = new Date();
  const abiertas = await prisma.tarea.findMany({
    where: { eliminadoEn: null, estado: { in: ['pendiente', 'en_proceso'] }, fechaLimite: { lt: ahora } },
    select: { titulo: true, usuarioId: true, fechaLimite: true, horaDefinida: true, cerradaSolaEn: true },
    orderBy: { fechaLimite: 'asc' },
  });
  console.log(`Tareas pasadas abiertas: ${abiertas.length}`);
  for (const t of abiertas) {
    const motivo = t.cerradaSolaEn ? `reabierta el ${t.cerradaSolaEn.toISOString()} (se cierra desde el día siguiente)` : 'debería cerrarse';
    console.log(`- ${t.titulo} · ${t.fechaLimite.toISOString()} · horaDefinida=${t.horaDefinida} · usuario ${t.usuarioId.slice(0, 8)} → ${motivo}`);
  }
  const usuarios = [...new Set(abiertas.map((t) => t.usuarioId))];
  for (const u of usuarios) {
    try {
      const r = await cerrarVencidas(u, ahora);
      console.log(`Cierre para ${u.slice(0, 8)}: ${r.count} cerradas`);
    } catch (e) {
      console.log(`Cierre para ${u.slice(0, 8)}: ERROR → ${(e as Error).message}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
