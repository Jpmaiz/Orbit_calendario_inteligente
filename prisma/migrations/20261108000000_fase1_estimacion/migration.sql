-- Fase 1: estimación de horas y dificultad, y vínculo "vence con".
-- Solo agrega columnas e índice: no toca datos existentes.

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "estimacion" JSONB,
ADD COLUMN     "horas_del_usuario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vence_con_clase" TEXT,
ADD COLUMN     "vence_con_id" TEXT;

-- CreateIndex
CREATE INDEX "tareas_vence_con_id_idx" ON "tareas"("vence_con_id");
