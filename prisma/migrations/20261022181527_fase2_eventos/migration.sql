/*
  Warnings:

  - A unique constraint covering the columns `[usuario_id,uid_externo]` on the table `eventos_fijos` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "eventos_fijos" ADD COLUMN     "vigente_desde" TIMESTAMP(3),
ADD COLUMN     "vigente_hasta" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "hora_definida" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "materia_id" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),
    "ubicacion" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "uid_externo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_usuario_id_inicio_idx" ON "eventos"("usuario_id", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_usuario_id_uid_externo_key" ON "eventos"("usuario_id", "uid_externo");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_fijos_usuario_id_uid_externo_key" ON "eventos_fijos"("usuario_id", "uid_externo");

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
