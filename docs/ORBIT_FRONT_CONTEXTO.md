# Orbit — Contexto del backend para el front (v2.3 · 29/10/2026)

> **Para la IA que lee este archivo:** eres el asistente de la compañera que construye el **frontend** de Orbit. El backend lo hace Juan Pablo (rama `jp`). Este documento es tu fuente de verdad sobre qué endpoints existen, qué devuelven y cómo deben usarse en las pantallas.
>
> **Antes de escribir código, haz el Paso 0**: pregúntale qué tiene hecho y llena la sección "Estado del front". No asumas nada que no te haya mostrado. Si algo de este documento no coincide con el código que ella te muestra, **díselo** en vez de adivinar: el backend puede haber cambiado.

---

## Índice

★ [Novedades de la v2.3 (29/10) — captura por foto y PDF](#novedades-23)
★ [Novedades de la v2.2 (28/10) — leer primero si ya integraste la v2.1](#novedades)
0. [Paso 0 — Pregunta qué hay hecho](#paso-0)
1. [Qué cambió desde la v1](#cambios)
2. [Principios del sistema (no romperlos)](#principios)
3. [Preparar el entorno](#entorno)
4. [Modelo de datos que ve el front](#modelo)
5. [Endpoints](#endpoints)
6. [Pantalla del borrador (la más importante de esta versión)](#borrador)
7. [De borrador a confirmación: cómo armar el body](#armar)
8. [Otras pantallas](#otras)
9. [Lo que todavía NO existe](#pendiente)
10. [Ejemplo completo de punta a punta](#ejemplo)

---

<a id="novedades-23"></a>
## ★ Novedades de la v2.3 (29/10/2026)

Captura por **foto, captura de pantalla o PDF**. Referencia completa de la API: **`docs/openapi.yaml`** (Postman: Import → archivo).
Cómo funcionan los prompts: `docs/PROMPTS.md`. Por qué se diseñó así: `docs/DECISIONES.md`.

| # | Cambio | ¿Afecta al front? |
|---|---|---|
| 1 | **Nuevo** `POST /api/ia/extraer-imagen` | Sí: ya está conectado en `CapturaRapida.tsx` |
| 2 | **Nuevo** `src/components/ia/capturaArchivo.ts` (prepara foto o PDF en el navegador) | No hay que tocarlo |
| 3 | `CapturaRapida.tsx`: botón **"Subir foto o PDF"** + línea con el archivo y cómo se verificó | Revisa el diff antes de tu próximo merge |
| 4 | `confirmar` crea solo el **semestre impreso** en el horario y devuelve `periodoCreado` | Opcional: mostrar "Semestre 2-2026 creado" |
| 5 | Aviso en `advertencias` si algo **ya pasó** («Reunión…» ya pasó…) | Ya se muestra en la lista de avisos |
| 6 | Materias nuevas guardan el código como se lee (`SIS-233`, antes `sis233`) | No |
| 7 | Dependencia nueva: `pdfjs-dist` → corre `npm install` después del merge | Sí |

### 1. `POST /api/ia/extraer-imagen`
- **Body:** `{ imagenes: string[] (1–3, data URL JPEG/PNG/WebP, ≤ 4 MB c/u), textoAdjunto?: string }`.
  `capturaArchivo.ts` ya lo arma: achica la foto a 2000 px en JPEG; un PDF se convierte con pdf.js (máx. 3 páginas) y su texto va en `textoAdjunto`.
- **Respuesta:** **el mismo borrador que `/api/ia/extraer`** (`interpretacionId`, `items`, `periodo`, `advertencias`) → se revisa y se confirma igual. Además trae:
  ```ts
  documento: {
    tipo: 'horario' | 'afiche' | 'captura_chat' | 'pizarra' | 'otro';
    fechaReferencia: { fecha: 'AAAA-MM-DD'; origen: 'documento' | 'hoy' } | null; // desde qué día se contó "mañana"
    periodoDetectado: { nombre; inicio; fin; existente: {...} | null } | null;     // semestre impreso en el horario
    revision: { hecha; coinciden; conflictos; correcciones: string[]; diferencias: string[] };
    materias: {            // SOLO horarios: clases agrupadas por materia (para la vista de semana)
      clave; nombre; codigo; color: '#2F6F5E';
      indices: number[];   // posiciones en items[]
      sesiones: { diasSemana; hora; horaFin; aula; indice }[];
      revisar: boolean;    // alguna clase salió de una lectura dudosa
    }[];
  }
  ```
- **Tarda** de 3 a 12 s (un horario se lee dos veces). Mostrar "Leyendo tu horario…".
- **Confianza** en las clases de un horario: **0.95** = las dos lecturas coincidieron; **0.6** = hubo diferencia → resaltar "Revisa esta clase".
- Las clases de un horario ya traen `vigencia` del semestre impreso: **no hace falta preguntar "¿cuándo termina tu semestre?"** si `periodoDetectado` existe.

### 2. Pendiente de UI (lo veremos juntos)
El borrador de un horario hoy muestra una tarjeta-formulario por clase (10 tarjetas). La propuesta:
mini grilla "Así quedará tu semana" con `documento.materias` (un color por materia) + **una tarjeta compacta por materia**
(editar solo al tocar) + arriba solo lo que requiere atención + un botón "Agregar 6 materias y 10 clases".

---

<a id="novedades"></a>
## ★ Novedades de la v2.2 (28/10/2026)

Cambios del backend desde la v2.1 (auditoría del front del 27/10 + interacción manual). Rama `jp`, commits `eac424f` → `ebb1864` y siguientes.

### Resumen

| # | Cambio | ¿Rompe algo del front? |
|---|---|---|
| 1 | `POST /api/ia/confirmar` es **idempotente**: `interpretacionId` pasa a ser **obligatorio** | Solo si alguna vez se llama sin `interpretacionId` |
| 2 | Registro y login **reparan solos** el perfil local si falta | No. Nuevo mensaje de error posible en registro |
| 3 | **Nuevo** CRUD de eventos de una vez: `/api/eventos-puntuales` | No |
| 4 | Clases (`/api/eventos/[id]`): `PATCH` acepta `vigenteDesde` / `vigenteHasta` y valida horas contra lo guardado | No |
| 5 | **Nuevo** `PATCH` / `DELETE /api/periodos/[id]` | No |
| 6 | **Nuevo** `POST /api/ia/revisar`: recalcula duplicados y choques del borrador editado | No |
| 7 | **Eliminado** `POST /api/ia` (atajo legado). `flujoCaptura.ts` quedó solo con `fechaElegidaISO` | Solo si algo todavía lo llamaba (no debería) |
| 8 | `src/app/(dashboard)/layout.tsx` ahora es `async` (3 líneas arriba, sin cambios visuales) | No |

### 1. Confirmar idempotente (resuelve el riesgo crítico de la auditoría)

- `interpretacionId` es **obligatorio**. Sin él → **400** `"Falta interpretacionId (viene en la respuesta de /api/ia/extraer)"`.
- Cada `interpretacionId` se confirma **una sola vez**:
  - Primera vez → **201** `{ creados, omitidos }` (igual que antes).
  - Reintento con el mismo id (se perdió la respuesta, doble envío, red) → **200** `{ creados, omitidos, repetido: true }` con **exactamente** el mismo resultado. **No crea nada**, aunque venga `confirmarNueva: true`.
  - Dos envíos simultáneos: la base deja pasar solo uno; el otro recibe el `200 repetido`.
- **Tratar 200 y 201 como éxito** (`res.ok`). Si `repetido === true` se puede mostrar el mismo resumen.
- "Quiero crear OTRA actividad distinta" = un `extraer` nuevo (otro `interpretacionId`). Un mismo borrador nunca se guarda dos veces.
- Otros estados: **404** `"Interpretación no encontrada"` (id ajeno o inexistente) · **409** `"Esta interpretación ya no se puede confirmar"`.

### 2. Registro y perfil local (resuelve el riesgo medio de la auditoría)

- El perfil local (`usuarios`) se crea con un **upsert idempotente** en: registro, login, enlace de confirmación de correo (`/api/auth/callback`) y entrada al dashboard (`layout.tsx`). Si alguna vez falla, **se repara solo** en la siguiente entrada; el registro ya no lanza excepción.
- El nombre se guarda también en Supabase (`user_metadata.nombre`).
- Nuevo mensaje posible en `/registro?error=`: **"Ese correo ya está registrado. Inicia sesión."** (viene en español: el traductor de errores debe dejarlo pasar tal cual).
- El mensaje tras registrarse ahora es **"Revisa tu correo para confirmar tu cuenta"** (sin voseo), en `/login?mensaje=` codificado con `encodeURIComponent`.

### 3. Eventos de una vez — `/api/eventos-puntuales` (NUEVO)

No confundir con `/api/eventos`, que son las **clases semanales**. Para **listar** sigue usándose `/api/agenda`.

| Método | Ruta | Body | Respuestas |
|---|---|---|---|
| POST | `/api/eventos-puntuales` | `{ titulo, inicio, fin?, descripcion?, ubicacion?, materiaId?, confirmarNueva? }` | **201** `{ evento, choques }` · **409** `{ error, duplicado }` · **400** |
| GET | `/api/eventos-puntuales/[id]` | — | **200** `{ evento }` · **404** |
| PATCH | `/api/eventos-puntuales/[id]` | cualquier campo de arriba (sin `confirmarNueva`) | **200** `{ evento, choques }` · **400** · **404** |
| DELETE | `/api/eventos-puntuales/[id]` | — | **200** `{ mensaje }` · **404** (borrado suave) |

- `inicio` / `fin` en ISO con zona: `"2026-11-02T09:00:00-04:00"`. `fin` es opcional (`null` = sin hora de fin).
- El `PATCH` valida inicio y fin **juntos con lo ya guardado**: mandar solo `fin` anterior al `inicio` guardado → **400** `"La hora de fin debe ser posterior a la de inicio"`. Máximo 14 días de duración.
- `choques` = aviso (no bloquea): `[{ titulo, cuando }]`, con clases vigentes y otros eventos. En el `PATCH` se recalculan con los datos nuevos.
- Duplicado = mismo nombre a menos de 1 h → **409** `{ error: "Ya tienes «X» a esa hora. ¿Es otro?", duplicado: { id, titulo, inicio } }`. Para crearlo igual, reenviar con `confirmarNueva: true`.
- `evento.materia` viene incluida (`{ id, nombre, color } | null`).

### 4. Clases — cambios en `PATCH /api/eventos/[id]`

- Acepta `vigenteDesde` y `vigenteHasta` (ISO o `null`). Útil para una clase que termina antes que el semestre.
- Valida horas y vigencia **combinadas con lo guardado**: `{ "horaInicio": "11:00" }` en una clase que termina a las 10:00 → **400**.
- `POST /api/eventos` también acepta `vigenteDesde` / `vigenteHasta`.

### 5. Periodos — `PATCH` y `DELETE /api/periodos/[id]` (NUEVO)

| Método | Body | Respuestas |
|---|---|---|
| PATCH | `{ nombre?, inicio?: "AAAA-MM-DD", fin?: "AAAA-MM-DD" }` | **200** `{ periodo, clasesActualizadas }` · **400** · **404** · **409** (pisa otro semestre) |
| DELETE | — | **200** `{ mensaje: "Periodo eliminado. Tus clases se mantienen." }` · **404** |

- Al cambiar fechas, las clases que **heredaron** las fechas viejas del semestre se mueven con él (`clasesActualizadas` dice cuántas). Las que el usuario ajustó a mano no se tocan.
- Al cambiar el nombre, se actualiza el `semestre` de las materias que tenían el nombre viejo.
- Tras borrar el periodo vigente, `GET /api/periodos` devuelve `actual: null` y el front vuelve a mostrar "¿Cuándo termina tu semestre?".
- UI sugerida: en Perfil o en el aviso del semestre, [Editar fechas] y [Eliminar] con confirmación propia (no `confirm()` del navegador).

### 6. `POST /api/ia/revisar` (NUEVO) — resuelve "choques y duplicados tras edición"

Recalcula duplicados y choques del borrador **después de que el usuario lo editó**. No llama a la IA ni guarda nada: es instantáneo.

- **Body:** `{ items: [...] }` en el **mismo formato** que `/api/ia/confirmar` (los `ItemConfirmado` armados según §7). Sin `interpretacionId`.
- **200:** `{ items: [...] }`, uno por ítem y en el mismo orden:
  ```ts
  type ResultadoRevision =
    | { indice: number; duplicado: DuplicadoTarea | DuplicadoClase | DuplicadoEvento | null; choques: { titulo: string; cuando: string }[] }
    | { indice: number; error: string };   // ítem incompleto (ej. todavía sin fecha): no bloquea a los demás

  type DuplicadoEvento = { tipoDuplicado: 'seguro'; evento?: { id: string; titulo: string; inicio: string }; pregunta: string };
  ```
- Revisa también **entre ítems del mismo borrador**: dos eventos que se cruzan, o una clase/evento repetido. Esos choques vienen con el sufijo **"(en este borrador)"** en el `titulo`.
- Cuándo llamarlo: al cambiar fecha, hora, días o materia de una tarjeta (con *debounce* de ~400 ms), y antes de [Confirmar todo]. Reemplaza los `duplicado` / `choques` que vinieron de `extraer` para esa tarjeta.

### 7. Eliminado: `POST /api/ia`

- La ruta ya no existe (404/405). No era idempotente.
- De `src/components/ia/flujoCaptura.ts` quedó **solo** `fechaElegidaISO` (lo único que importaba `borradorCaptura.ts`). Si algo más importaba `peticionDe`, `resolverRespuesta`, `confirmarDuplicado`, `solicitudConFecha` o `fechaRapida`, hay que migrarlo a extraer + confirmar.

---

<a id="paso-0"></a>
## 0. Paso 0 — Pregunta qué hay hecho

Pídele que te diga o te muestre:

- Rama en la que trabaja y si ya trajo lo último de `jp` (`git merge origin/jp`).
- Pantallas hechas, a medio hacer y pendientes (login, registro, vista Día, lista de tareas, formulario de tarea, horario semanal, captura rápida…).
- Cómo llama hoy a la API (`fetch` directo, un archivo de servicios, React Query/SWR…).
- Si en algún lugar usa `prioridadCalculada` como **número** (ahora es un objeto).
- Si el horario semanal ya muestra las clases (`EventoFijo`) y cómo calcula el día de la semana.
- Librería de UI (Tailwind, shadcn, otra).

Con eso completa este bloque y devuélveselo para que se lo pase a Juan Pablo:

```md
## Estado del front (lo llena la IA de la compañera)
- Rama y último merge de jp:
- Pantallas hechas:
- Pantallas a medio hacer:
- Cómo se llama a la API:
- Usos de prioridadCalculada como número (archivos):
- ¿El horario semanal filtra clases por vigencia?:
- Bloqueos o dudas para el backend:
```

---

<a id="cambios"></a>
## 1. Qué cambió desde la v1

| Novedad | Qué significa para el front |
|---|---|
| **`POST /api/ia/extraer`** | Un texto ahora puede traer **varias** actividades (tareas, eventos, clases). Devuelve un **borrador** enriquecido. **No guarda nada.** |
| **`POST /api/ia/confirmar`** | Guarda el borrador que el usuario revisó, en una transacción. Crea materias nuevas, clases y tareas. |
| **`GET/POST /api/periodos`** | El semestre del usuario. Las clases duran hasta el fin del semestre. |
| **`Tarea.horaDefinida`** | `false` = "hora por definir". Va en una franja **"Sin hora"** del día. |
| **Tabla `Evento`** | Eventos de **una sola vez** (reunión, charla), con `inicio` y `fin`. Distinto de `EventoFijo` (clases semanales). |
| **`EventoFijo.vigenteDesde / vigenteHasta`** | Una clase solo se muestra dentro de su vigencia (el semestre). |
| **`Materia.codigo`** | Código de la materia, normalizado (ej. `"sis311"`). |
| **Duplicados en clases y eventos** | Confirmar ya no duplica clases ni eventos que existen. |
| **`GET /api/agenda`** | Todo lo de un rango de fechas en una llamada: clases **vigentes**, eventos de una vez y tareas. Es el endpoint del horario semanal. |
| **`PATCH` acepta `horaDefinida`** | Al elegir la hora de una tarea "por definir", se marca como definida. |
| `POST /api/ia` (v1) | **Sigue funcionando** (crea una sola tarea). La captura rápida debería migrar a extraer + confirmar. |

---

<a id="principios"></a>
## 2. Principios del sistema (no romperlos)

1. **La IA percibe, el sistema decide.** La IA solo lee el texto y lo desmenuza. Las **fechas**, la **materia**, los **duplicados** y los **choques** los decide código determinista en el backend. El front **no recalcula** nada de eso: lo muestra y deja que el usuario confirme o corrija.
2. **Nada se guarda sin que el usuario lo confirme** (excepto el atajo `POST /api/ia` con `guardar: true`).
3. **Nada bloquea el guardado.** Si falta algo opcional (hora, materia, horarios), se guarda igual y queda marcado. Lo obligatorio es: título, tipo y fecha en tareas; fecha/hora de inicio en eventos; días y horario en clases.
4. **Lo seguro se propone, lo dudoso se pregunta.** Las preguntas van **una a la vez y con botones**, nunca como un formulario abierto.
5. **Nunca enviar `usuarioId`.** El backend lo toma de la sesión (cookie de Supabase). `fetch('/api/...')` desde la misma app la manda sola.
6. **Los textos del backend se muestran tal cual** (`mensaje`, `pregunta`, `motivo`): ya vienen en español neutro y en tono de sugerencia.
7. **Días de la semana: 1 = lunes … 7 = domingo** (ISO). Si usas `Date.getDay()` (0 = domingo), convierte: `const iso = d.getDay() === 0 ? 7 : d.getDay();`
8. **Zona horaria: America/La_Paz (UTC−4, sin horario de verano).** Las fechas llegan en ISO UTC (`...Z`). Para mostrarlas usa `toLocaleString('es-BO', { timeZone: 'America/La_Paz' })`.
9. Las llamadas a `/api/ia/*` tardan **1–4 s** (llaman a la IA): siempre mostrar estado de carga y deshabilitar el botón mientras tanto.

---

<a id="entorno"></a>
## 3. Preparar el entorno

```bash
git fetch origin
git merge origin/jp
npm install          # dependencia nueva: openai (cliente de DeepSeek)
npx prisma generate  # el schema cambió (Evento, PeriodoAcademico, horaDefinida…)
```

En `.env` (Juan Pablo pasa la key por privado; **nunca** va en Git ni en el grupo):

```
DEEPSEEK_API_KEY=sk-...
IA_PROVEEDOR=deepseek
```

- **No hace falta migrar**: la base de Supabase es compartida y ya tiene todo.
- Si el merge choca en `package-lock.json`, quédate con cualquiera y vuelve a correr `npm install`.
- Con VPN encendida Supabase falla: apagarla.

---

<a id="modelo"></a>
## 4. Modelo de datos que ve el front

```ts
type TipoTarea = 'examen' | 'tarea' | 'entrega' | 'proyecto' | 'exposicion';

type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoTarea;
  fechaLimite: string;             // ISO UTC
  horaDefinida: boolean;           // NUEVO. false = "hora por definir" → franja "Sin hora"
  duracionEstMin: number | null;   // null = sin estimar
  dificultad: number | null;       // 1–5
  prioridad: 'alta' | 'media' | 'baja';          // la que marca el usuario
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'no_realizada';
  completadaEn: string | null;     // se llena solo al completar
  origen: 'manual' | 'texto' | 'foto';
  materiaId: string | null;
  materia: { id: string; nombre: string; color: string } | null;
  prioridadCalculada: PrioridadCalculada; // solo en GET /api/tareas
};

type PrioridadCalculada = {
  puntaje: number;                 // 0–100
  nivel: 'critica' | 'alta' | 'media' | 'baja' | 'vencida' | 'ninguna';
  horasNecesarias: number;
  holguraDias: number;
  horasPorDia: number;
  fechaInicioSugerida: string | null;
  sobrecargaHoras: number;         // > 0 = el trabajo no cabe en el tiempo
  mensaje: string;                 // mostrar tal cual
  desglose: {
    urgencia: number; importancia: number;
    horasBase: number; origenHoras: 'estimada' | 'por_tipo';
    factorColchon: number; horasOtrasTareas: number;
  };
};

// Clase semanal (una fila por día: "lunes y miércoles" = 2 filas)
type EventoFijo = {
  id: string;
  titulo: string;
  diaSemana: number;               // 1 = lunes … 7 = domingo
  horaInicio: string;              // "08:00"
  horaFin: string;                 // "10:00"
  ubicacion: string | null;
  materiaId: string | null;
  origen: string;                  // manual | texto | foto | google
  vigenteDesde: string | null;     // NUEVO: inicio del semestre
  vigenteHasta: string | null;     // NUEVO: fin del semestre. Fuera de este rango, NO mostrarla
};

// Evento de una sola vez (NUEVO)
type Evento = {
  id: string;
  titulo: string;
  descripcion: string | null;
  inicio: string;                  // ISO UTC
  fin: string | null;
  ubicacion: string | null;
  materiaId: string | null;
  origen: string;
};

type Periodo = { id: string; nombre: string; inicio: string; fin: string }; // NUEVO

type Materia = { id: string; nombre: string; color: string; semestre: string | null; codigo: string | null };
```

**Tarea vs. evento vs. clase** (importante para el horario):

| | Tiene | Ocupa horario | Dónde se dibuja |
|---|---|---|---|
| **Tarea** | Fecha límite | No | En su día; si `horaDefinida === false`, en la franja "Sin hora" |
| **Evento** | Inicio y fin | Sí, una vez | Bloque en su día y hora |
| **Clase (`EventoFijo`)** | Día de la semana + horas | Sí, cada semana | Bloque repetido, **solo dentro de su vigencia** |

---

<a id="endpoints"></a>
## 5. Endpoints

Todos usan la cookie de sesión. Sin sesión responden **401**.

### 5.1 `GET /api/tareas` (sin cambios)

`{ tareas: Tarea[] }` ordenadas: activas por puntaje → vencidas → cerradas.

### 5.2 `POST /api/tareas` (sin cambios relevantes)

Crear a mano. Acepta `duracionEstMin: null` y `dificultad: 1–5 | null`. Si se parece a otra tarea responde **409** con `{ tipoDuplicado, similitud, tarea, pregunta, sugerenciasDiferencia }`; para crearla igual, reenviar con `confirmarNueva: true` (y el título diferenciado en `titulo`).

### 5.3 `PATCH /api/tareas/[id]` y `DELETE` (sin cambios)

| Acción | Body |
|---|---|
| Completar | `{ "estado": "completada" }` (llena `completadaEn` sola) |
| Reabrir | `{ "estado": "pendiente" }` |
| Reprogramar | `{ "fechaLimite": "..." }` |
| Definir la hora de una tarea "por definir" | `{ "fechaLimite": "2026-10-29T18:00:00-04:00", "horaDefinida": true }` |
| No realizada | `{ "estado": "no_realizada" }` |
| Eliminar | `DELETE` (borrado suave) |

### 5.3b `GET /api/agenda?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (NUEVO) — el horario

Todo lo del usuario en ese rango (ambos días incluidos, en su zona horaria). Rango máximo: **62 días**.

```json
{
  "desde": "2026-10-26T04:00:00.000Z", "hasta": "2026-11-02T03:59:59.999Z", "zonaHoraria": "America/La_Paz",
  "clases":  [EventoFijo + materia],   // SOLO las vigentes en el rango
  "eventos": [Evento + materia],       // eventos de una vez que se cruzan con el rango
  "tareas":  [Tarea + materia]         // tareas que vencen en el rango (sin prioridadCalculada)
}
```

- Las **clases** vienen una fila por día de la semana (`diaSemana`). El front las repite en cada fecha del rango que caiga en ese día **y** esté entre `vigenteDesde` y `vigenteHasta`.
- Para la **prioridad** de las tareas sigue usándose `GET /api/tareas`.
- `400` si faltan las fechas o el rango no es de 1 a 62 días.

### 5.4 `GET /api/periodos` (NUEVO)

```json
{ "periodos": [Periodo, ...], "actual": Periodo | null }
```
`actual` = el semestre que contiene hoy. Si es `null`, el usuario **todavía no cargó su semestre**: preguntarle antes de guardar clases.

### 5.5 `POST /api/periodos` (NUEVO)

```json
{ "nombre": "II/2026", "inicio": "2026-08-03", "fin": "2026-12-11" }
```
Fechas en **`AAAA-MM-DD`** (sin hora). El backend guarda inicio a las 00:00 y fin a las 23:59, hora de La Paz.

| Código | Cuándo |
|---|---|
| 201 | `{ periodo }` creado |
| 400 | Fecha inválida, o duración < 1 semana o > 1 año |
| 409 | Se cruza con otro semestre (`{ error, periodo }`) |

UI sugerida: "¿Cuándo termina tu semestre?" con nombre (sugerido, ej. "II/2026"), fecha de inicio y de fin, y un botón **[No sé todavía]** que simplemente cierra la pregunta (las clases se guardan sin fin y se pregunta más adelante).

### 5.6 `POST /api/ia/extraer` (NUEVO) — el borrador

```json
{ "texto": "examen de redes 2 lunes teorico, entrega del informe de BD el 29 y tengo clases de redes 2 lunes y miércoles de 8 a 10" }
```
Texto de 1 a 2000 caracteres. **No guarda nada.**

| Código | Cuerpo |
|---|---|
| 200 | `RespuestaExtraer` (abajo) |
| 400 | `{ error }` texto vacío o muy largo |
| 500 | `{ error }` falló la IA → ofrecer cargar a mano |

```ts
type RespuestaExtraer = {
  interpretacionId: string;       // reenviarlo a /api/ia/confirmar
  items: ItemBorrador[];          // 0 a 10 ítems
  periodo: { nombre: string; inicio: string; fin: string } | null;
  advertencias: string[];         // ej. "No encontré ninguna actividad en el texto."
};

type ItemBorrador = {
  // ── Lo que leyó la IA ──
  clase: 'tarea' | 'evento' | 'evento_fijo';
  titulo: string;                 // nombre formal, editable
  tipo: TipoTarea | null;         // solo tareas
  hora: string | null;            // "HH:mm" si el texto la dijo
  horaFin: string | null;         // eventos y clases
  diasSemana: number[];           // clases: [1, 3] = lunes y miércoles
  materia: string | null;         // nombre como lo escribió el usuario (mandarlo como materiaDetectada)
  codigoMateria: string | null;
  descripcion: string | null;     // temas o detalles
  ubicacion: string | null;
  confianza: number;              // 0–1
  evidencia: string;              // fragmento del texto de donde salió (útil para mostrar "de: …")

  // ── Lo que calculó el sistema ──
  inicio: string | null;          // ISO UTC. Tarea: fecha límite. Evento: inicio. Clase: null
  fin: string | null;             // solo eventos
  horaDefinida: boolean;          // false = la hora es supuesta (08:00 examen / 23:59 entrega)
  supuestos: string[];            // "hora" | "anio_siguiente"
  opcionesFecha: { etiqueta: string; fecha: string }[] | null; // fecha ambigua → botones
  faltantes: string[];            // "fecha" | "hora" | "dias" | "periodo"
  materiaPropuesta: PropuestaMateria;
  horaPropuesta: { inicio: string; fin: string; motivo: string } | null; // examen sin hora con clase ese día
  vigencia: { desde: string; hasta: string; periodo: string } | null;   // solo clases
  duplicado: DuplicadoTarea | DuplicadoClase | null;
  choques: { titulo: string; cuando: string }[];   // eventos y clases que se cruzan
};

type PropuestaMateria =
  | { accion: 'vincular'; materiaId: string; nombre: string; seguro: boolean; alternativas: { id: string; nombre: string }[] }
  | { accion: 'crear'; nombre: string; codigo: string | null; clave: string }
  | { accion: 'preguntar_nombre'; codigo: string }
  | { accion: 'ninguna' };

type DuplicadoTarea = {             // en ítems clase "tarea"
  tipoDuplicado: 'seguro' | 'probable';
  similitud: number;
  tarea: Tarea;                     // la que ya existe
  pregunta: string;                 // mostrar tal cual
  sugerenciasDiferencia: string[];  // ej. ["Práctico", "Teórico"]
};

type DuplicadoClase = {             // en ítems clase "evento_fijo"
  tipoDuplicado: 'seguro' | 'parcial'; // parcial = solo algunos días ya existen
  diasExistentes: number[];
  pregunta: string;                 // "Ya tienes «Clases de Redes 2» los lun y mié de 08:00 a 10:00."
};
```

### 5.7 `POST /api/ia/confirmar` (NUEVO) — guardar el borrador

```ts
type BodyConfirmar = {
  interpretacionId: string;        // OBLIGATORIO desde v2.2 (idempotencia): el que devolvió extraer
  fueCorregida?: boolean;          // true si el usuario cambió algo del borrador
  items: ItemConfirmado[];         // 1 a 20; solo los que el usuario quiere guardar
};

type MateriaElegida =
  | { accion: 'vincular'; materiaId: string }
  | { accion: 'crear'; nombre: string; codigo?: string | null }
  | { accion: 'ninguna' };

type ItemConfirmado =
  | { clase: 'tarea'; titulo: string; tipo: TipoTarea; inicio: string; horaDefinida: boolean;
      descripcion?: string | null; materia: MateriaElegida; materiaDetectada?: string | null;
      confirmarNueva?: boolean }
  | { clase: 'evento'; titulo: string; inicio: string; fin?: string | null;
      ubicacion?: string | null; descripcion?: string | null; materia: MateriaElegida; materiaDetectada?: string | null }
  | { clase: 'evento_fijo'; titulo: string; diasSemana: number[]; hora: string; horaFin: string;
      ubicacion?: string | null; vigencia?: { desde: string; hasta: string } | null;
      materia: MateriaElegida; materiaDetectada?: string | null };
```

Respuesta **201**:
```json
{
  "creados": { "tareas": ["id"], "eventos": [], "clases": ["id", "id"], "materias": [{ "id": "…", "nombre": "Redes 2" }] },
  "omitidos": [{ "indice": 1, "titulo": "Informe de Base de Datos", "motivo": "Ya existe «Informe de Base de Datos»" }]
}
```
**400** con `{ error: "Ítem 2: falta la fecha" }` si algo no es válido (no se guarda nada).

**Reintento (v2.2):** el mismo `interpretacionId` otra vez → **200** con el mismo `{ creados, omitidos }` + `repetido: true`, sin crear nada. Ver [Novedades §1](#novedades).

Qué hace el backend (para que no lo dupliques en el front):
- Todo en **una transacción**: si algo falla, no se guarda nada.
- Una materia a crear se crea **una sola vez** aunque la usen varios ítems (y si ya existe con ese nombre, la reutiliza).
- Una clase de `[1, 3]` se guarda como **2 filas** `EventoFijo`, con vigencia del semestre si no mandas `vigencia`.
- **Aprende alias**: si el usuario vinculó lo que escribió ("BD") a una materia ("Base de Datos II"), la próxima vez lo reconoce solo. Por eso siempre conviene mandar `materiaDetectada`.
- **No duplica**: tareas idénticas (salvo `confirmarNueva: true`), clases iguales (mismo día, horario y materia/nombre) y eventos con el mismo nombre a menos de 1 h. Lo que omite lo devuelve en `omitidos`.

### 5.8 `POST /api/ia` — ELIMINADO en v2.2

Ya no existe. Usar extraer + confirmar. Nuevos endpoints de la v2.2: `/api/eventos-puntuales`, `PATCH`/`DELETE /api/periodos/[id]` y `POST /api/ia/revisar` → ver [Novedades](#novedades).

---

<a id="borrador"></a>
## 6. Pantalla del borrador

Flujo: el usuario escribe (o dicta) → `POST /api/ia/extraer` → se muestra una **tarjeta por ítem** → el usuario revisa → **[Confirmar todo]** → `POST /api/ia/confirmar`.

### 6.1 Maqueta

```
┌───────────────────────────────────────────────────────────┐
│ Examen Teórico de Redes 2                     examen      │
│ Lun 26 · ⏱ hora por definir                               │
│   ¿Es en horario de clase, 08:00–10:00?  [Sí] [Otra hora] │
│ Materia: + Crear «Redes 2»                     [Editar]   │
├───────────────────────────────────────────────────────────┤
│ Informe de Base de Datos                      entrega     │
│ Jue 29 · 23:59 (supuesta)                                 │
│ Materia: + Crear «Base de Datos»               [Editar]   │
├───────────────────────────────────────────────────────────┤
│ Clases de Redes 2                             clase       │
│ Lun y mié · 08:00–10:00 · hasta el 11 dic (II/2026)       │
│ Materia: + Crear «Redes 2»                     [Editar]   │
└───────────────────────────────────────────────────────────┘
                                   [Descartar] [Confirmar todo]
```

Recomendado: una **vista previa de la semana** con los ítems nuevos resaltados sobre lo que ya tiene (clases y eventos en su bloque; tareas marcadas en su día).

### 6.2 Cómo pintar cada campo

| Campo | Cómo mostrarlo |
|---|---|
| `titulo` | Editable en línea |
| `clase` / `tipo` | Etiqueta: examen, entrega, proyecto, exposición, tarea, evento, clase |
| `inicio` + `horaDefinida` | Fecha en hora de La Paz. Si `horaDefinida === false`: "⏱ hora por definir" (examen/exposición) o "23:59 (supuesta)" (entrega/tarea) |
| `opcionesFecha` | Fecha ambigua: un botón por opción (`etiqueta`, ej. [Mié 21] [Mié 28]). Sin elegir, no se puede confirmar ese ítem |
| `faltantes` incluye `"fecha"` y no hay `opcionesFecha` | "¿Para cuándo es?" con [Mañana] [Viernes] [Elegir fecha] |
| `horaPropuesta` | "¿Es en horario de clase, {inicio}–{fin}?" [Sí] [Otra hora]. Mostrar `motivo` en chico |
| `materiaPropuesta` | Ver 6.3 |
| `vigencia` (clases) | "hasta el {fin} ({periodo})" |
| `faltantes` incluye `"periodo"` | "¿Cuándo termina tu semestre?" → `POST /api/periodos` (ver 5.5). Se pregunta **una vez**, no por cada clase |
| `faltantes` incluye `"dias"` o `"hora"` (clases) | Pedir días / horario con selectores |
| `duplicado` (tarea) | Mostrar `pregunta` con [Es la misma] (quitar el ítem) · un botón por `sugerenciasDiferencia` · [Otro nombre…] · [Guardar igual] |
| `duplicado` (clase) | Aviso informativo con `pregunta`. Si `tipoDuplicado === 'seguro'`, sugerir quitar el ítem |
| `choques` | Aviso ⚠ "Se cruza con {titulo} ({cuando})". **No bloquea** (resolverlo es de una fase futura) |
| `confianza < 0.6` | Resaltar la tarjeta: "Revisa este ítem" |
| `evidencia` | Opcional, en gris: «de: "examen de redes 2 lunes teorico"» |

### 6.3 Materia propuesta

| `materiaPropuesta.accion` | Mostrar | Color sugerido |
|---|---|---|
| `vincular` y `seguro: true` | "Materia: Redes 2 ✓" | verde |
| `vincular` y `seguro: false` | "Materia: Redes 1 ⚠ ¿o {alternativas}?" con chips para elegir | amarillo |
| `crear` | "Materia: + Crear «Redes 2»" | azul |
| `preguntar_nombre` | "Encontré el código {codigo}. ¿Cómo se llama la materia?" + campo de texto | azul |
| `ninguna` | "Sin materia" | gris |

[Editar] abre un selector con **todas las materias del usuario** + "Crear nueva…". Solo ahí se escribe a mano.

**Importante:** si dos ítems tienen `accion: 'crear'` con la **misma `clave`**, son la misma materia nueva. Si el usuario la renombra en una tarjeta, aplica el cambio a todas las que comparten esa `clave`.

---

<a id="armar"></a>
## 7. De borrador a confirmación: cómo armar el body

Por cada `ItemBorrador` que el usuario **no** descartó, construir un `ItemConfirmado`:

| Campo a enviar | De dónde sale |
|---|---|
| `clase`, `tipo`, `descripcion`, `ubicacion` | Del ítem (o lo que el usuario editó) |
| `titulo` | Del ítem o editado. Si eligió una diferencia de duplicado: `"{titulo} ({opción})"` |
| `inicio` (tarea/evento) | Ver tabla de abajo |
| `fin` (evento) | `item.fin` o lo que eligió |
| `horaDefinida` (tarea) | `true` si el usuario aceptó/eligió una hora; si no, `item.horaDefinida` |
| `diasSemana`, `hora`, `horaFin` (clase) | Del ítem o editados |
| `vigencia` (clase) | `{ desde: item.vigencia.desde, hasta: item.vigencia.hasta }`, o **omitirla** (el backend usa el semestre vigente) |
| `materia` | Ver tabla de materia |
| `materiaDetectada` | **Siempre** `item.materia` (permite aprender alias) |
| `confirmarNueva` (tarea) | `true` solo si el usuario dijo "es otra" ante un duplicado |

**Cómo calcular `inicio` de una tarea:**

| Situación | `inicio` | `horaDefinida` |
|---|---|---|
| Sin cambios | `item.inicio` | `item.horaDefinida` |
| Eligió una opción de `opcionesFecha` | `opcion.fecha` | `item.horaDefinida` |
| Aceptó `horaPropuesta` [Sí] | Mismo día de `item.inicio` a `horaPropuesta.inicio` | `true` |
| Eligió otra hora | Mismo día a la hora elegida | `true` |
| Eligió fecha a mano (faltaba) | Ese día a la hora por defecto: 08:00 examen/exposición, 23:59 el resto | `false` (o `true` si también eligió hora) |

Para armar "día + hora" en La Paz (UTC−4 fijo, sin horario de verano):

```ts
/** "2026-10-26" + "08:00" → "2026-10-26T08:00:00-04:00" (el backend lo acepta tal cual) */
const enLaPaz = (dia: string, hora: string) => `${dia}T${hora}:00-04:00`;

/** Día (AAAA-MM-DD) en La Paz de un ISO que vino del backend */
const diaEnLaPaz = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date(iso)); // "2026-10-26"

// Aceptó la hora propuesta:
const inicio = enLaPaz(diaEnLaPaz(item.inicio!), item.horaPropuesta!.inicio);
```

**Cómo armar `materia`:**

| Lo que pasó en la tarjeta | `materia` |
|---|---|
| Dejó la propuesta `vincular` | `{ accion: 'vincular', materiaId: propuesta.materiaId }` |
| Eligió otra de la lista | `{ accion: 'vincular', materiaId: elegida.id }` |
| Dejó la propuesta `crear` | `{ accion: 'crear', nombre: propuesta.nombre, codigo: propuesta.codigo }` |
| `preguntar_nombre` y escribió el nombre | `{ accion: 'crear', nombre: escrito, codigo: propuesta.codigo }` |
| "Crear nueva…" a mano | `{ accion: 'crear', nombre: escrito }` |
| Sin materia | `{ accion: 'ninguna' }` |

**Después de confirmar:**
- Toast con resumen: "Se guardaron 2 tareas y 2 clases" (+ "1 ya existía" si `omitidos` no está vacío; mostrar los `motivo`).
- Volver a pedir `GET /api/tareas` (y el horario).
- `fueCorregida: true` si el usuario editó cualquier campo del borrador.

---

<a id="otras"></a>
## 8. Otras pantallas

**Lista de tareas** (`GET /api/tareas`), separada por `prioridadCalculada.nivel`:

| Sección | Niveles | Qué mostrar |
|---|---|---|
| Pendientes | `critica`, `alta`, `media`, `baja` | Color por nivel, `mensaje` bajo el título, aviso si `sobrecargaHoras > 0` |
| Por decidir | `vencida` | [Ya la hice] [Reprogramar] [No la hice] |
| Historial | `ninguna` | Completadas y no realizadas |

**Vista Día** (ya existe): se mantiene. Sugerencias:
- Franja **"Sin hora"** arriba con las tareas `horaDefinida === false` de ese día (badge ⏱).
- Ordenar las tareas por `prioridadCalculada.puntaje`.
- Para pintar el día, usar `GET /api/agenda?desde=<día>&hasta=<día>` (ya filtra clases por vigencia).

**Horario semanal**: una sola llamada a `GET /api/agenda?desde=<lunes>&hasta=<domingo>`. Clases repetidas en su día, eventos en su bloque y tareas en su día (las de `horaDefinida === false` en la franja "Sin hora").

---

<a id="pendiente"></a>
## 9. Lo que todavía NO existe (no conectar; avisar si bloquea)

| Falta | Impacto en el front | Fase |
|---|---|---|
| Foto del horario | `extraer` con imagen | 3 |
| Importar desde Google Calendar (`.ics`) | Mismo borrador, otra entrada | 3b |
| "Estimar con IA" (horas y plan por pasos) | — | 4 |
| Bloques de estudio sugeridos / resolver choques automáticamente | — | 5 |
| Choques entre un evento y una **clase** del mismo borrador al revés (clase nueva vs. evento nuevo) | `revisar` solo marca evento→clase | Menor |

Si necesitas algo de esta tabla para avanzar, usa datos de ejemplo con la misma forma y anótalo en "Bloqueos o dudas para el backend".

---

<a id="ejemplo"></a>
## 10. Ejemplo completo de punta a punta

**1. El usuario escribe:** "examen de redes 2 lunes teorico, entrega del informe de BD el 29 y tengo clases de redes 2 lunes y miércoles de 8 a 10"

**2. `POST /api/ia/extraer` → 200** (resumido):
```json
{
  "interpretacionId": "598bcdfa-…",
  "periodo": { "nombre": "II/2026", "inicio": "2026-08-03T04:00:00.000Z", "fin": "2026-12-12T03:59:00.000Z" },
  "items": [
    { "clase": "tarea", "titulo": "Examen Teórico de Redes 2", "tipo": "examen", "materia": "Redes 2",
      "inicio": "2026-10-26T12:00:00.000Z", "horaDefinida": false, "faltantes": [],
      "materiaPropuesta": { "accion": "crear", "nombre": "Redes 2", "codigo": null, "clave": "redes 2" },
      "horaPropuesta": { "inicio": "08:00", "fin": "10:00", "motivo": "Ese día tienes Clases de Redes 2" },
      "duplicado": null, "choques": [] },
    { "clase": "tarea", "titulo": "Informe de Base de Datos", "tipo": "entrega", "materia": "Base de Datos",
      "inicio": "2026-10-30T03:59:00.000Z", "horaDefinida": false, "faltantes": [],
      "materiaPropuesta": { "accion": "crear", "nombre": "Base de Datos", "codigo": null, "clave": "base datos" },
      "horaPropuesta": null, "duplicado": null, "choques": [] },
    { "clase": "evento_fijo", "titulo": "Clases de Redes 2", "materia": "Redes 2",
      "diasSemana": [1, 3], "hora": "08:00", "horaFin": "10:00", "faltantes": [],
      "materiaPropuesta": { "accion": "crear", "nombre": "Redes 2", "codigo": null, "clave": "redes 2" },
      "vigencia": { "desde": "2026-08-03T04:00:00.000Z", "hasta": "2026-12-12T03:59:00.000Z", "periodo": "II/2026" },
      "duplicado": null, "choques": [] }
  ],
  "advertencias": []
}
```

**3. El usuario acepta la hora propuesta del examen y confirma todo. `POST /api/ia/confirmar`:**
```json
{
  "interpretacionId": "598bcdfa-…",
  "fueCorregida": false,
  "items": [
    { "clase": "tarea", "titulo": "Examen Teórico de Redes 2", "tipo": "examen",
      "inicio": "2026-10-26T08:00:00-04:00", "horaDefinida": true,
      "materia": { "accion": "crear", "nombre": "Redes 2" }, "materiaDetectada": "Redes 2" },
    { "clase": "tarea", "titulo": "Informe de Base de Datos", "tipo": "entrega",
      "inicio": "2026-10-30T03:59:00.000Z", "horaDefinida": false,
      "materia": { "accion": "crear", "nombre": "Base de Datos" }, "materiaDetectada": "Base de Datos" },
    { "clase": "evento_fijo", "titulo": "Clases de Redes 2", "diasSemana": [1, 3],
      "hora": "08:00", "horaFin": "10:00",
      "materia": { "accion": "crear", "nombre": "Redes 2" }, "materiaDetectada": "Redes 2" }
  ]
}
```

**4. Respuesta 201:** 2 materias (Redes 2 **una sola vez** y Base de Datos), 2 tareas, 2 clases (lunes y miércoles), `omitidos: []`.

**5. Al día siguiente escribe** "parcial practico de redes 2 el miércoles" → extraer ahora devuelve `materiaPropuesta: { accion: 'vincular', nombre: 'Redes 2', seguro: true }` y `horaPropuesta: 08:00–10:00` **sacada del horario guardado**. Así se ve que la app "recuerda".

---

*Dudas o diferencias con el código real → anotarlas en "Bloqueos o dudas para el backend" y pasárselas a Juan Pablo.*
