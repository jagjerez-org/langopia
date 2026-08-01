# Ola 3 — Analítica, transcripción y MCP · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** con datos de varios meses, calcular cosas que valen dinero —quién se va a dar de baja, qué profesor no valora a sus alumnos, qué material funciona— y abrir el producto a Claude y ChatGPT.

**Arquitectura:** un contexto nuevo (`feedback`), la parte de transcripción de `classroom`, y un **adaptador de entrada MCP** que no es un contexto: es otra puerta a los mismos comandos y consultas.

**Datos:** el seed trae **26 semanas de histórico** —dos trimestres completos de NPS, CSAT quincenal, valoraciones en dos periodos por alumno y pulso mensual del profesorado—, además de transcripciones en sus cuatro estados y tres autorizaciones MCP (activa, revocada y caducada). Suficiente para construir y probar toda la ola.

**Lo único que sí necesita datos reales** es *calibrar* los umbrales de riesgo de baja: los pesos de la tabla son una hipótesis razonable, y solo las bajas de verdad dirán si aciertan. Eso es un ajuste posterior de dos horas, no un requisito para empezar.

## Restricciones globales

- **Ninguna herramienta MCP salta las reglas.** Cancelar una clase desde Claude recorre el mismo camino que desde el panel: mismos comandos, mismas invariantes, mismo aislamiento.
- Los permisos de un cliente MCP son los del `membership` que lo autorizó. No hay canal privilegiado por ser una IA.
- **Si un solo participante de una clase no ha consentido, no se transcribe la clase entera.** Sin excepciones ni «solo esta vez».
- Nada de bots grabadores en Zoom, Meet o Teams: se importa su transcripción oficial. Es frágil, entra en zona gris de sus términos y te expone a que te corten el acceso.
- Toda métrica se calcula sobre datos de la escuela activa. Una consulta de analítica que se salte `uow.read()` devuelve vacío, no datos ajenos.

---

## Tarea 1: `feedback` — encuestas y respuestas

**Ficheros:**
- Crear: `apps/api/src/contexts/feedback/domain/model/survey.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/feedback/domain/model/score.vo.ts` y su `.spec.ts`

**Interfaces:**
- Produce: `Survey` con `activate()`, `respond()`, `close()`; `Score` que valida el rango según el tipo.

Reglas:

- **La escala depende del tipo y no se mezcla.** NPS va de 0 a 10; CSAT y post-clase, de 1 a 5. Promediar un NPS con un CSAT es el error que hace inútil un panel de satisfacción.
- Una persona responde **una vez** por encuesta y periodo. Un segundo envío sustituye al primero y queda registrado.
- Una encuesta post-clase solo se envía a quien **asistió**: preguntarle a quien faltó qué le pareció la clase es ruido.
- Las respuestas son **anónimas para el profesor** y nominales para la dirección. Sin eso, nadie puntúa con sinceridad.
- Una encuesta tiene **audiencia**: `student`, `teacher` o `guardian`. La de
  profesorado (`teacher_pulse`) es el otro punto de tu módulo 2 —satisfacción
  del profesor, no solo del alumno— y se envía mensualmente. Un profesor
  quemado se va, y eso cuesta más que un alumno de baja.

- [x] **Paso 1: Pruebas de `Score`** — NPS 11 se rechaza, CSAT 0 se rechaza, límites válidos
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `Score` y `Survey`**
- [x] **Paso 4: Manejador de `ClassSessionCompleted`** que envía la encuesta solo a los asistentes
- [x] **Paso 5: Endpoints** de respuesta, accesibles al alumno
- [x] **Paso 6: Commit** — `feat(feedback): encuestas con escala validada por tipo`

---

## Tarea 2: NPS, CSAT y reseñas

**Ficheros:**
- Crear: `apps/api/src/contexts/feedback/application/queries/get-nps/`
- Crear: `apps/api/src/contexts/feedback/application/queries/get-teacher-quality/`
- Crear: `apps/api/src/contexts/feedback/domain/model/review.aggregate.ts`

