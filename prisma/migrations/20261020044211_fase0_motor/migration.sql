/*
  Warnings:

  - You are about to drop the column `prioridad_calculada` on the `tareas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[usuario_id,codigo]` on the table `materias` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "materias" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "tareas" DROP COLUMN "prioridad_calculada",
ADD COLUMN     "dificultad" INTEGER,
ADD COLUMN     "plan_ia" JSONB,
ALTER COLUMN "duracion_est_min" DROP NOT NULL,
ALTER COLUMN "duracion_est_min" DROP DEFAULT;

-- CreateTable
CREATE TABLE "alias_materias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "materia_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alias_materias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alias_materias_usuario_id_alias_key" ON "alias_materias"("usuario_id", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "materias_usuario_id_codigo_key" ON "materias"("usuario_id", "codigo");

-- AddForeignKey
ALTER TABLE "alias_materias" ADD CONSTRAINT "alias_materias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alias_materias" ADD CONSTRAINT "alias_materias_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
