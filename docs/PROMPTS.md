# Orbit · Prompts de IA

Este documento explica **qué le pide Orbit a la IA, por qué se lo pide así y cómo evolucionó cada prompt**.
El texto exacto de cada prompt vive en el código (es la fuente de verdad); aquí se explica y se apunta al archivo.

- **Modelo:** DeepSeek `deepseek-flash` (texto e imágenes). Respaldo: Gemini, con `IA_PROVEEDOR=gemini` en `.env`.
- **Configuración** (`src/lib/ia/deepseek.ts`): `temperature 0.2` (respuestas estables), salida forzada a JSON
  (`response_format: json_object`), sin modo de razonamiento (solo agrega demora para extraer datos),
  reintento automático ante 429 y 5xx.
- **Sin memoria:** cada llamada es independiente. Por eso cada prompt lleva la fecha de hoy, la zona horaria
  y las materias del estudiante.

---

## Principio de diseño: la IA percibe, el sistema decide

Todos los prompts siguen la misma regla. La IA **solo describe lo que ve o lo que dijo el usuario**:

| La IA hace | El sistema (código) hace |
|---|---|
| Dice "el viernes", "mañana", "20 al 29 de noviembre" | Calcula la fecha exacta (`resolverFecha`) |
| Copia el texto de cada casilla del horario | Separa sigla, paralelo y aula (`grilla.ts`) |
| Lee la grilla dos veces | Compara casilla por casilla y decide qué es confiable (`celdas.ts`) |
| Escribe el nombre de la materia | Busca la materia por código, alias o nombre (`proponerMateria`) |
| Califica la actividad con una rúbrica (temas, nivel cognitivo, formato…) | Calcula horas, dificultad e importancia (`estimacion/rubrica.ts`) |
| — | Duplicados, choques, vigencia, prioridad |

**Por qué:** un modelo de lenguaje puede sumar mal días o confundir columnas, pero describe bien. Lo que se
puede calcular se calcula con código determinista: siempre da el mismo resultado y se puede probar.

Además, **todo lo que devuelve la IA se valida campo por campo** (`normalizarItems`, `normalizarLectura`):
una hora "25:00", un día 9 o un tipo inventado se descartan. Nunca se confía a ciegas.

---

## 1. Extracción desde texto

- **Archivo:** `src/lib/ia/extraccion.ts` → `construirPromptExtraccion` + `REGLAS_ITEMS`
- **Endpoint:** `POST /api/ia/extraer` · **1 llamada**
- **Entra:** el texto del estudiante, hoy, zona horaria, sus materias.
- **Sale:** `{ items: [...] }`, un ítem por actividad (máx. 12). Cada tarea trae su `estimacion` (rúbrica, ver §4).

**Reglas clave del prompt y por qué:**

| Regla | Por qué |
|---|---|
| Clasificar en `tarea` / `evento` / `evento_fijo` | Cada una se guarda en una tabla distinta |
| Título formal, **sin verbo** ("Informe de Base de Datos") | El tipo ya dice la acción; títulos uniformes ayudan a detectar duplicados |
| Conservar lo que distingue ("teórico", "parte 2") | Si no, dos exámenes distintos parecerían el mismo |
| **"NO calcules fechas; describe lo que dijo el texto"** | La IA solo dice `diaSemana` / `relativa` / `exacta`; el código calcula |
| "el próximo lunes" → `semana: ambigua` | Es ambiguo en español; el sistema muestra las dos opciones |
| "NUNCA inventes una fecha ni una hora" | Si falta, el sistema pregunta o usa "hora por definir" |
| Si solo hay código ("SIS-311"), va en `codigoMateria` | El sistema la busca por código o pide el nombre |
| `evidencia` = fragmento exacto | Para mostrar de dónde salió cada ítem |
| Eventos de varios días → `fechaFinDicha` | "Feria del 20 al 29" es UN evento, no diez |
| Extraer también lo que se menciona de paso ("el día del examen de la 4.ª unidad") | Ese examen es otra actividad; si ya existe, lo detecta el control de duplicados |
| Día no dicho pero claro por el contexto → `fechaInferida: true` | El sistema lo propone como opción y el usuario lo confirma con un toque |
| `venceCon`: "entregar al ingresar a rendir el examen" | La entrega toma la fecha y hora del examen y queda vinculada a él |
| `materiaSugerida`: la materia no se nombra pero el contenido la delata | Se propone sin darla por segura (patologías + IHQ → Anatomía Patológica) |
| `preparacion` en un evento ("cirugía: estudiar apéndice y nudos") | El evento es asistencia (0 h); el sistema crea la tarea "Preparación: …" |
| `preparativos` y `referencias` | "Entregar en físico" va al checklist; el libro, a los detalles. Nunca suman horas |
| Ignorar saludos y ruido ("buenos días", "cualquier duda inbox") | No son actividades |

---

## 2. Lectura de imágenes (horario, afiche, captura, pizarra)