**Interfaces:**
- Produce: `GetNpsQuery`, `GetTeacherQualityQuery`, `Review` con `acknowledge()`.

Cálculos, escritos para que nadie los reinvente distinto:

- **NPS** = (promotores − detractores) / respondientes × 100. Promotor 9-10, pasivo 7-8, detractor 0-6. Se calcula **sobre quien respondió**, no sobre el total de alumnos: incluir a los que no contestaron lo diluye hasta la irrelevancia.
- **CSAT** = media de las post-clase del periodo, por profesor y por escuela.
- Una reseña negativa (≤ 2) genera un aviso a dirección y queda pendiente hasta que alguien la marca como vista. Es el módulo 2 de tu plan: reseñas sobre el material y las clases.

- [x] **Paso 1: Pruebas del cálculo de NPS** — solo promotores da 100, mitad y mitad da 0, con pasivos, con cero respuestas
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar las consultas**
- [x] **Paso 4: Implementar `Review` con acuse de recibo**
- [x] **Paso 5: Aviso a dirección ante reseña negativa**
- [x] **Paso 6: Commit** — `feat(feedback): NPS, CSAT y reseñas con seguimiento`

---

## Tarea 3: Riesgo de baja

La métrica que más dinero vale: retener a un alumno cuesta mucho menos que captarlo.

**Ficheros:**
- Crear: `apps/api/src/contexts/feedback/domain/model/churn-risk.vo.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/feedback/application/queries/get-students-at-risk/`

**Interfaces:**
- Produce: `ChurnRisk.evaluate(señales)` que devuelve `low | medium | high` con los motivos.

Señales y pesos —deliberadamente simples y explicables, porque un profesor tiene que entender por qué le sale un alumno en rojo:

| Señal | Umbral | Peso |
|---|---|---|
| Asistencia en 4 semanas | < 60 % | 3 |
| Faltas consecutivas | ≥ 3 | 3 |
| Semanas sin valoración | ≥ 3 | 2 |
| Última valoración de progreso | ≤ 2 sobre 5 | 2 |
| Reseña negativa reciente | ≤ 2 sobre 5 | 1 |
| Factura vencida | cualquiera | 2 |
| Respuesta NPS detractora | 0-6 | 1 |

`high` a partir de 5 puntos, `medium` a partir de 3. **El resultado incluye siempre los motivos**: un panel que dice «riesgo alto» sin decir por qué no sirve para actuar.

Nada de aprendizaje automático: con los datos de un piloto no hay muestra para entrenar nada, y un modelo que nadie sabe explicar es peor que una regla que todos entienden.

- [x] **Paso 1: Pruebas de la evaluación** — cada señal por separado, combinaciones que suman `medium` y `high`, alumno sano
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar `ChurnRisk`**
- [x] **Paso 4: Consulta que reúne las señales de varios contextos** vía puertos, no importando sus agregados
- [x] **Paso 5: Verificar contra el seed** — Lucía Ferrán (4 de 12 clases) debe salir `high`; Paula Vidal (12 de 12), `low`
- [x] **Paso 6: Commit** — `feat(feedback): riesgo de baja con motivos explicables`

---

## Tarea 4: Productividad docente

**Ficheros:**
- Crear: `apps/api/src/contexts/feedback/application/queries/get-teacher-productivity/`

**Interfaces:**
- Produce: métricas por profesor combinando ocupación, valoraciones pendientes, CSAT y reseñas.

Es el módulo 2 de tu plan: «calidad de la gestión del alumno».

| Métrica | De dónde |
|---|---|
| Ocupación | `scheduling` (ya existe) |
| Alumnos sin valorar | `assessment` — sin `evaluation` en 3 semanas |
| CSAT medio | `feedback` |
| Reseñas del material | `feedback` |
| Puntualidad | `scheduling` — clases empezadas tarde |
| Correcciones sin firmar | `assessment` — intentos en `ai_graded` más de 7 días |

