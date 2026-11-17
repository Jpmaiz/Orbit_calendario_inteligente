/**
 * Diagnóstico: ¿de qué cuenta es cada tarea que se vio en /dia? Solo lee. Muestra el correo enmascarado.
 *
 * Uso: npx tsx scripts/diagnosticar-cuentas.ts
 */
import { prisma } from '../src/lib/prisma/cliente';

const enmascarar = (c: string) => c.replace(/^(.{2}).*(@.*)$/, '$1***$2');

async function main() {
  const tareas = await prisma.tarea.findMany({
    where: { OR: [{ titulo: { contains: 'Teórico de Redes' } }, { titulo: { contains: 'Análisis de Algoritmos' } }] },
    select: { id: true, titulo: true, estado: true, fechaLimite: true, eliminadoEn: true, usuario: { select: { id: true, email: true } } },
    orderBy: { fechaLimite: 'asc' },
  });
  for (const t of tareas) {
    console.log(`${t.fechaLimite.toISOString()} · ${t.titulo} · ${t.estado}${t.eliminadoEn ? ' (eliminada)' : ''} · cuenta ${t.usuario.id.slice(0, 8)} ${enmascarar(t.usuario.email)}`);
  }
  const usuarios = await prisma.usuario.findMany({ select: { id: true, email: true, creadoEn: true }, orderBy: { creadoEn: 'asc' } });
  console.log(`\nCuentas (${usuarios.length}):`);
  for (const u of usuarios) console.log(`${u.id.slice(0, 8)} ${enmascarar(u.email)} · creada ${u.creadoEn.toISOString().slice(0, 10)}`);
}
main().finally(() => prisma.$disconnect());