- **Archivo:** `src/lib/ia/imagen.ts`
- **Endpoint:** `POST /api/ia/extraer-imagen`
- **Llamadas:** horario = 2 (3 si hay diferencias); afiche, captura o pizarra = 1.

### 2.1 Lectura principal — `construirPromptLectura`

Entra: imagen(es) + hoy + materias + (opcional) el texto del PDF. Sale: tipo de documento y, según el caso,
la **grilla** del horario o los **ítems** (mismo formato que el texto).

| Regla | Por qué |
|---|---|
| Primero decidir `tipoDocumento` | Un solo endpoint para todo tipo de imagen |
| **Privacidad:** ignorar carnet, registro, teléfonos y nombres de estudiantes | El horario del SIAAN trae datos personales que no se necesitan |
| Horario: copiar la grilla **fila por fila, con las casillas vacías como `""`** | La **posición** en la lista fija el día (ver evolución abajo) |
| Copiar el texto de la casilla **tal cual** ("SIS-233 [1] Aula: LRED/A1-3") | Separar sigla, paralelo y aula lo hace el código, que no se equivoca |
| Casilla combinada → repetir su texto en cada fila | Para que el código pueda unir bloques |
| "La foto puede estar chueca: sigue las líneas de la grilla" | Fotos inclinadas o en perspectiva |
| Nombre de materia formal con tildes ("ANALISIS…" → "Análisis…") | Presentación |
| Captura de chat: `fechaReferencia` = fecha **del mensaje** ("Ayer", "Hoy") | "mañana" dicho ayer = hoy |
| La hora del reloj del celular **no** es la fecha de los mensajes | Error común de lectura |
| `textoAdjunto` = texto exacto del PDF, solo para confirmar siglas y horas | La estructura sale de la imagen; el texto de un PDF pierde la tabla |

### 2.2 Segunda lectura independiente — `construirPromptColumnas`

Solo horarios. **No ve la primera lectura.** Lee la grilla **columna por columna** (cada día de arriba abajo).

**Por qué otro sentido de lectura:** si las dos lecturas recorren la imagen igual, cometen el mismo error.
Leyendo en el otro sentido, un corrimiento de columna en la lectura 1 casi nunca se repite en la 2.

### 2.3 Árbitro — `construirPromptArbitro`

Solo si hay casillas en las que las dos lecturas no coinciden. Pregunta **solo esas casillas**
("Fila de 09:00 a 09:45, columna VIERNES"). Las clases que pasaron por el árbitro quedan con confianza 0.6
y marcadas para que el usuario las revise.

**Idea de fondo:** es la **doble digitación** de la captura de datos: dos lecturas independientes y se revisan
solo las discrepancias.

### Evolución del prompt de horarios (medido)

| Versión | Estrategia | Horario PDF | Foto chueca y borrosa |
|---|---|---|---|
| v1 | La IA devolvía celdas sueltas con número de día; una 2.ª consulta revisaba la 1.ª | 8/8 clases ✅ | **6/8** ❌ corrió columnas (Redes el martes y el sábado) y la revisión, influida por la 1.ª lectura, no lo corrigió |
| **v2 (actual)** | Grilla completa con casillas vacías + 2.ª lectura independiente por columnas + árbitro | 8/8 ✅ (21/21 casillas coinciden) | **8/8** ✅ (21/21, 0 conflictos) |

Pruebas adicionales con v2: segundo horario del SIAAN con 6 materias (30/30 casillas, 10/10 clases),
afiche de feria de varios días, afiche de concierto que termina pasada la medianoche y captura de WhatsApp
con mensajes de "Ayer" y "Hoy" (3/3 fechas correctas).

Script para repetir las pruebas: `npx tsx --env-file=.env scripts/probar-imagen.ts <imagen> [texto.txt]`.

**Ajustes por un horario de Medicina (v2.1, 7/11/2026):** el reporte traía prácticas con paralelo "[4-B]",
una casilla con su hora escrita "(14:15-16:30)", dos periodos (anual y semestral) y la grilla seguía en la
página 2 sin la fila de días. Ahora: el paralelo acepta guion y "4-B" se marca como práctica si existe "[4]";
la hora escrita en la casilla manda sobre la de la fila; la IA devuelve `periodos` con sus siglas y cada clase
toma las fechas de su periodo; los prompts piden heredar los días de la página 1. Además, el texto del PDF se
limpia de carnet, registro y nombre antes de mandarlo (`src/lib/privacidad.ts`). Pruebas sin IA:
`npx tsx scripts/probar-lectura.ts`.

---

## 3. Confianza

| Origen | Cómo se obtiene |
|---|---|
| Clases de un horario | **La calcula el código**: 0.95 si las dos lecturas coinciden en todas sus casillas; 0.6 si alguna pasó por el árbitro |
| Texto, afiche, captura | La estima la propia IA (autoevaluación), limitada entre 0 y 1 |

Los valores 0.95 y 0.6 son umbrales para la interfaz ("confiable" / "revisa esto"), no probabilidades medidas.
Mejora pendiente: calibrarlos con un set de horarios de prueba.