- [x] **Paso 1: Prueba de la consulta con datos del seed**
- [x] **Paso 2: Implementarla**
- [x] **Paso 3: Verificar** — un profesor sin valoraciones debe aparecer señalado
- [x] **Paso 4: Commit** — `feat(feedback): productividad y calidad de gestión docente`

---

## Tarea 5: Transcripción en el aula propia

**Ficheros:**
- Crear: `apps/api/src/contexts/classroom/domain/model/transcript.aggregate.ts` y su `.spec.ts`
- Crear: `apps/api/src/contexts/classroom/domain/ports/transcription.port.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/livekit-transcription.adapter.ts`

**Interfaces:**
- Produce: `Transcript` con `start()`, `appendSegment()`, `complete()`, `block()`; `TranscriptionPort`.

Reglas —la primera es la que importa:

- **Antes de arrancar se comprueba el consentimiento de TODOS los participantes.** Si falta uno, el transcript nace `blocked_no_consent` con el motivo y no se graba nada. Ni audio.
- Para un menor, el consentimiento válido es el de su tutor.
- `retention_until` se calcula al completar, con `schools.data_retention_days`.
- Retirar el consentimiento **después** borra la transcripción existente: el derecho no caduca porque la clase ya pasara.
- Los segmentos guardan quién habló cuando se puede identificar; si no, etiqueta genérica.

- [x] **Paso 1: Pruebas del bloqueo por consentimiento** — todos consienten, falta uno, menor con tutor que consiente, menor cuyo tutor deniega, retirada posterior
- [x] **Paso 2: Ejecutar y comprobar que fallan**
- [x] **Paso 3: Implementar el agregado con la comprobación previa**
- [x] **Paso 4: Adaptador de LiveKit con agente de transcripción en directo**
- [x] **Paso 5: Verificar** — la clase de Hugo Peiró del seed debe quedar bloqueada
- [x] **Paso 6: Commit** — `feat(classroom): transcripción en directo con verificación de consentimiento`

---

## Tarea 6: Importar transcripciones de Zoom, Meet y Teams

