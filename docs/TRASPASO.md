# Traspaso — estado del proyecto y cómo seguir

Documento para retomar el trabajo en otra herramienta o sesión. Fecha de corte: 2026-07-28.

## Qué hay construido

Punto de partida de esta sesión: el commit `3313580` (esquema, RLS, seed y los contextos
`scheduling` y `billing`). Desde ahí se han ejecutado, con subagentes, **cuatro de las seis olas**
del plan.

| Ola | Documento | Tareas | Estado |
|---|---|---|---|
| 0 · Fundaciones | `superpowers/plans/2026-07-25-ola-0-fundaciones.md` | 14 | **completa y auditada** |
| 1 · Núcleo vendible (API) | `superpowers/plans/2026-07-25-ola-1-nucleo-vendible.md` | 17 | **completa y auditada** |
| 1 · Panel web | `superpowers/plans/2026-07-26-ola-1-panel-web.md` | 13 | **completa** |
| 2 · Contenido con IA | `superpowers/plans/2026-07-26-ola-2-contenido-ia.md` | 16 | **completa** |
| 3 · Analítica y MCP | `superpowers/plans/2026-07-26-ola-3-analitica-mcp.md` | 11 | sin empezar |
| 4 · Webs y captación | `superpowers/plans/2026-07-26-ola-4-webs-captacion.md` | 10 | sin empezar |

Las casillas `- [x]` de cada plan reflejan el avance real: cada agente marcó las suyas al terminar.

### Ola 0 — Fundaciones

Infraestructura de pruebas (Vitest), pruebas del dominio de `scheduling`, **guardia automática de
las fronteras hexagonales** (`apps/api/src/architecture.spec.ts`), migraciones versionadas de
Drizzle, Better Auth sobre NestJS, resolución del tenant desde la sesión verificada, guardias de
autenticación y roles, multiidioma en cinco idiomas, contrato único de errores (Problem Details),
registro estructurado con `traceId` y redacción de datos personales, integración continua, imagen de
despliegue, copias de seguridad verificadas y purga de datos vencidos (RGPD).

### Ola 1 — Núcleo vendible

Contextos `people` (alumnado con minoría de edad y tutores, profesorado), `catalog` (cursos, grupos,
matrículas), `scheduling` (asistencia y cierre de clase), `classroom` (aula propia en LiveKit e
integraciones de vídeo), `billing` (facturación, comisión congelada, alta de comerciante, webhooks),
`assessment` (valoración del alumno), `notifications` (avisos por correo en el idioma del
destinatario), portal del alumno, alta de escuela autoservicio, importación CSV, RGPD operativo e
impersonación de soporte. Más una prueba de extremo a extremo contra Postgres real.

**Panel web** (`apps/web`, React + Vite): trece pantallas, sistema de diseño propio, multiidioma,
sesión con cambio de escuela, y un recorrido completo con Playwright integrado en CI.

### Ola 2 — Contenido con IA

Hecho: agregado `ContentUnit`, validación por esquema de los once tipos de ejercicio, adaptador de
Claude con salida estructurada y reintento, audio e imagen con almacenamiento real en S3, créditos
con tope duro y libro mayor, caso de uso completo de generación, intentos con corrección y firma del
profesor, nivelación adaptativa, repetición espaciada, generación de exámenes, progreso del alumno,
subida de material propio con indexado semántico (`pgvector`), vídeo en beta apagado por defecto, las
pantallas del generador de contenido y de resolución de ejercicios con su bandeja de corrección, y un
recorrido E2E de la ola en CI.

## Qué falta

### Olas 3 y 4 (21 tareas)

Sin empezar. Sus planes están escritos y el seed ya trae los datos que necesitan: 26 semanas de
histórico de NPS y CSAT, transcripciones en sus cuatro estados, tres autorizaciones MCP, un sitio
publicado con ocho páginas en dos idiomas y veinte candidatos por los siete estados del embudo.

## Lo último que se hizo

Se cerraron las dos tareas pendientes de la ola 2: vídeo generado en beta (`a6ba34e`) y recorrido
completo de la ola (`f5d6296`, `efb4904`). El E2E de la ola 2 usa API/Nest/AppModule/UoW/RLS/Postgres
reales con dobles solo para proveedores externos de IA, genera una unidad, edita y publica, resuelve
ejercicios como alumno, firma como profesor, calcula progreso, ejecuta nivelación y comprueba que con
créditos agotados no se llama al generador.

Ese recorrido encontró y corrigió un fallo real: publicar una unidad asignaba `courseId` en el
agregado y la respuesta, pero el repositorio no lo persistía en el `upsert`. Verificación al cierre:
`test:e2e` de API con 2 recorridos en verde, `typecheck` global limpio y `db:policies` en verde.

## Cómo trabajar en este repositorio

Todo el andamiaje de ejecución vive en `.superpowers/sdd/` (está en `.gitignore`, así que no viaja
en los commits pero sí en el disco):

