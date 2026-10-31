# Orbit · Decisiones de arquitectura

Cada decisión en pocas líneas: **qué** se decidió, **por qué** y **qué se descartó**.

---

### D1. La IA percibe, el sistema decide
**Qué:** la IA solo describe lo que dijo el usuario o lo que ve en una imagen. Fechas, materias, duplicados,
choques y prioridades los calcula código determinista.
**Por qué:** un LLM describe bien pero calcula mal (suma días, confunde columnas). El código siempre da el mismo
resultado y se puede probar.
**Descartado:** que la IA devuelva la fecha final o decida si algo es duplicado.

### D2. Borrador antes de guardar
**Qué:** toda captura con IA produce un **borrador** que el usuario revisa y confirma. Nada se guarda antes.
**Por qué:** la IA puede equivocarse; el usuario siempre tiene la última palabra. Además, cada corrección del
usuario queda registrada (`fueCorregida`) y sirve para medir la precisión.
**Descartado:** guardar directo lo que dice la IA.

### D3. Nada bloquea el guardado
**Qué:** lo que falta o es dudoso se marca (faltantes, supuestos, avisos), pero no impide guardar.
"Hora por definir" es un estado válido.
**Por qué:** un estudiante anota rápido; obligarlo a completar todo hace que deje de usar la app.

### D4. Horarios: dos lecturas independientes + árbitro
**Qué:** la grilla se lee fila por fila y, aparte, columna por columna; se comparan casilla por casilla y solo
las diferencias se vuelven a consultar.
**Por qué:** en una foto chueca, la v1 corría clases de columna. Es la técnica de doble digitación.
Detalle y mediciones en `docs/PROMPTS.md`.
**Costo:** 2 llamadas (3 si hay diferencias), ~9 s. Un horario se carga una vez por semestre.

### D5. El PDF se convierte en el navegador
**Qué:** el navegador convierte cada página en JPEG con pdf.js y extrae su texto; el servidor solo recibe imágenes.
**Por qué:** un solo camino en el backend; el PDF (con datos personales) no viaja ni se guarda.
La imagen da la estructura de la grilla y el texto confirma siglas y aulas.

### D6. Privacidad
**Qué:** las imágenes no se guardan; el prompt ignora carnet, registro y teléfonos; en la base solo queda lo
extraído. Cada usuario ve solo lo suyo: `usuarioId` sale de la sesión (nunca del front) y Supabase tiene RLS.

### D7. Confirmación idempotente
**Qué:** cada `interpretacionId` se confirma una sola vez (reserva atómica `pendiente → aplicada` dentro de una
transacción). Un reintento devuelve el mismo resultado con `repetido: true`.
**Por qué:** doble clic, red móvil inestable o respuesta perdida no deben duplicar clases ni tareas.

### D8. Motor de prioridad por holgura (Least Slack Time)
**Qué:** `holgura = días que faltan − días de trabajo necesarios`, contando también lo que vence antes
(criterio de demanda de EDF). Urgencia `75 · 0.5^(holgura/3)` + importancia (alta 25, media 15, baja 5).
Horas con colchón por la falacia de planificación (×1.25 a ×1.75 según dificultad).
**Por qué:** un proyecto grande que vence en dos semanas puede ser más urgente que una lectura de pasado mañana.
Es explicable paso a paso (cada tarea trae su desglose).
**Descartado:** ordenar solo por fecha límite, o que la IA "decida" la prioridad.

### D9. Duplicados: el sistema compara y pregunta
**Qué:** similitud de Jaccard sobre palabras normalizadas (sin tildes ni palabras vacías, "II" = "2"),
con reglas que separan cosas distintas (más de 24 h de diferencia, otra materia, otro número).
Similitud 1 → seguro; ≥ 0.5 → probable. Nunca descarta solo: pregunta.

### D10. Materias: código → alias → nombre → crear
**Qué:** la materia se propone por código exacto, luego por alias aprendido (si el usuario corrigió "BD" →
"Base de Datos II", la próxima vez lo hace solo), luego por nombre; si no existe, se propone crearla.
Solo es "segura" si hay una única candidata.

### D11. Fechas por código, en la zona del usuario
**Qué:** días ISO (1 = lunes) y zona `America/La_Paz`. "Mañana" se cuenta desde el día en que se dijo
(en una captura, desde la fecha del mensaje). Un afiche sin año toma la próxima fecha que caiga así.
Un evento "8 pm – 12 am" termina al día siguiente.

### D12. Semestre (periodo académico)
**Qué:** las clases tienen vigencia (inicio y fin del semestre). Dos semestres no pueden cruzarse. Si el horario
del SIAAN trae el semestre impreso, al confirmar se crea solo.

### D13. Proveedor de IA intercambiable
**Qué:** interfaz `AdaptadorIA`; DeepSeek por defecto y Gemini de respaldo (`IA_PROVEEDOR` en `.env`).
**Por qué:** Gemini estaba bloqueado por región; cambiar de proveedor no debe tocar la lógica.

### D14. Soft delete
**Qué:** borrar = marcar `eliminadoEn`. Permite deshacer y conserva el historial para métricas.