**Ficheros:**
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/zoom-transcript.adapter.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/meet-transcript.adapter.ts`
- Crear: `apps/api/src/contexts/classroom/infrastructure/external/teams-transcript.adapter.ts`

Diseño:

- Un trabajo programado busca clases completadas en plataforma externa sin transcripción, y consulta su API pasadas dos horas —el tiempo que tardan en generarla.
- **La comprobación de consentimiento se aplica igual**: si falta uno, no se importa aunque la plataforma la tenga.
- Se normaliza al mismo formato de segmentos que el aula propia: quien consume una transcripción no debe saber de dónde vino.
- Si la escuela no tiene OAuth conectado con esa plataforma, se registra y se sigue. No se reintenta indefinidamente.

- [x] **Paso 1: Puerto común de importación**
- [x] **Paso 2: Adaptador de Zoom con su formato VTT**
- [x] **Paso 3: Adaptadores de Meet y Teams**
- [x] **Paso 4: Trabajo programado con reintentos acotados**
- [x] **Paso 5: Prueba de que el consentimiento se aplica también al importar**
- [x] **Paso 6: Commit** — `feat(classroom): importación de transcripciones de plataformas externas`

---

## Tarea 7: Resumen y vocabulario de la clase

**Ficheros:**
- Crear: `apps/api/src/contexts/classroom/application/event-handlers/on-transcript-ready.handler.ts`

**Interfaces:**
- Consume: `TranscriptReady` (evento del propio `classroom`).
- Declara: `TranscriptSummarizerPort` en `classroom/domain/ports/`, con su adaptador en `classroom/infrastructure/external/`. Habla directamente con el modelo; **no importa el `ContentGeneratorPort` de `learning`**, que es interno de aquel contexto.
- Produce: resumen, vocabulario detectado y tarjetas de repaso.

- [x] **Paso 1: Manejador que genera resumen y extrae vocabulario con nivel MCER**
- [x] **Paso 2: Alimentar el repaso espaciado** publicando `ClassVocabularyExtracted`, que escucha `learning` para crear las tarjetas. `classroom` no crea tarjetas ajenas
- [x] **Paso 3: Detectar errores recurrentes** y sugerirlos al profesor para la siguiente sesión
- [x] **Paso 4: Descontar créditos por el resumen**
- [x] **Paso 5: Commit** — `feat(classroom): resumen y vocabulario a partir de la transcripción`

---

## Tarea 8: Servidor MCP — OAuth 2.1

La pieza que hace posible el módulo 8, y la que justifica haber elegido Better Auth.

**Ficheros:**
- Crear: `apps/api/src/contexts/iam/infrastructure/mcp/oauth-server.ts`
- Crear: `apps/api/src/contexts/iam/infrastructure/http/mcp-oauth.controller.ts`

**Interfaces:**
- Produce: `/.well-known/oauth-authorization-server`, `/mcp/oauth/register`, `/mcp/oauth/authorize`, `/mcp/oauth/token`.

Requisitos de los clientes MCP remotos:

- **Registro dinámico de clientes**: Claude y ChatGPT se registran solos, sin que nadie cree credenciales a mano.
- PKCE obligatorio.
- Ámbitos por recurso: `students:read`, `sessions:read`, `sessions:write`, `content:write`, `analytics:read`, `billing:read`.
- El token lleva la **membresía** que autorizó, no solo el usuario: es lo que fija la escuela y los permisos.
- Revocable desde el panel, y la revocación surte efecto de inmediato.

- [x] **Paso 1: Documento de metadatos del servidor de autorización**
- [x] **Paso 2: Registro dinámico que guarda en `mcp_clients`**
- [x] **Paso 3: Flujo de autorización con PKCE y pantalla de consentimiento**
- [x] **Paso 4: Emisión de token con membresía y ámbitos**
- [ ] **Paso 5: Probar con Claude de verdad** — conectar el servidor y comprobar que aparece
- [ ] **Paso 6: Probar con ChatGPT**
- [x] **Paso 7: Commit** — `feat(iam): servidor OAuth 2.1 con registro dinámico para MCP`

---

## Tarea 9: Herramientas MCP

**Ficheros:**
- Crear: `apps/api/src/entrypoints/mcp/mcp.controller.ts`
- Crear: `apps/api/src/entrypoints/mcp/tools/`

**Interfaces:**
- Produce: endpoint MCP con las herramientas, todas sobre comandos y consultas existentes.

**No va en `contexts/`.** El MCP es un adaptador de entrada, igual que HTTP: importa comandos y consultas de varios contextos, que es justo lo que un contexto tiene prohibido hacer. Colgarlo de `contexts/mcp/` lo sometería a la regla equivocada y haría fallar la guardia de arquitectura (ola 0, tarea 3).

| Herramienta | Debajo | Ámbito |
|---|---|---|
| `buscar_alumnos` | `ListStudentsQuery` | `students:read` |
| `alumnos_en_riesgo` | `GetStudentsAtRiskQuery` | `analytics:read` |
| `agenda_semanal` | `GetWeeklyAgendaQuery` | `sessions:read` |
| `ocupacion_profesorado` | `GetTeacherOccupancyQuery` | `analytics:read` |
| `cancelar_clase` | `CancelClassSessionCommand` | `sessions:write` |
| `programar_clase` | `ScheduleClassSessionCommand` | `sessions:write` |
| `generar_unidad` | `GenerateUnitCommand` | `content:write` |
| `resumen_facturacion` | `GetBillingSummaryQuery` | `billing:read` |

Decisiones:

- El adaptador MCP **resuelve el tenant igual que el interceptor HTTP**: de la membresía del token. Un cliente MCP no elige escuela.
- Las herramientas de escritura piden confirmación explícita en su descripción: cancelar una clase por error desde un chat es fácil.
- Toda llamada queda en `audit_logs` con `actor_kind = 'mcp'` y el cliente que la hizo.
- Los errores de dominio se devuelven con su mensaje traducido: quien lee la respuesta es un modelo que se lo va a explicar a una persona.

- [x] **Paso 1: Adaptador de entrada MCP que resuelve tenant y ámbitos**
- [x] **Paso 2: Implementar las ocho herramientas**
- [x] **Paso 3: Prueba de que una herramienta sin ámbito devuelve 403**
- [x] **Paso 4: Prueba de aislamiento** — un token de la escuela A no ve datos de la B
- [ ] **Paso 5: Verificar desde Claude** — preguntar «¿qué alumnos de B1 llevan tres semanas sin valorar?» y obtener la respuesta correcta
- [x] **Paso 6: Commit** — `feat(mcp): herramientas sobre los comandos y consultas existentes`

---

## Tarea 10: Panel — analítica y transcripciones

**Ficheros:**
- Crear: `apps/web/src/features/analytics/`
- Crear: `apps/web/src/features/transcripts/`

- [x] **Paso 1: Pantalla de satisfacción** con NPS, CSAT y su evolución
- [x] **Paso 2: Pantalla de alumnos en riesgo** con los motivos visibles, no solo el color
- [x] **Paso 3: Pantalla de productividad docente**
- [x] **Paso 4: Visor de transcripción** con marcas de tiempo y búsqueda
- [x] **Paso 5: Aviso claro cuando una transcripción está bloqueada**, indicando el motivo
- [x] **Paso 6: Pantalla de gestión de clientes MCP** con revocación
- [x] **Paso 7: Commit** — `feat(web): analítica, transcripciones y clientes MCP`

---

## Tarea 11: Recorrido completo de la ola 3

- [x] **Paso 1: Escribir el recorrido**

```
 1. Completar varias clases y responder encuestas
 2. Comprobar el NPS calculado
 3. Provocar un alumno en riesgo (faltas + sin valorar) y verlo en el panel con motivos
 4. Impartir una clase en el aula propia con todos consintiendo → transcripción lista
 5. Impartir otra con un menor sin consentimiento → bloqueada, con motivo
 6. Retirar un consentimiento y comprobar que la transcripción anterior se borra
 7. Conectar Claude por MCP
 8. Preguntar por alumnos sin valorar y comprobar la respuesta
 9. Intentar leer datos de otra escuela desde el mismo token → rechazado
