-- Avisos (notificaciones push, D25). Solo agrega: una columna en usuarios, una en recordatorios y una tabla nueva.

-- Preferencias de avisos del usuario: { bloques, manana } (src/lib/avisos/preferencias.ts). null = todo activado
ALTER TABLE "usuarios" ADD COLUMN "avisos" JSONB;

-- Recordatorios ya enviados: la clave evita mandar dos veces el mismo ("bloque:<id>", "manana:2026-11-24")
ALTER TABLE "recordatorios" ADD COLUMN "clave" TEXT;
CREATE UNIQUE INDEX "recordatorios_usuario_id_clave_key" ON "recordatorios"("usuario_id", "clave");

-- Dispositivos donde el usuario activó los avisos (un celular, una PC…)
CREATE TABLE "suscripciones_push" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "suscripciones_push_endpoint_key" ON "suscripciones_push"("endpoint");
CREATE INDEX "suscripciones_push_usuario_id_idx" ON "suscripciones_push"("usuario_id");
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nadie la lee desde la API pública de Supabase (solo el backend con Prisma, que no pasa por RLS)
ALTER TABLE "suscripciones_push" ENABLE ROW LEVEL SECURITY;
