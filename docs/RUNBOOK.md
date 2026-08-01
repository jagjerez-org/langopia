# Runbook de despliegue

Procedimiento para poner la API en producción y para operarla el día
después. Este documento crece: la Tarea 11 (copias de seguridad y
monitorización) añade aquí sus propias secciones.

## Arquitectura del despliegue

Tres proyectos de Vercel (uno por app) más un Postgres gestionado (Neon,
desde el marketplace de Vercel). Cada proyecto tiene su *Root Directory* en
el monorepo y su propio `vercel.json` con `installCommand`/`buildCommand`
que suben a la raíz para compilar los paquetes workspace.

- **API (`langopia-api`, `apps/api`)**: función serverless única
  (`apps/api/api/index.js` → `dist/vercel.js`) que monta la app Nest una vez
  por instancia caliente y le entrega cada petición; `vercel.json` reescribe
  todo el tráfico a esa función. En serverless no hay proceso largo:
  - Las **migraciones y políticas RLS** corren en el job `desplegar` del CI
    (`npm run db:deploy` contra la base de producción) ANTES de desplegar,
    no al arrancar el servicio como en Railway.
  - Los **trabajos programados** (`@nestjs/schedule` no se dispara en una
    función congelada) los llama Vercel Cron como peticiones HTTP a
    `GET /api/v1/cron/*`, protegidas por `CronSecretGuard` con `CRON_SECRET`
    (Vercel firma sus llamadas con ese bearer). Los horarios están
    declarados en `apps/api/vercel.json` (`crons`).
- **Panel (`langopia-web`, `apps/web`)**: SPA estática de Vite. Su
  `vercel.json` reescribe `/api/*` hacia el despliegue de la API (mismo
  origen de cara al navegador: cookies sin CORS) y el resto a `index.html`.
- **Sites (`langopia-sites`, `apps/sites`)**: Astro SSR con
  `@astrojs/vercel`. Resuelve la escuela por el `Host` de cada petición y
  hace de proxy de `/api/*` hacia la API en su middleware. Cada dominio de
  escuela se asocia a este proyecto.