---

## 4. Estimación de horas y dificultad (Fase 1)

- **Archivos:** reglas para la IA en `REGLAS_ITEMS` (bloque ESTIMACION); cálculo en `src/lib/estimacion/rubrica.ts`.
- **Misma llamada** que la extracción: no agrega espera.
- **Fundamento:** documento "Orbit: fundamento de la estimación y el plan de estudio" (Rice, Webb DOK, Wood,
  Sweller, Buehler). **Pruebas:** `npx tsx scripts/probar-rubrica.ts` (sin IA) y
  `npx tsx --env-file=.env scripts/probar-estimacion.ts` (con IA).

**Lo que califica la IA** (para un estudiante promedio que asistió a clases; NO da horas):

| Campo | Qué es | Regla clave |
|---|---|---|
| `escala` | control / parcial / final (solo exámenes) | Oral o evaluación de práctica = control. Si no se sabe: null (el sistema supone parcial y lo avisa) |
| `temas` + `amplitud` | Los contenidos que nombra el texto | "Cardio", "la 4.ª competencia" = amplio (cuenta como 3). Subdivisiones = un tema. En una comparación, cada cosa comparada es un tema. El nombre del propio trabajo no es un tema |
| `cantidades` | Páginas, ejercicios, diapositivas, minutos de exposición | "20 pts" es la calificación: no es cantidad y se ignora |
| `volumen` | bajo / medio / alto | Solo si no hay temas ni cantidades |
| `nivelCognitivo` | 1 recordar · 2 aplicar · 3 analizar o integrar · 4 crear | Cuadro comparativo o historia clínica = 3 |
| `partes`, `grupal`, `formato`, `claridad` | Componentes, coordinación, oral/práctico/a mano, instrucciones vagas | |
| `impostergable` | "Entrega impostergable", "no se recibe tarde" | Sube la importancia a alta; nunca suma horas |
| `evidencia` | Frase exacta que justifica cada factor alto | **Sin frase, el factor baja a su valor medio** (lo aplica `normalizarLecturaEstimacion`) |

**Lo que calcula el sistema:**

1. **Rango por tipo** (h): control 1–2 · parcial 4–8 · final 8–14 · tarea 1–3 · entrega 2–5 · exposición 3–6 · proyecto 10–30.
2. **Horas:** con cantidades, por tasas (15 o 6 pág/h leídas, 1 o 2 h por página escrita, 15 o 35 min por ejercicio,
   15 min por diapositiva, 6 min de preparación por minuto expuesto). Si no, posición en el rango =
   temas ÷ (temas + 5): 1 tema 17 %, 5 temas 50 %, 10 temas 67 %; nunca el máximo. Sin temas, volumen
   (25 / 50 / 65 %). Nivel 3–4: +10 puntos. Ajuste: +10 % varias partes, +10 % grupal, tope +20 %. Se recorta
   al rango y se redondea a media hora.
3. **Dificultad** = nivel cognitivo + 0,5 por cada factor alto, de 1 a 5. Factores: componentes (varias partes, grupal,
   5 o más temas equivalentes, o examen final, que integra todo) · oral o práctico · claridad baja.
4. **Importancia** (va a `prioridad`): final, exposición y proyecto = alta; parcial y entrega = media; control y tarea = baja.
   Impostergable = alta. La calificación ("sobre 20 puntos") no se toma en cuenta en nada.
5. **Respaldo:** si la IA no pudo leer, centro del rango y `origen: general`.

Las horas son **netas**: el colchón por falacia de planificación (×1,25 a ×1,75) lo aplica solo `prioridad.ts`.
Si el usuario fija las horas, `horasDelUsuario = true` y ninguna estimación las reemplaza.

**Ajustes tras la primera prueba con DeepSeek (7/11):** la IA contaba "nefríticos vs nefróticos" como 1 tema y el
título de la historia clínica como tema (salían 1,5 h en vez de 2 h); ponía "preparar la demo" como preparativo;
un final de 6 temas salía con dificultad 2. Se aclararon las reglas de temas, preparativos y nivel (defender = 3),
y los componentes ahora incluyen muchos temas y el examen final. La entrega "vence con" toma la hora del examen
(antes quedaba 23:59).

**Por qué así:** la primera versión ubicaba volumen alto en el máximo del rango (un final con 5 temas daba 14 h).
Era exagerado: más temas no deben sumar tiempo en línea recta. Con rendimiento decreciente da 11,5 h.

---

## Cómo cambiar un prompt sin romper nada

1. Editar el prompt en su archivo (`extraccion.ts` o `imagen.ts`).
2. Repetir las pruebas con `scripts/probar-imagen.ts` (horario PDF, foto chueca, afiche, captura),
   `scripts/probar-estimacion.ts` (textos de ejemplo y `--consistencia`) y las pruebas sin IA:
   `scripts/probar-rubrica.ts` y `scripts/probar-lectura.ts`.
3. Si cambia el formato de salida, actualizar también su `normalizar…` (validación) y este documento.
