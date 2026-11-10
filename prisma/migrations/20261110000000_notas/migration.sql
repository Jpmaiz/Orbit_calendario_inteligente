-- Notas por categoría en tareas y eventos (tarjeta del borrador: Detalles)
ALTER TABLE "tareas" ADD COLUMN "notas" JSONB;
ALTER TABLE "eventos" ADD COLUMN "notas" JSONB;
