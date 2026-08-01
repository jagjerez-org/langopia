# Ola 2 — Contenido con IA y evaluación · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que la escuela produzca material que antes compraba o improvisaba. Es lo que justifica el salto del plan Inicial al de Crecimiento y el único diferencial real frente a Teachworks.

**Arquitectura:** dos contextos nuevos (`learning`, `assessment`) y la parte de créditos de `billing`, con el patrón de siempre. La generación con IA entra por un **puerto**: el dominio no sabe qué modelo hay detrás.

**Stack:** el de las olas anteriores, más el SDK de Anthropic, un proveedor de TTS y uno de imagen.

**Datos:** el seed ya trae todo lo que esta ola necesita para desarrollarse —unidades en los tres estados, los once tipos de ejercicio, intentos sin firmar, libro de créditos con consumo real y un banco de nivelación de 120 ítems calibrados. **No esperes a tener un cliente para empezar.**

**Recomendación de negocio, que no es un bloqueo técnico:** valida el resultado con una escuela real antes de pulirlo. Construir se puede desde el primer día; saber si el material generado sirve, solo te lo dice un profesor usándolo.

## Restricciones globales

- **La IA propone, el profesor firma.** Mientras un intento no esté `teacher_validated`, la nota no cuenta para el expediente. No hay excepción ni interruptor que lo salte.
- **Toda salida del modelo se valida contra esquema antes de persistirse.** Un ejercicio que no valida no llega nunca al alumno. Se reintenta con el error como contexto; si falla dos veces, se marca la generación como fallida.
- **El coste se registra antes de descontar créditos.** Sin `ai_generations` con el coste real no hay margen que vigilar.
- Con `ai_hard_limit` y saldo cero, la generación se rechaza. No se genera «fiado».
- El vídeo es **beta**, apagado por defecto, y nunca bloquea la publicación de una unidad.
- Los ejercicios se generan en el idioma que se enseña (`courses.language`); solo las **instrucciones** se traducen a los idiomas de la escuela.

---

## Tarea 1: `learning` — el agregado ContentUnit

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/domain/model/content-unit.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/learning/domain/model/identifiers.ts`
- Crear: `apps/api/src/contexts/learning/domain/errors/learning.errors.ts`
- Crear: `apps/api/src/contexts/learning/domain/events/content-unit.events.ts`

**Interfaces:**
- Consume: `AggregateRoot`, `SchoolId`, `MembershipId`, `Clock`.
- Produce: `ContentUnit` con `draft()`, `addExercise()`, `submitForReview()`, `publish()`, `archive()`; eventos `ContentUnitPublished`, `ContentUnitArchived`.

Reglas a codificar:

- Una unidad **no se publica sin ejercicios**. Publicar un contenedor vacío es el error más fácil de cometer y el más visible para el alumno.
- Publicar exige revisor (`reviewedByMembershipId`) **distinto de nadie**: la firma es de una persona, no del sistema.
- Una unidad `archived` no vuelve atrás.
- Una unidad `ai_generated` nace en `in_review`, nunca en `published`. Una `uploaded` puede publicarse directamente: el material propio ya lo revisó quien lo subió.
- El nivel MCER de la unidad debe coincidir con el del curso al que se asocia, si tiene uno.

- [ ] **Paso 1: Escribir las pruebas**

```typescript
// apps/api/src/contexts/learning/domain/model/content-unit.spec.ts
import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { ContentUnit } from "./content-unit.aggregate.js";
import { ContentUnitId, ExerciseId } from "./identifiers.js";

