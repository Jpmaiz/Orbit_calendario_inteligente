-- CreateTable
CREATE TABLE "periodos_academicos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "periodos_academicos_usuario_id_fin_idx" ON "periodos_academicos"("usuario_id", "fin");

-- AddForeignKey
ALTER TABLE "periodos_academicos" ADD CONSTRAINT "periodos_academicos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
