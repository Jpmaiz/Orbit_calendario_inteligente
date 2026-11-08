-- Fase 3: aprendizaje sin pedir nada al usuario. Solo agrega columnas y una tabla nueva.

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "cerrada_sola_en" TIMESTAMP(3),
ADD COLUMN     "horas_reales" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "senales_aprendizaje" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tarea_id" TEXT,
    "materia_id" TEXT,
    "tipo_tarea" TEXT,
    "clase" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "razon" DOUBLE PRECISION,
    "franja" TEXT,
    "voto" INTEGER,
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "senales_aprendizaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "senales_aprendizaje_usuario_id_clase_creado_en_idx" ON "senales_aprendizaje"("usuario_id", "clase", "creado_en");

-- AddForeignKey
ALTER TABLE "senales_aprendizaje" ADD CONSTRAINT "senales_aprendizaje_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senales_aprendizaje" ADD CONSTRAINT "senales_aprendizaje_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
