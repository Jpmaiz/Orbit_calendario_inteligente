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

### D15. Estimación: la IA califica, el sistema calcula
**Qué:** la IA califica cada tarea con una rúbrica (escala, temas y su amplitud, cantidades, nivel cognitivo,
componentes, formato, claridad, peso académico) y cita la frase que respalda cada factor alto. Las horas, la
dificultad y la importancia las calcula `src/lib/estimacion/rubrica.ts` con reglas fijas.
**Por qué:** el mismo texto da siempre el mismo resultado, cada número tiene un "¿por qué?" y la IA no puede
inflar las horas: no las da. Un factor alto sin evidencia baja a su valor medio. Más temas suman cada vez
menos tiempo y el rango del tipo es un techo. Las tasas son parámetros iniciales que se calibrarán con las horas
reales que reporten los usuarios.

### D16. La estimación se calcula en el servidor al confirmar
**Qué:** el front manda el `indice` de cada ítem del borrador; `confirmar` recupera lo que leyó la IA y calcula
con el tipo final que dejó el usuario. Las horas nunca llegan del front. La tarea guarda `estimacion` (con sus
razones) y `horasDelUsuario` (si el usuario las fija, mandan).

### D17. "Vence con" y preparación de eventos
**Qué:** una entrega "al ingresar al examen" queda vinculada a ese examen (`venceConId`); si el examen cambia de
fecha, la entrega se mueve con él. Un evento con algo que estudiar ("cirugía: semiología de apéndice y nudos")
genera una tarea "Preparación: …" que vence al empezar el evento. El evento en sí es asistencia: 0 h.

### D18. Al usuario solo se le muestran las horas
**Qué:** el borrador expone `estimado = { horas, carga }`. La dificultad, las razones y los supuestos de la estimación
se quedan en el backend (`Tarea.estimacion`, motor de prioridad). `carga` (ligera, media, pesada) sirve solo para color.
**Por qué:** al estudiante le interesa cuánto tiempo necesita, no un puntaje de dificultad ni la explicación del cálculo.

### D19. Planificador determinista de bloques de estudio
**Qué:** `src/lib/plan/` reparte las horas de una actividad en los huecos libres (franja 07:00–22:30 menos clases,
eventos y otros bloques, con 15 min de margen). Bloques de 60 min (50 + 10 de pausa), máximo 2 h de la materia y 4 h de
estudio por día; un examen va en al menos 3 días, con repaso corto el día anterior y nada el mismo día; los días se eligen
repartidos y los más cercanos a la fecha reciben más. Si no alcanza, se arma lo que cabe y se dice cuánto falta.
**Por qué:** estudio espaciado (Cepeda et al., 2006) y pausas fijas (Biwer et al., 2023); la IA no decide horarios.
**Datos:** los bloques aceptados se guardan en `sugerencias` (motivo estudio/repaso, estado aceptada/cumplida/omitida);
el plan propuesto no se guarda hasta "Guardar plan". La capacidad diaria del motor de prioridad sale de los huecos reales.
**Pendiente:** franja preferida del usuario (Fase 3 la aprende de los bloques que mueve); replanificar todo de una vez.

### D20. Aprender sin pedirle nada al usuario
**Qué:** Orbit no pide marcar tareas ni bloques. Al pasar la fecha (+1 h) la actividad se da por hecha (`cerradaSolaEn`;
si el usuario la reabre, no se vuelve a cerrar). Aprende de lo que el usuario ya hace: el total con que guarda un plan
(si se aleja 30 min o más de lo estimado), los bloques que pone o saca respecto de la propuesta (franja preferida) y las
horas que cambia a mano. Una pregunta como máximo por semana, solo de actividades de 4 h o más; ignorarla no cuenta.
**Cálculo:** `src/lib/estimacion/personal.ts`. Razón real ÷ estimada en escala logarítmica, lo reciente pesa más (media vida
120 días), mezcla n ÷ (n + 3) por niveles (esta materia y tipo → este tipo → otros tipos), factor entre ×0,5 y ×2. Las señales
implícitas pesan 0,5; la respuesta y la edición, 1. El factor se aplica en silencio: el usuario solo ve las horas.
**Por qué:** marcar cosas cansa y la app deja de usarse; el silencio cuenta como "todo bien".
**Ajustes (8/11):** sin hora definida, la tarea se cierra al terminar su día (la hora guardada es interna); reabrir una tarea,
cerrada sola o a mano, impide que se vuelva a cerrar sola hasta que cambie su fecha. Borrar las horas vuelve a la estimación.

### D21. Razones a pedido y notas por categoría (10/11)
**Qué:** cambia D18 en un punto: el borrador trae `estimado.razones` (máx. 3 frases de ≤ 60 caracteres, sin números de la rúbrica
ni factor personal), que el front muestra **solo si el usuario toca el chip de horas**. Lo que la IA saca del mensaje (temas,
cosas que llevar, bibliografía, duración, otros detalles) llega como lista `notas` por categoría y se guarda en `Tarea.notas` y
`Evento.notas` (JSON), ya no pegado en la descripción. Lo que el usuario agrega con "Añade algo más" lo reparte la IA
(`POST /api/ia/notas`) en las mismas categorías; si falla o tarda más de 6 s, queda como "otros". Nada se guarda sin confirmar.
**Por qué:** el usuario pidió entender el número cuando le interesa, sin ensuciar la tarjeta; las notas en grupos se leen y se
quitan una por una. La IA percibe (reparte), el sistema valida (categorías fijas, sin repetidas) y el usuario confirma.