- **Despliegue automático**: el job `desplegar` de `.github/workflows/ci.yml`
  corre tras `verificar` en verde, solo en `main` y solo si la variable del
  repositorio `VERCEL_DEPLOY_ENABLED=true` existe. Compila cada proyecto con
  `vercel build` y lo sube con `vercel deploy --prebuilt --prod` (secretos:
  `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `PROD_DATABASE_URL`).

## Variables de entorno en producción

Ninguna va escrita en la imagen ni en un fichero commiteado; todas se
configuran como variables de entorno del proyecto en Vercel (o como
secretos del repositorio para el job `desplegar`). Ver `.env.example` para
la lista completa y su explicación línea a línea. Las que importan para
producción:

| Variable | Proyecto | Notas en producción |
|---|---|---|
| `DATABASE_URL` | secreto CI (`PROD_DATABASE_URL`) | Rol dueño del esquema. Solo lo usan las migraciones y las políticas en el job `desplegar`; la aplicación nunca lo usa para servir peticiones. |
| `DATABASE_URL_APP` | `langopia-api` | Rol `langopia_app`, sin `BYPASSRLS`. Contraseña **distinta** de la de desarrollo (`cambiame`) — ver más abajo. |
| `BETTER_AUTH_SECRET` | `langopia-api` | Secreto propio de producción, nunca el de `.env` local. |
| `BETTER_AUTH_URL` | `langopia-api` | Debe incluir la ruta (`https://<dominio-api>/api/v1/auth`): Better Auth deriva de ahí su `basePath`. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `langopia-api` | Orígenes del panel y de las webs de escuela desde los que se puede iniciar sesión, separados por comas. |
| `CRON_SECRET` | `langopia-api` | Bearer con el que Vercel Cron firma las llamadas a `/api/v1/cron/*`. Sin él, esas rutas responden 503 y los trabajos no corren. |
| `API_URL` | `langopia-sites` | URL pública de la API (`https://<dominio-api>`), para resolver escuelas y desviar `/api/*`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `langopia-api` | Credenciales OAuth de producción, si aplica. |
| `TENANT_BASE_DOMAINS` | `langopia-api` | Dominios base sobre los que se reconoce el subdominio de una escuela (por defecto `langopia.app,localhost`). El dominio `*.vercel.app` **no** identifica escuela por subdominio: fuera de la lista, la resolución cae a la cabecera `x-school-slug`. |

## Rol de aplicación en producción

`packages/db/src/policies.sql` crea el rol `langopia_app` con la contraseña
`cambiame` solo si el rol **no existe todavía** (`IF NOT EXISTS`); no la
reasigna en cada aplicación de políticas. Antes de que la aplicación reciba
tráfico real, contra la base de datos de producción:

```sql
ALTER ROLE langopia_app WITH PASSWORD '<secreto del gestor de secretos>';
```

Después, `DATABASE_URL_APP` en Vercel debe llevar esa misma contraseña. No
hace falta tocar `policies.sql`: el `IF NOT EXISTS` ya impide que una
aplicación de políticas posterior sobrescriba la contraseña real por
`cambiame`.

## Verificar un despliegue

```bash
curl -s https://langopia-api.vercel.app/api/v1/health
```

Esperado: `{"status":"ok","at":"<ISO-8601>"}`. Comprueba que la base de
datos responde, no solo que el proceso vive: si la base cae, el balanceador
debe dejar de mandarle tráfico a esta instancia.

## Primer despliegue

1. Crear los tres proyectos en Vercel (`langopia-api`, `langopia-web`,
   `langopia-sites`), cada uno con su *Root Directory* (`apps/api`,
   `apps/web`, `apps/sites`).
2. Crear el Postgres (Neon) desde Storage en el dashboard de Vercel y
   conectarlo al proyecto `langopia-api`.
3. Fijar las variables de entorno de la tabla de arriba en cada proyecto.
4. Fijar los secretos del repositorio (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `PROD_DATABASE_URL`) y la variable `VERCEL_DEPLOY_ENABLED=true`.
5. Aplicar una primera vez migraciones y políticas a mano contra la base
   (`npm run db:deploy` con `DATABASE_URL` de producción) y cambiar la
   contraseña de `langopia_app` (sección «Rol de aplicación en producción»).
6. Fusionar a `main`: el job `desplegar` del CI migra y despliega
   automáticamente.
7. Verificar la sonda de salud (sección anterior).

---

# Copias de seguridad y monitorización (Tarea 11)

La pregunta que importa no es si el servicio se va a caer, sino si alguien
se va a enterar y si se pueden recuperar los datos de una academia. Esta
sección da el procedimiento para las dos cosas.

**Estado a fecha de escritura:** el despliegue es Vercel + Neon (sección
«Arquitectura del despliegue»). Lo de abajo es el procedimiento exacto a
seguir con los valores (diario, 30 días, UE) ya fijados; **lo que sí está
verificado de verdad, contra datos reales, es el ciclo completo de copia →
restauración → comprobación** (siguiente sección), ejecutado contra
`langopia-pg` (mismo motor, Postgres 17, que usa producción) porque era el
único Postgres con datos reales al alcance cuando se verificó.

## Copias de seguridad automáticas

Neon incluye restauración a un punto en el tiempo (PITR), pero la retención
larga (30 días) y la independencia del proveedor piden una copia propia:
un **workflow programado de GitHub Actions** que hace `pg_dump` cada noche
contra la base de producción y sube el resultado a un bucket S3 dedicado.

1. Crear el bucket S3 en una región de la UE (p. ej. `eu-west-1`), con una
   regla de ciclo de vida (*lifecycle rule*) que expira objetos con más de
   30 días: la retención la cumple el almacenamiento, no el script. Es lo
   que exige el RGPD: los datos personales de las academias no salen de la
   UE ni para la copia. La base de Neon también se crea en región UE
   (Frankfurt).
2. Secretos del repositorio para el workflow (ninguno en ficheros
   commiteados): `PROD_DATABASE_URL` (rol dueño del esquema, no
   `langopia_app`: la copia necesita ver todo el esquema),
   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (con permisos solo sobre
   ese bucket) y `AWS_S3_BUCKET`.
3. Workflow `.github/workflows/backup.yml` con `schedule: "0 3 * * *"`
   (diario a las 03:00 UTC, fuera de horario lectivo habitual) que ejecuta
   `pg_dump -Fc` y sube el fichero al bucket con la fecha en el nombre.

## Restaurar una copia — probado de verdad

**Una copia que nunca se ha restaurado no es una copia: es una suposición.**
Esto es lo que hay que ejecutar para restaurar, y es exactamente lo que se
ejecutó para verificar esta tarea (ver también el informe de la Tarea 11):

```bash
# 1. Traer la copia del bucket S3 (o, como aquí, generarla de un pg_dump
#    directo mientras no hay bucket real) a un fichero local en formato
#    "custom" de pg_dump, que es el que entiende pg_restore.
pg_dump -Fc -d "$DATABASE_URL" -f copia-de-ayer.dump

# 2. Crear una base de datos TEMPORAL en el mismo servidor — nunca restaurar
#    encima de la base real. Se borra en el paso 5.
psql "$ADMIN_URL" -c "CREATE DATABASE langopia_restore_test;"

# 3. Restaurar la copia en la base temporal.
pg_restore -d "$URL_TEMPORAL" --no-owner --role=langopia copia-de-ayer.dump

# 4. Comprobar que los números cuadran con los de producción.
psql "$URL_TEMPORAL" -c "SELECT count(*) FROM schools;"
psql "$URL_TEMPORAL" -c "SELECT count(*) FROM student_profiles;"

# 5. Borrar la base temporal — no debe quedar viva.
psql "$ADMIN_URL" -c "DROP DATABASE langopia_restore_test;"
```

Ejecutado el 2026-07-27 contra `langopia-pg` (puerto 55432, datos del
seed): origen `schools=3, student_profiles=67`; base temporal restaurada
`schools=3, student_profiles=67` — coinciden. `pg_restore` en modo
detallado (`-v`) no dejó ni un error ni un aviso en 617 líneas de registro.
Repetido una segunda vez con una tercera tabla (`memberships=88`) para
mayor confianza. La base temporal se borró al terminar; `langopia-pg` no se
paró ni se tocó su base real en ningún momento.

`$ADMIN_URL` es la conexión de superusuario a la base `postgres` del mismo
servidor (p. ej. `${DATABASE_URL%/*}/postgres`); `$URL_TEMPORAL` es esa
misma conexión apuntando a `langopia_restore_test`. En producción,
`$DATABASE_URL` es el rol dueño del esquema (nunca `DATABASE_URL_APP`): es
el único con permiso para leer todas las tablas sin las restricciones de
RLS que sí aplican a `langopia_app`.

## Registro estructurado y `request-id`

`apps/api/src/bootstrap.ts` sustituye el logger interno de Nest por
`nestjs-pino` (`app.useLogger(...)`): en producción cada línea de log es un
JSON de una sola línea con `timestamp`, `level`, `message`, `context` y
`traceId`; en desarrollo, `pino-pretty`. Fuera de producción se mantiene el
formato legible, para desarrollo local.

Cada petición recibe un `request-id`: si el cliente (o el proxy delante de
la API) manda la cabecera `x-request-id`, se reutiliza; si no, se genera
uno nuevo. Se devuelve siempre en la respuesta con esa misma cabecera y
queda disponible para el logger durante toda la petición (`AsyncLocalStorage`
por petición, sin tocar la firma de ningún método).

**Para seguir un error de un usuario de extremo a extremo:** pedirle (o
mirar en las herramientas de red del navegador) el valor de la cabecera de
respuesta `x-request-id` de la petición que falló, y filtrar los registros
de producción por ese `requestId` — aparecerá en todas las líneas que esa
petición generó, en cualquier capa que use el logger de Nest.

## Alertas mínimas

Igual que las copias, esto fija el umbral exacto de cada alerta y el
mecanismo más simple para activarla; las de plataforma dependen del plan de
Vercel contratado (la observabilidad avanzada es de pago).

| Alerta | Umbral | Por qué | Cómo se activa |
|---|---|---|---|
| Sonda de salud caída | 2 fallos seguidos | La API no responde | Un monitor externo (UptimeRobot, Better Stack, cron propio) llamando a `GET /api/v1/health` cada minuto contra `langopia-api.vercel.app`; Vercel no reintenta funciones caídas — si la sonda falla es la plataforma o el despliegue, no una réplica concreta. |
| Errores 5xx > 1 % en 5 minutos | > 1 % en 5 min | Algo se rompió al desplegar | Integrar Sentry en la API (cuenta ya disponible, pendiente de añadir el SDK): los JSON de log con `level: "error"` ya llevan `context` y `requestId` listos para agrupar. Complemento sin integración: Vercel → Observability → tasa de errores de la función. |
| Latencia p95 | > 2 s en 10 minutos | La base de datos se está ahogando | Vercel → Observability (duración de la función p95) o, con el SDK de arriba, trazas de Sentry Performance. |
| Fallo de cobro en Stripe | cualquiera | Es dinero que no entra | Cada webhook de fallo (`invoice.payment_failed`) registra un `error` JSON **y además** debe notificar directamente desde el propio manejador (Slack/email) — un log solo no basta para dinero. |
| Trabajo de purga fallido | cualquiera | Retención de datos incumplida | Los trabajos corren vía Vercel Cron → ruta `/api/v1/cron/*`: un fallo es un 5xx de esa ruta (misma vigilancia que la fila de 5xx) y queda en el log de la función con su `requestId`. |
| Copia de seguridad fallida | cualquiera | Datos sin respaldo | El workflow `backup.yml` falla en rojo si `pg_dump` o la subida a S3 fallan; GitHub avisa por correo del fallo de un workflow programado. |

## Cómo revertir un despliegue

El despliegue automático (job `desplegar` del CI) no tiene un paso de
rollback separado: revertir es desplegar una versión anterior.

- **Más rápido (sin esperar al CI):** en el dashboard de Vercel, pestaña
  "Deployments" del proyecto afectado, elegir el despliegue anterior sano y
  pulsar "Redeploy" (o `vercel rollback` con el CLI). Ojo: si el despliegue
  roto ya aplicó una migración irreversible, esto vuelve el código atrás
  pero no la base de datos — comprobar antes si hace falta una migración de
  vuelta.
- **Con git (deja rastro en el historial):** `git revert` del commit que
  rompió `main` y empujarlo; el job `desplegar` migra y despliega esa
  reversión igual que cualquier otro cambio.
- En ambos casos, verificar después con la sonda de salud (sección
  «Verificar un despliegue» de arriba).

## Cómo rotar el secreto de `langopia_app`

Distinto de fijar la contraseña la primera vez (sección «Rol de aplicación
en producción», Tarea 10): esto es para rotarla ya en marcha, por ejemplo
tras una sospecha de fuga (siguiente sección).

1. Generar una contraseña nueva (`openssl rand -base64 32`, por ejemplo).
2. En la base de datos de producción, con el rol dueño del esquema:
   ```sql
   ALTER ROLE langopia_app WITH PASSWORD '<contraseña nueva>';
   ```
3. Inmediatamente después, actualizar `DATABASE_URL_APP` en las variables de
   entorno del proyecto `langopia-api` en Vercel con esa misma contraseña y
   redesplegar (las funciones serverless solo leen las variables al
   arrancar una instancia nueva) — cuanto menor sea el hueco entre el paso
   2 y este, menos peticiones fallan por credencial caducada.
4. Forzar que las conexiones ya abiertas con la contraseña vieja se
   reconecten en vez de esperar a que expiren solas:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE usename = 'langopia_app';
   ```
5. Verificar la sonda de salud: si responde `200`, el pool de conexiones ya
   usa la contraseña nueva.

## Sospecha de fuga de datos entre escuelas

El incidente que no admite improvisación: alguien ve datos de una academia
que no le corresponden. Es una posible brecha de datos personales de
menores — no se investiga en silencio ni se espera a "estar seguro".

1. **Contener primero, entender después.** Si el origen es reconocible al
   momento (un despliegue reciente, una política de RLS tocada), revertir
   ese despliegue ya (sección de arriba) antes de seguir investigando: cada
   minuto que sigue desplegado es más exposición.
2. **Rotar `langopia_app` de inmediato** (sección de arriba), aunque no se
   sepa todavía si la causa es una credencial filtrada: es barato hacerlo y
   corta en seco cualquier acceso con esa credencial si lo era.
3. **Confirmar que RLS sigue completo**: `npm run db:policies` contra la
   base de producción. Si señala alguna tabla sin política, es
   probablemente la causa — aplicar la política que falte y volver a
   desplegar antes de continuar.
4. **Acotar el alcance real**: revisar `audit_logs` en la ventana de tiempo
   sospechosa para ver qué membresías accedieron a qué `school_id` — de ahí
   sale la lista exacta de academias y de qué datos suyos pudo ver quién.
5. **RGPD**: una fuga de datos personales tiene una ventana de 72 horas
   para notificar a la autoridad de control si hay riesgo para los
   afectados. Avisar a quien lleve el cumplimiento normativo en cuanto se
   confirme el alcance del punto 4, no al cerrar el incidente.
6. **No cerrar el incidente sin una prueba que reproduzca el fallo y falle
   en rojo contra el código de antes, y en verde contra el arreglo** — es el
   mismo criterio que ya se sigue en el resto del proyecto para hallazgos de
   seguridad (Tarea 6): un ataque reproducido y rechazado, no una promesa.
7. **Postmortem por escrito**: qué pasó, qué guardián debería haberlo
   detectado y no lo hizo, y qué prueba nueva lo cubre a partir de ahora.