const AHORA = new Date("2026-11-02T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const AUTOR = MembershipId.of("22222222-2222-4222-8222-222222222222");
const REVISOR = MembershipId.of("33333333-3333-4333-8333-333333333333");

function unidad(source: "ai_generated" | "uploaded" = "ai_generated") {
  return ContentUnit.draft({
    id: ContentUnitId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    code: "ES-B1-U07",
    language: "es",
    level: "B1",
    topic: "En la consulta del médico",
    skills: ["listening", "vocabulary"],
    source,
    primaryLocale: "es-ES",
    createdBy: AUTOR,
    now: AHORA,
  });
}

describe("ContentUnit", () => {
  it("una unidad generada por IA nace en revisión", () => {
    expect(unidad("ai_generated").status).toBe("in_review");
  });

  it("una unidad subida nace en borrador", () => {
    expect(unidad("uploaded").status).toBe("draft");
  });

  it("no se publica sin ejercicios", () => {
    const u = unidad();
    expect(() => u.publish({ reviewedBy: REVISOR, now: AHORA })).toThrow(/sin ejercicios/i);
  });

  it("se publica con ejercicios y revisor, y emite el evento", () => {
    const u = unidad();
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.pullDomainEvents();
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    expect(u.status).toBe("published");
    expect(u.reviewedBy!.value).toBe(REVISOR.value);
    expect(u.pullDomainEvents()[0]!.eventName).toBe("learning.content_unit.published");
  });

  it("una unidad archivada no vuelve atrás", () => {
    const u = unidad();
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    u.archive({ now: AHORA });
    expect(() => u.publish({ reviewedBy: REVISOR, now: AHORA })).toThrow(/archivada/i);
  });

  it("no se publica dos veces", () => {
    const u = unidad();
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    expect(() => u.publish({ reviewedBy: REVISOR, now: AHORA })).toThrow(/ya está publicada/i);
  });

  it("registra el coste de generación", () => {
    const u = unidad();
    u.recordGenerationCost({ costCents: 184, credits: 18 });
    expect(u.generationCostCents).toBe(184);
    expect(u.creditsSpent).toBe(18);
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que falla**

Comando: `npm run test --workspace @langopia/api -- content-unit`

- [ ] **Paso 3: Implementar identificadores y errores**
- [ ] **Paso 4: Implementar el agregado con la máquina de estados**
- [ ] **Paso 5: Ejecutar** — 7 en verde
- [ ] **Paso 6: Commit** — `feat(learning): agregado ContentUnit con revisión obligatoria`

---

## Tarea 2: Los once tipos de ejercicio, con validación por esquema

Aquí está la regla que impide que la IA meta basura en el aula.

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/domain/model/exercise.entity.ts`
- Crear: `apps/api/src/contexts/learning/domain/model/exercise-schemas.ts` y su `.spec.ts`

**Interfaces:**
- Produce: `validateExercise(type, prompt, solution)` que lanza `InvalidExerciseError` con el detalle de qué falta.

Cada tipo tiene su forma, y validarla es lo que separa un ejercicio de un JSON cualquiera:

| Tipo | `prompt` requiere | `solution` requiere |
|---|---|---|
| `cloze` | `text` con `{{n}}`, `blanks[]` con `id` | una entrada por hueco |
| `multiple_choice` | `question`, `options[]` (2–6) | `correct` dentro del rango |
| `matching` | `left[]` y `right[]` del mismo tamaño | `pairs[]` sin repetir índices |
| `ordering` | `tokens[]` (3–12) | `order[]` que es permutación de los índices |
| `minimal_pairs` | `pairs[]` con `a`, `b`, `contrast` | `sequence[]` de «a» o «b» |
| `dictation` | `audioRef`, `segments` | tantos textos como segmentos |
| `shadowing` | `audioRef`, `target`, `maxDelayMs` | — |
| `listening_comprehension` | `audioRef`, `question`, `options[]` | `correct` |
| `reading_comprehension` | `passage`, `question`, `options[]` | `correct` |
| `written_production` | `task`, `minWords` < `maxWords`, `register` | — (usa rúbrica) |
| `spoken_production` | `task`, `durationSeconds` | — (usa rúbrica) |

Reglas transversales:

- Los tipos con rúbrica (`written_production`, `spoken_production`) **exigen** `rubricId` y `requiresTeacherValidation = true`.
- Los tipos con `audioRef` exigen que la unidad tenga un recurso de audio.
- `cloze` con `openEnded: false` exige opciones; con `true`, no las admite —el hueco abierto obliga a recuperar, y ese es todo su valor pedagógico.

- [ ] **Paso 1: Escribir las pruebas** — un caso válido y al menos un inválido por tipo (22 casos)
- [ ] **Paso 2: Ejecutar y comprobar que fallan**
- [ ] **Paso 3: Implementar los esquemas con Zod y `validateExercise`**
- [ ] **Paso 4: Implementar la entidad `Exercise`**
- [ ] **Paso 5: Prueba de que un `written_production` sin rúbrica se rechaza**
- [ ] **Paso 6: Commit** — `feat(learning): validación por esquema de los once tipos de ejercicio`

---

## Tarea 3: Puerto de generación y adaptador de Claude

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/domain/ports/content-generator.port.ts`
- Crear: `apps/api/src/contexts/learning/infrastructure/external/claude-content-generator.adapter.ts`
- Crear: `apps/api/src/contexts/learning/infrastructure/external/prompts/`

**Interfaces:**
- Produce: `ContentGeneratorPort` con `generateUnit()`, `generateExercises()`, `correctWriting()`.

```typescript
// apps/api/src/contexts/learning/domain/ports/content-generator.port.ts
export type GenerationCost = {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  model: string;
};

export interface ContentGeneratorPort {
  /**
   * Genera el cuerpo de una unidad. Devuelve el contenido Y su coste: el
   * dominio necesita el segundo para descontar créditos, y pedirlo por
   * separado abriría la puerta a generar sin cobrar.
   */
  generateUnit(params: {
    language: string;
    level: string;
    topic: string;
    skills: string[];
    locale: string;
    sourceMaterial?: string;
  }): Promise<{ title: string; description: string; body: string; cost: GenerationCost }>;

  generateExercises(params: {
    unitBody: string;
    language: string;
    level: string;
    types: string[];
    count: number;
  }): Promise<{ exercises: unknown[]; cost: GenerationCost }>;

  correctWriting(params: {
    task: string;
    response: string;
    rubric: { criteria: Array<{ key: string; label: string; descriptors: string[] }> };
    language: string;
    level: string;
  }): Promise<{ score: number; feedback: string; byCriterion: Record<string, number>; cost: GenerationCost }>;
}

export const CONTENT_GENERATOR_PORT = Symbol("ContentGeneratorPort");
```

Decisiones del adaptador:

- **Salida estructurada** contra el esquema del tipo de ejercicio. No se parsea texto libre.
- **Un reintento** con el error de validación como contexto. Si falla el segundo, la generación queda `failed` y no se cobran créditos.
- El coste se calcula con la tarifa del modelo y se devuelve siempre, también en los fallos —el proveedor cobra igual.
- Los prompts viven en ficheros aparte, versionados: cambiar un prompt es un cambio de comportamiento y debe verse en el diff.

- [ ] **Paso 1: Definir el puerto**
- [ ] **Paso 2: Prueba del adaptador con un doble del SDK** — salida válida, salida inválida que se reintenta, dos fallos seguidos
- [ ] **Paso 3: Ejecutar y comprobar que falla**
- [ ] **Paso 4: Implementar el adaptador con salida estructurada y reintento**
- [ ] **Paso 5: Prueba de integración real** contra la API, generando una unidad B1 de español
- [ ] **Paso 6: Commit** — `feat(learning): generación de contenido con salida estructurada validada`

---

## Tarea 4: Audio e imagen

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/domain/ports/media-generator.port.ts`
- Crear: `apps/api/src/contexts/learning/infrastructure/external/tts.adapter.ts`
- Crear: `apps/api/src/contexts/learning/infrastructure/external/image.adapter.ts`
- Crear: `apps/api/src/contexts/learning/infrastructure/external/storage.adapter.ts`

**Interfaces:**
- Produce: `MediaGeneratorPort` con `synthesizeSpeech()`, `generateImage()`.

**Dos formatos distintos, y conviene no confundirlos:**

| Formato | Qué es | Duración | Para qué |
|---|---|---|---|
| **Pista de unidad** | Diálogo o texto corto del ejercicio | 1–5 min | Comprensión oral, dictado, pares mínimos |
| **Audiolibro** | Texto largo narrado, con capítulos | 10–60 min | Escucha extensiva fuera de clase |

El **audiolibro** es tu módulo 4 y necesita cosas que la pista corta no:

- Se sintetiza **por fragmentos** y se concatena: los proveedores de voz tienen
  límite de caracteres por petición, y un capítulo entero no cabe.
- Lleva **marcas de capítulo** con su desplazamiento en milisegundos, para que
  el alumno retome donde lo dejó.
- Guarda la **transcripción alineada**: es lo que permite leer y escuchar a la
  vez, que es la técnica que hace útil la escucha extensiva para aprender.
- La velocidad se ajusta al nivel, igual que las pistas cortas.
- Un fallo a mitad **reanuda desde el último fragmento**, no desde el principio:
  regenerar 40 minutos de audio por un corte de red es tirar dinero.

Decisiones comunes:

- La voz se elige por idioma y se guarda en la unidad: dos audios de la misma unidad deben sonar a la misma persona.
- La velocidad de habla se ajusta al nivel MCER —A1 más lento que C1—. Es lo que hace utilizable un audio para principiantes.
- Las imágenes llevan **texto alternativo generado en todos los idiomas de la escuela**: material didáctico sin alternativa textual excluye a parte del alumnado.
- Los ficheros van a S3/R2 con clave `{escuela}/units/{código}/{tipo}-{n}`.

- [x] **Paso 1: Definir el puerto**
- [x] **Paso 2: Implementar el adaptador de TTS con selección de voz y velocidad por nivel**
- [x] **Paso 2b: Implementar la síntesis de audiolibro** — fragmentación, concatenación, marcas de capítulo, transcripción alineada y reanudación tras fallo
- [x] **Paso 3: Implementar el adaptador de imagen con texto alternativo multiidioma**
- [x] **Paso 4: Implementar el almacenamiento**
- [x] **Paso 5: Verificar** — generar una pista de 4 minutos y un audiolibro de 20 con tres capítulos; comprobar duración, marcas y alineación
- [x] **Paso 6: Commit** — `feat(learning): pistas de audio, audiolibros e imágenes con alternativa textual`

---

## Tarea 5: Créditos con tope duro

Es la pieza que protege el margen. Sin ella, la escuela más entusiasta es la que menos deja.

**Ficheros:**
- Crear: `apps/api/src/contexts/billing/domain/model/credit-balance.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/billing/application/commands/spend-credits/`
- Crear: `apps/api/src/contexts/billing/application/event-handlers/on-subscription-renewed.handler.ts`

**Interfaces:**
- Produce: `CreditBalance` con `grant()`, `spend()`, `refund()`; error `InsufficientCreditsError`.

Reglas:

- El saldo **nunca queda negativo** con `ai_hard_limit`. Sin él, se permite y se avisa.
- El libro mayor es **append-only**: nunca se actualiza una fila, se añade otra con `balance_after`.
- Una generación fallida **devuelve** los créditos: el cliente no paga por lo que no recibió.
- La renovación del plan concede los créditos incluidos **sin acumular indefinidamente**: el tope es dos veces los del plan, para que no se acumule un año de créditos sin usar.

- [ ] **Paso 1: Pruebas** — conceder, gastar, saldo insuficiente con tope, sin tope, devolución, tope de acumulación
- [ ] **Paso 2: Ejecutar y comprobar que fallan**
- [ ] **Paso 3: Implementar el agregado**
- [ ] **Paso 4: Comando de gasto, que se llama **antes** de generar y confirma después**
- [ ] **Paso 5: Manejador de la renovación de suscripción**
- [ ] **Paso 6: Commit** — `feat(billing): créditos de IA con tope duro y libro mayor`

---

## Tarea 6: Caso de uso completo de generación

Une las cuatro tareas anteriores.

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/application/commands/generate-unit/`
- Crear: `apps/api/src/contexts/learning/application/commands/publish-unit/`
- Crear: `apps/api/src/contexts/learning/infrastructure/http/units.controller.ts`

**Interfaces:**
- Produce: `POST /learning/units/generate`, `POST /learning/units/:id/publish`.

El orden de las operaciones importa y hay que escribirlo:

1. Comprobar saldo de créditos (**antes** de llamar a ningún modelo).
2. Reservar los créditos estimados.
3. Generar texto → validar → generar ejercicios → validar.
4. Generar audio e imágenes en paralelo.
5. Registrar el coste real en `ai_generations`.
6. Ajustar los créditos al coste real (devolver la diferencia si se estimó de más).
7. Guardar la unidad en `in_review`.

Si algo falla entre el 3 y el 6, se devuelven los créditos reservados y la generación queda `failed` con su motivo.

- [x] **Paso 1: Prueba del caso feliz con dobles de los puertos**
- [x] **Paso 2: Prueba de que sin créditos no se llama al modelo** — el doble del generador no debe recibir ninguna llamada
- [x] **Paso 3: Prueba de que un fallo a mitad devuelve los créditos**
- [x] **Paso 4: Ejecutar y comprobar que fallan**
- [x] **Paso 5: Implementar el manejador**
- [x] **Paso 6: Endpoints**
- [x] **Paso 7: Verificar de extremo a extremo** — generar la unidad «En la consulta del médico» del diseño y comprobar que salen los seis ejercicios
- [x] **Paso 8: Commit** — `feat(learning): generación completa de unidad con control de créditos`

---

## Tarea 7: `assessment` — intentos y corrección

**Ficheros:**
- Crear: `apps/api/src/contexts/assessment/domain/model/attempt.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/assessment/domain/model/rubric.vo.ts`
- Crear: comandos `submit-attempt`, `validate-attempt`, `return-attempt`

**Interfaces:**
- Produce: `Attempt` con `submit()`, `gradeWithAi()`, `validate()`, `returnToStudent()`.

Reglas —esta es la tarea donde vive la frontera de responsabilidad:

- Un intento pasa por `submitted` → `ai_graded` → `teacher_validated`. **Solo el último cuenta.**
- El profesor puede subir o bajar la nota de la IA; queda registrado quién y cuándo.
- Devolver un intento al alumno reinicia el ciclo sin borrar el anterior: el historial de intentos es dato pedagógico.
- Los reintentos tienen tope (`maxAttempts`); superarlo es `invariant_violation`.
- Un ejercicio con `requiresTeacherValidation` **no** puede quedarse en `ai_graded` para siempre: a los 7 días genera un aviso al profesor.

- [x] **Paso 1: Pruebas de la máquina de estados** (mínimo 8 casos)
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `Attempt` y `Rubric`**
- [x] **Paso 4: Comando de envío que dispara la corrección con IA**
- [x] **Paso 5: Comando de validación del profesor**
- [x] **Paso 6: Trabajo que avisa de correcciones sin firmar a los 7 días**
- [x] **Paso 7: Commit** — `feat(assessment): intentos con corrección de IA validada por el profesor`

---

## Tarea 8: Prueba de nivelación adaptativa

**Ficheros:**
- Crear: `apps/api/src/contexts/assessment/domain/model/placement-test.aggregate.ts` y su `.spec.ts`

**Interfaces:**
- Produce: `PlacementTest` con `start()`, `answer()`, `finish()`; resultado en escala MCER con desglose por destreza.

Diseño del algoritmo, que es lo que hace útil la prueba:

- Empieza en B1, el punto medio del rango habitual.
- Tres aciertos seguidos suben de nivel; dos fallos seguidos bajan.
- Termina al estabilizarse en un nivel durante seis preguntas, o a las 30 preguntas.
- El resultado incluye desglose por destreza: un alumno puede tener B2 de lectura y A2 de expresión oral, y meterlo en un grupo B1 sin más es la causa habitual de que se dé de baja.

- [x] **Paso 1: Pruebas del algoritmo** — sube, baja, se estabiliza, corta a las 30, desglose por destreza
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar el agregado**
- [x] **Paso 4: Generación del banco de preguntas con IA por nivel y destreza**
- [x] **Paso 5: Endpoints** `POST /assessment/placement/start`, `POST /assessment/placement/:id/answer`
- [x] **Paso 6: Commit** — `feat(assessment): prueba de nivelación adaptativa con desglose por destreza`

---

## Tarea 9: Repetición espaciada

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/domain/model/srs-card.aggregate.ts` y su `.spec.ts`

**Interfaces:**
- Produce: `SrsCard` con `review(quality)`; consulta `GetDueCardsQuery`.

- [x] **Paso 1: Pruebas del algoritmo de intervalos** — acierto alarga, fallo reinicia, la facilidad no baja de 1.3
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `SrsCard` con SM-2**
- [x] **Paso 4: Manejador que crea tarjetas al fallar un ejercicio con `srsEnabled`**
- [x] **Paso 5: Consulta de tarjetas pendientes de hoy**
- [x] **Paso 6: Commit** — `feat(learning): repetición espaciada sobre lo que el alumno falló`

---

## Tarea 10: Vídeo en beta

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/infrastructure/external/video.adapter.ts`

- [x] **Paso 1: Adaptador tras el interruptor `videoBetaEnabled` de la escuela**
- [x] **Paso 2: Los recursos se marcan `isBeta: true` y se muestran con aviso**
- [x] **Paso 3: Un fallo de vídeo NO impide publicar la unidad** — prueba explícita de esto
- [x] **Paso 4: Commit** — `feat(learning): generación de vídeo en beta, desactivada por defecto`

---

## Tarea 11: Panel — generador de contenido

La pantalla del documento de diseño.

**Ficheros:**
- Crear: `apps/web/src/features/content/`

- [x] **Paso 1: Formulario de generación** — idioma, nivel, tema, destrezas, tipos de ejercicio, con **estimación de créditos antes de lanzar**
- [x] **Paso 2: Vista de progreso** de la generación, que puede tardar minutos
- [x] **Paso 3: Pantalla de revisión** con los ejercicios editables uno a uno
- [x] **Paso 4: Publicar a grupos**, con selector múltiple
- [x] **Paso 5: Aviso de saldo bajo** y bloqueo claro al llegar a cero
- [x] **Paso 6: Commit** — `feat(web): generador y revisión de contenido`

---

## Tarea 12: Panel y portal — hacer ejercicios

**Ficheros:**
- Crear: `apps/web/src/features/exercises/`

- [x] **Paso 1: Un componente por tipo de ejercicio** — once, cada uno con su interacción
- [x] **Paso 2: Reproductor de audio** con velocidad ajustable y repetición de fragmento
- [x] **Paso 3: Corrección inmediata** en los tipos automáticos; «pendiente de revisión» en los de rúbrica
- [x] **Paso 4: Repaso diario** con las tarjetas pendientes
- [x] **Paso 5: Bandeja del profesor** con las correcciones pendientes de firma
- [x] **Paso 6: Commit** — `feat(web): resolución de ejercicios y bandeja de corrección`

---

---

## Tarea 14: Subida de contenido propio

Tu módulo 4 lo pide junto a la generación, y no es lo mismo: aquí la escuela trae **su** material —el cuaderno de siempre, sus audios, sus PDF— y quiere usarlo dentro del producto. Muchas academias tienen quince años de material y no van a tirarlo.

**Ficheros:**
- Crear: `apps/api/src/contexts/learning/application/commands/upload-material/`
- Crear: `apps/api/src/contexts/learning/domain/model/uploaded-material.vo.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/learning/infrastructure/http/materials.controller.ts`
- Crear: `apps/web/src/features/content/upload/`

**Interfaces:**
- Consume: `MediaGeneratorPort` (para el análisis), almacenamiento.
- Produce: `POST /learning/materials` (multiparte), `POST /learning/units/from-material`.

Reglas:

- Formatos aceptados: PDF, DOCX, MP3, WAV, MP4, JPG, PNG. Cualquier otro se rechaza con la lista de los válidos, no con un «formato no soportado».
- Tope de 100 MB por fichero. Un vídeo de una clase entera va a `classroom`, no aquí.
- El fichero se guarda **tal cual**: la escuela debe poder descargar su original. Se le añade una versión procesada, nunca se sustituye.
- De un PDF o DOCX se **extrae el texto** y se indexa con `pgvector`, que es lo que permite luego generar ejercicios a partir de su propio material.
- Una unidad `hybrid` es exactamente eso: material propio como fuente, ejercicios generados encima. El seed ya tiene el caso.
- **La subida no consume créditos.** Solo generar consume. Cobrar por subir su propio material sería difícil de explicar.

- [x] **Paso 1: Prueba de validación** — formato válido, formato rechazado, fichero de 150 MB rechazado
- [ ] **Paso 2: Ejecutar y comprobar que falla**
- [x] **Paso 3: Implementar `UploadedMaterial` con la validación**
- [x] **Paso 4: Endpoint multiparte con el fichero a almacenamiento**
- [x] **Paso 5: Extracción de texto de PDF y DOCX, e indexado con pgvector**
- [x] **Paso 6: Comando que crea una unidad `hybrid` a partir del material subido**
- [x] **Paso 7: Pantalla de subida con arrastrar y soltar y progreso**
- [x] **Paso 8: Verificar** — subir un PDF, generar ejercicios de su contenido y comprobar que citan el material, no algo inventado
- [x] **Paso 9: Commit** — `feat(learning): subida de material propio e indexado semántico`

---

## Tarea 15: Generación de exámenes

Tu módulo 5 pide dos cosas distintas y solo una estaba planificada: la prueba de **nivelación** (tarea 8) sitúa a quien llega de nuevo; el **examen** mide lo aprendido en unas unidades concretas. Son algoritmos, contenidos y consecuencias diferentes.

**Ficheros:**
- Crear: `apps/api/src/contexts/assessment/domain/model/exam.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/assessment/application/commands/generate-exam/`
- Crear: `apps/api/src/contexts/assessment/application/commands/grade-exam/`
- Crear: `apps/web/src/features/exams/`

**Interfaces:**
- Consume: `Rubric` (T7, del propio `assessment`) y el evento `ContentUnitPublished` de `learning`.
- Declara: `ExerciseSourcePort` en `assessment/domain/ports/`, con su adaptador en `assessment/infrastructure/acl/`. Devuelve lo que el examen necesita de una unidad —nivel, destrezas y ejercicios— **sin traerse el agregado `ContentUnit`**.
- Produce: `Exam` con `generate()`, `schedule()`, `start()`, `submit()`, `grade()`, `validate()`.

`assessment` **no importa `ContentGeneratorPort` ni `ContentUnit`**: son internos de `learning`. Un puerto lo declara quien pregunta, en su propio lenguaje; importar el del vecino invierte la dependencia y ata los dos contextos.

Reglas:

- Un examen se genera **a partir de unidades ya publicadas**. Examinar de contenido que el alumno no ha visto es el motivo más habitual de reclamación.
- Reparto de destrezas configurable, con la suma al 100 %. Por defecto sigue la proporción de los exámenes oficiales: 25 % comprensión lectora, 25 % oral, 25 % expresión escrita, 25 % gramática y léxico.
- **Los ejercicios del examen no son los mismos que los de práctica**: se generan variantes del mismo contenido. Reutilizarlos mide memoria, no aprendizaje.
- Duración total y por sección, con aviso al alumno.
- La nota final **no cuenta hasta que la firma un profesor**, igual que los intentos sueltos.
- Un examen `mock_official` usa la estructura del examen real (DELE, Cambridge, Goethe) y avisa de que es un simulacro, no una certificación.
- Aprobar un examen de nivel **propone** subir de nivel MCER; no lo hace solo. La decisión es del profesor.

- [x] **Paso 1: Pruebas del agregado** — generar desde unidades publicadas, rechazar unidad en borrador, reparto que no suma 100, nota sin firmar no cuenta, aprobar propone subir de nivel
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `Exam`**
- [x] **Paso 4: Comando de generación con variantes de los ejercicios**
- [x] **Paso 5: Comando de corrección que reutiliza la corrección de intentos**
- [x] **Paso 6: Pantallas** — crear examen, hacerlo con cronómetro, corregir y firmar
- [x] **Paso 7: Verificar** — generar un examen de dos unidades B1 y comprobar que ningún ejercicio es idéntico a los de práctica
- [x] **Paso 8: Commit** — `feat(assessment): generación y corrección de exámenes desde el contenido`

---

## Tarea 16: Progreso del alumno

Tu módulo 1 pide «control de progreso: asistencia y **contenido online resuelto**». La asistencia está en la ola 1; el contenido resuelto se puede calcular desde que existen los intentos, pero nada lo agregaba.

**Ficheros:**
- Crear: `apps/api/src/contexts/assessment/application/queries/get-student-progress/`
- Crear: `apps/web/src/features/students/progress/`

**Interfaces:**
- Produce: `GetStudentProgressQuery` con porcentaje completado, nota media, desglose por destreza y evolución.

Qué devuelve, y por qué cada cosa:

| Dato | Cálculo | Para qué |
|---|---|---|
| Contenido completado | ejercicios con intento / ejercicios publicados a sus grupos | El «contenido online resuelto» que pediste |
| Nota media | media de intentos validados | Solo lo firmado cuenta |
| Desglose por destreza | media por `skill` | Un alumno puede ir bien de lectura y mal de oral |
| Tendencia | media móvil de 4 semanas | Saber si mejora, no solo dónde está |
| Racha de repaso | días seguidos con tarjetas al día | Es el indicador que más correlaciona con no darse de baja |

- [x] **Paso 1: Prueba de la consulta contra el seed** — un alumno con 3 de 6 ejercicios da 50 %
- [x] **Paso 2: Prueba de que los intentos sin firmar NO cuentan en la nota media**
- [x] **Paso 3: Ejecutar y comprobar que fallan**
- [x] **Paso 4: Implementar la consulta**
- [x] **Paso 5: Pestaña de progreso en la ficha del alumno y en su portal**
- [x] **Paso 6: Commit** — `feat(assessment): progreso del alumno con desglose por destreza`

## Tarea 13: Recorrido completo de la ola 2

- [x] **Paso 1: Escribir el recorrido**

```
 1. Generar una unidad B1 de español sobre un tema
 2. Comprobar que nace en revisión y que se descontaron créditos
 3. Editar un ejercicio y publicar a un grupo
 4. Entrar como alumno y completar los seis ejercicios
 5. Comprobar que los automáticos se corrigen solos
 6. Comprobar que la producción escrita queda pendiente de firma
 7. Entrar como profesor, ajustar la nota y firmar
 8. Comprobar que ahora sí cuenta en el expediente del alumno
 9. Hacer la prueba de nivelación y comprobar el desglose por destreza
10. Agotar los créditos y comprobar que la generación se rechaza
```

- [x] **Paso 2: Ejecutarlo contra la API real**
- [x] **Paso 3: Añadirlo al CI**
- [x] **Paso 4: Commit** — `test: recorrido completo de la ola 2`

---

## Criterio de «listo» de la ola 2

- [ ] Un profesor genera una unidad completa, la revisa, la publica a un grupo y los alumnos la completan sin salir de Langopia.
- [ ] El coste de esa unidad aparece descontado de los créditos de la escuela, y el coste real registrado en `ai_generations`.
- [ ] Ninguna nota cuenta sin firma de una persona.
- [ ] Con el saldo a cero y tope duro, no se llama a ningún modelo.
- [ ] Los once tipos de ejercicio se generan, se resuelven y se corrigen.
- [ ] La prueba de nivelación devuelve un nivel MCER con desglose por destreza.

---

## Autorrevisión

**Cobertura.** Módulo 4 → tareas 1-6, 10-11; módulo 5 → tareas 7-8; módulo 11 (valoración del alumno) → tarea 7, al quedar el historial de intentos y notas validadas. La economía de créditos del spec → tarea 5.

**Placeholders.** Las tareas 1-3 llevan código y contratos completos por ser el núcleo. De la 4 a la 13 se especifican reglas, ficheros y verificaciones; el patrón está fijado por las olas anteriores.

**Consistencia.** `ContentUnitId` y `ExerciseId` se definen en T1. `validateExercise` en T2 y se usa en T3 y T6. `ContentGeneratorPort` en T3, consumido en T6 y T7. `CreditBalance` en T5, consumido en T6. Sin discrepancias.