10. Revocar el cliente y comprobar que deja de funcionar de inmediato
```

- [x] **Paso 2: Ejecutarlo**
- [x] **Paso 3: Añadirlo al CI** (salvo los pasos que requieren Claude real)
- [x] **Paso 4: Commit** — `test: recorrido completo de la ola 3`

---

## Criterio de «listo» de la ola 3

- [ ] Desde Claude preguntas «¿qué alumnos de B1 llevan tres semanas sin valorar?» y obtienes la respuesta de tu escuela, autenticado y aislado del resto.
- [x] Una clase con un participante sin consentimiento **no** genera ni audio ni transcripción, y el motivo queda registrado.
- [x] El panel de riesgo de baja señala alumnos con motivos que un profesor entiende y puede accionar.
- [x] Revocar un cliente MCP surte efecto de inmediato.
- [x] Toda acción vía MCP queda en la auditoría con su cliente.

---

## Autorrevisión

**Cobertura.** Módulo 2 (satisfacción y productividad) → tareas 1-4; módulo 8 (MCP) → tareas 8-9; módulo 13 (transcripción) → tareas 5-7. La analítica de satisfacción del alumnado (módulo 1) → tareas 1-2.

**Placeholders.** Ninguna tarea remite a otra sin repetir lo necesario. Las fórmulas de NPS y las señales de riesgo están escritas con sus umbrales exactos, que es justo lo que se olvida y se reinventa distinto.

**Consistencia.** `Score` se define en T1 y se usa en T2. `ChurnRisk` en T3, consumido por la consulta de T3 y la pantalla de T10. `TranscriptionPort` en T5, implementado en T5 y T6. Las herramientas de T9 solo referencian comandos y consultas definidos en olas anteriores o en T2-T4.
