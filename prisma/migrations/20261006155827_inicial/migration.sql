-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/La_Paz',
    "margen_minimo_min" INTEGER NOT NULL DEFAULT 30,
    "nivel_notificacion" TEXT NOT NULL DEFAULT 'importante',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#5A3FA0',
    "semestre" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "materias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_fijos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "materia_id" TEXT,
    "titulo" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "ubicacion" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "uid_externo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "eventos_fijos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "materia_id" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "fecha_limite" TIMESTAMP(3) NOT NULL,
    "duracion_est_min" INTEGER NOT NULL DEFAULT 60,
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "prioridad_calculada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "completada_en" TIMESTAMP(3),
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sugerencias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'propuesta',
    "respondida_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sugerencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorios" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tarea_id" TEXT,
    "evento_id" TEXT,
    "sugerencia_id" TEXT,
    "fecha_envio" TIMESTAMP(3) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recordatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpretaciones_ia" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo_entrada" TEXT NOT NULL,
    "entrada_original" TEXT NOT NULL,
    "respuesta_ia" JSONB NOT NULL,
    "confianza" DOUBLE PRECISION,
    "fue_corregida" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "modelo_usado" TEXT NOT NULL,
    "tiempo_respuesta_ms" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interpretaciones_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "eventos_fijos_usuario_id_dia_semana_idx" ON "eventos_fijos"("usuario_id", "dia_semana");

-- CreateIndex
CREATE INDEX "tareas_usuario_id_fecha_limite_idx" ON "tareas"("usuario_id", "fecha_limite");

-- CreateIndex
CREATE INDEX "tareas_usuario_id_estado_idx" ON "tareas"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "sugerencias_usuario_id_fecha_inicio_idx" ON "sugerencias"("usuario_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "recordatorios_usuario_id_fecha_envio_idx" ON "recordatorios"("usuario_id", "fecha_envio");

-- CreateIndex
CREATE INDEX "interpretaciones_ia_usuario_id_creado_en_idx" ON "interpretaciones_ia"("usuario_id", "creado_en");

-- AddForeignKey
ALTER TABLE "materias" ADD CONSTRAINT "materias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_fijos" ADD CONSTRAINT "eventos_fijos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_fijos" ADD CONSTRAINT "eventos_fijos_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugerencias" ADD CONSTRAINT "sugerencias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugerencias" ADD CONSTRAINT "sugerencias_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpretaciones_ia" ADD CONSTRAINT "interpretaciones_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
