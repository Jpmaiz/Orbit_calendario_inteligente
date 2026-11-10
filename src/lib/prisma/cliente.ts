import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** ORBIT_TIEMPOS=1 en el .env → imprime cuánto tarda cada consulta (para encontrar lo lento). */
const medir = process.env.ORBIT_TIEMPOS === '1';

function crear() {
  const cliente = new PrismaClient(medir ? { log: [{ emit: 'event', level: 'query' }] } : undefined);
  if (medir) {
    (cliente as unknown as { $on: (e: 'query', f: (q: { duration: number; query: string }) => void) => void })
      .$on('query', (q) => console.log(`[db] ${q.duration} ms · ${q.query.replace(/\s+/g, ' ').slice(0, 90)}`));
  }
  return cliente;
}

export const prisma = globalForPrisma.prisma ?? crear();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}