| Fichero | Para qué |
|---|---|
| `ESTADO.md` | **El ledger.** Una línea por tarea completada, con sus commits, lo aplazado y las decisiones adjudicadas. Es la memoria del proyecto: léelo antes de nada. |
| `CONTEXTO.md` | Contexto del proyecto y restricciones globales, para pasárselo a cualquier agente |
| `OLA-1.md`, `OLA-1-WEB.md`, `OLA-2.md` | Reglas vinculantes de cada ola, con cómo verificar e informar |
| `brief.sh` | Extrae una tarea de un plan a un fichero: `./brief.sh <plan.md> <n>` |
| `<plan>/tarea-N-informe.md` | Informe de cada tarea: qué se hizo, evidencia real, decisiones y dudas |

El método que ha funcionado: **un agente por tarea**, con el brief extraído como fichero (nunca el
plan entero), reglas de la ola en un fichero aparte, verificación obligatoria contra Postgres real
—y contra un navegador real en el panel—, y auditoría consolidada al cierre de cada ola. Los agentes
de contextos distintos pueden ir en paralelo si commitean con `git add` de rutas explícitas.

### Comandos

```bash
npm run db:reset      # esquema + políticas RLS + seed
npm run db:policies   # falla si alguna tabla queda sin proteger
npm run typecheck     # tipos en todo el monorepo
npm run test          # todas las baterías
npm run test:e2e      # extremo a extremo de la API contra Postgres
npm run api:dev       # API en http://localhost:3000/api/v1
```

Postgres 17 corre en Docker (`langopia-pg`) en el **puerto 55432**; `.env` ya apunta ahí.

> Levantar varias instancias de `nest start --watch` a la vez se tumban entre ellas (borran
> `dist`). Para trabajar en paralelo: `npx tsc -p apps/api/tsconfig.json --outDir /tmp/api-x` y
> arrancar desde ahí con un puerto propio.

## Deuda conocida y avisos

Lo importante que quedó anotado durante la ejecución. El detalle completo, con su razón, está en
`.superpowers/sdd/ESTADO.md`.

**Pendiente de credenciales** (todo falla limpio sin ellas y está verificado con dobles):

- `ANTHROPIC_API_KEY` — no se ha podido medir la tasa de acierto real de la generación ni calibrar
  coste y `max_tokens` contra el proveedor. Hay una prueba de integración escrita que se activa sola
  en cuanto exista la clave.
- `STRIPE_SECRET_KEY` — nunca se ha ejercitado un cobro o una devolución completándose de verdad.
- Credenciales de TTS, imagen y almacenamiento de objetos.
- No hay proyecto de Railway ni remoto de GitHub: el despliegue y la integración continua están
  escritos y verificados en local, pero no ejecutados en la nube.

**Deuda técnica anotada:**

- Nadie rellena `users.auth_user_id` fuera del seed. Debe colgar del alta por invitación; hacerlo en
  el primer inicio de sesión buscando por correo reabriría un robo de membresía ya corregido.
- No hay manejador de `charge.refund.failed`: una devolución rechazada por el proveedor no libera su
  reserva. Reservar de más es el lado seguro, pero conviene cerrarlo.
- `ErasePersonHandler` (`iam`) no captura el error de `storage.delete()`: con el almacén real mal
  configurado, el borrado RGPD entero revierte en vez de fallar solo esa parte.
- El panel no redirige por rol tras iniciar sesión, y faltan enlaces de navegación a `/profesores` y
  `/cursos`.
- `MediaGeneratorPort` existe pero no está enganchado al caso de uso de generación.
- El Chrome de este entorno no trae datos ICU para `gl-ES`: el formateo en gallego cae a un patrón
  genérico **solo en ese navegador** (en Node es correcto).

## Lo que no hay que tocar sin pensarlo dos veces

Tres cosas se han auditado a fondo, con ataques reproducidos y rechazados, y sostienen la promesa
central del producto:

1. **El aislamiento entre escuelas.** Lo garantiza Postgres con RLS, no el código de aplicación.
   Ninguna consulta puede salir de `uow.execute()` o `uow.read()`, y los repositorios **no** filtran
   por `school_id`. Hay pruebas que lo comprueban de verdad.
2. **Las once funciones `SECURITY DEFINER`** de `packages/db/src/policies.sql`. Son los agujeros
   deliberados y acotados para los casos en que hay que saber qué tenant fijar antes de tenerlo
   (resolver la sesión, un webhook, una invitación, un trabajo programado). Se auditaron todas
   juntas: `search_path` terminado en `pg_temp`, permisos solo para `langopia_app`, columnas
   mínimas. No les añadas ni una columna sin volver a auditarlas.
3. **La guardia de arquitectura** (`apps/api/src/architecture.spec.ts`) y la de roles
   (`routes-declare-roles.spec.ts`). La primera detecta violaciones reales —se comprobó
   inyectándolas—; la segunda impide que una ruta nueva nazca abierta. Si tu código las hace fallar,
   arregla el código.

Y una regla de producto que atraviesa toda la ola 2: **la IA propone, el profesor firma.** Mientras
un intento no esté `teacher_validated`, la nota no cuenta para el expediente. No hay interruptor que
lo salte, y no debe haberlo.
