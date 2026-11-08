-- Fase 2: bloques de estudio en la tabla sugerencias. Solo agrega un índice.

-- CreateIndex
CREATE INDEX "sugerencias_tarea_id_idx" ON "sugerencias"("tarea_id");
