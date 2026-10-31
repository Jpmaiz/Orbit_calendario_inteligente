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
- **Sale:** `{ items: [...] }`, un ítem por actividad (máx. 10).

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

---

## 3. Confianza

| Origen | Cómo se obtiene |
|---|---|
| Clases de un horario | **La calcula el código**: 0.95 si las dos lecturas coinciden en todas sus casillas; 0.6 si alguna pasó por el árbitro |
| Texto, afiche, captura | La estima la propia IA (autoevaluación), limitada entre 0 y 1 |

Los valores 0.95 y 0.6 son umbrales para la interfaz ("confiable" / "revisa esto"), no probabilidades medidas.
Mejora pendiente: calibrarlos con un set de horarios de prueba.

---

## Cómo cambiar un prompt sin romper nada

1. Editar el prompt en su archivo (`extraccion.ts` o `imagen.ts`).
2. Repetir las pruebas con `scripts/probar-imagen.ts` (horario PDF, foto chueca, afiche, captura).
3. Si cambia el formato de salida, actualizar también su `normalizar…` (validación) y este documento.
