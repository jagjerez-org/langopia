# Runbook de despliegue

Procedimiento para poner la API en producción y para operarla el día
después. Este documento crece: la Tarea 11 (copias de seguridad y
monitorización) añade aquí sus propias secciones.

## Arquitectura del despliegue

- **Imagen**: `apps/api/Dockerfile`, build multi-stage (`build` compila
  `@langopia/db` y `@langopia/api`; `runtime` solo lleva `node_modules` de
  producción y los artefactos compilados).
- **Migraciones y políticas RLS**: viajan dentro de la imagen
  (`packages/db/drizzle` y `packages/db/src/policies.sql`) y se aplican en
  cada arranque, antes de aceptar tráfico, vía `npm run start:prod`
  (`apps/api/package.json`): primero `db:deploy` (migra + aplica políticas),
  luego `node dist/main.js`. Un esquema desactualizado nunca sirve peticiones.
- **Plataforma**: Railway, configurado por código en `railway.json` (raíz del
  monorepo). `deploy.startCommand` sustituye al `CMD` de la imagen por
  `npm run start:prod --workspace @langopia/api` para que las migraciones
  corran antes de levantar el proceso. `deploy.healthcheckPath` apunta a
  `/api/v1/health`.
- **Despliegue automático**: el job `desplegar` de `.github/workflows/ci.yml`
  se dispara tras el job `verificar` en verde, solo en `main`, y ejecuta
  `railway up --service api --detach` con `RAILWAY_TOKEN` como secreto del
  repositorio.

## Variables de entorno en producción

Ninguna va escrita en la imagen ni en un fichero commiteado; todas se
configuran como variables del servicio en Railway. Ver `.env.example` para
la lista completa y su explicación línea a línea. Las que importan para
producción:

| Variable | Notas en producción |
|---|---|
| `DATABASE_URL` | Rol dueño del esquema. Solo lo usan las migraciones y las políticas al arrancar; la aplicación nunca lo usa para servir peticiones. |
| `DATABASE_URL_APP` | Rol `langopia_app`, sin `BYPASSRLS`. Contraseña **distinta** de la de desarrollo (`cambiame`) — ver más abajo. |
| `BETTER_AUTH_SECRET` | Secreto propio de producción, nunca el de `.env` local. |
| `BETTER_AUTH_URL` | Debe incluir la ruta (`https://<dominio>/api/v1/auth`): Better Auth deriva de ahí su `basePath`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales OAuth de producción, si aplica. |
| `TENANT_BASE_DOMAINS` | Dominios base sobre los que se reconoce el subdominio de una escuela (por defecto `langopia.app,localhost`). El dominio que Railway genera antes de asignar uno propio (`*.up.railway.app`) **no** identifica escuela por subdominio: fuera de la lista de dominios base, la resolución cae a la cabecera `x-school-slug`. Añade aquí el dominio propio en cuanto esté asignado. |
| `PORT` | Railway la inyecta; el proceso ya la respeta (`apps/api/src/main.ts`). |

## Rol de aplicación en producción

`packages/db/src/policies.sql` crea el rol `langopia_app` con la contraseña
`cambiame` solo si el rol **no existe todavía** (`IF NOT EXISTS`); no la
reasigna en cada aplicación de políticas. Antes de que la aplicación reciba
tráfico real, contra la base de datos de producción:

```sql
ALTER ROLE langopia_app WITH PASSWORD '<secreto del gestor de secretos>';
```

Después, `DATABASE_URL_APP` en Railway debe llevar esa misma contraseña. No
hace falta tocar `policies.sql`: el `IF NOT EXISTS` ya impide que una
aplicación de políticas posterior sobrescriba la contraseña real por
`cambiame`.

## Verificar un despliegue

```bash
curl -s https://api.langopia.app/api/v1/health
```

Esperado: `{"status":"ok","at":"<ISO-8601>"}`. Comprueba que la base de
datos responde, no solo que el proceso vive: si la base cae, el balanceador
debe dejar de mandarle tráfico a esta instancia.

## Primer despliegue de una escuela nueva

1. Confirmar que `RAILWAY_TOKEN` está configurado como secreto del
   repositorio de GitHub.
2. Confirmar que las variables de entorno de la tabla de arriba están
   fijadas en el servicio de Railway.
3. Fusionar a `main`: el job `desplegar` del CI despliega automáticamente.
4. Verificar la sonda de salud (sección anterior).

---

# Copias de seguridad y monitorización (Tarea 11)

La pregunta que importa no es si el servicio se va a caer, sino si alguien
se va a enterar y si se pueden recuperar los datos de una academia. Esta
sección da el procedimiento para las dos cosas.

**Estado a fecha de escritura:** no existe todavía un proyecto de Railway
real para Langopia (`RAILWAY_TOKEN` sin fijar, ver Tarea 10) ni, por tanto,
un Postgres gestionado en producción. Lo de abajo es el procedimiento exacto
a seguir en cuanto exista ese Postgres, con los valores (diario, 30 días,
UE) ya fijados; **lo que sí está verificado de verdad, contra datos reales,
es el ciclo completo de copia → restauración → comprobación** (siguiente
sección), ejecutado contra `langopia-pg` (mismo motor, Postgres 17, que
usará producción) porque es el único Postgres con datos reales al alcance.

## Copias de seguridad automáticas

Railway no ofrece un interruptor único de "activar copias con retención de
N días" sobre su Postgres gestionado: la vía soportada es desplegar, en el
mismo proyecto, un servicio adicional que hace `pg_dump` por cron y sube el
resultado a un bucket S3 — la plantilla oficial es
[Postgres Daily Backups](https://railway.com/deploy/postgres-daily-backups).
Pasos para activarla, con los valores que pide el brief:

1. Desde el proyecto de Railway de producción, desplegar la plantilla
   `Postgres Daily Backups` como servicio nuevo en el **mismo proyecto y la
   misma región** que el servicio de Postgres — la región UE que ofrece
   Railway es `europe-west4` (Ámsterdam); fijar esa región también en el
   propio servicio de Postgres si aún no está fijada. Es lo que exige el
   RGPD: los datos personales de las academias no salen de la UE ni para la
   copia.
2. Variables del servicio de backups (ninguna en ficheros commiteados, solo
   en Railway):
   - `BACKUP_DATABASE_URL`: variable de referencia al `DATABASE_URL` interno
     del servicio de Postgres (rol dueño del esquema, no `langopia_app`: la
     copia necesita ver todo el esquema).
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: credenciales de un
     bucket S3 dedicado a backups, con permisos solo de escritura/lectura
     sobre ese bucket.
   - `AWS_S3_BUCKET`: el bucket dedicado.
   - `AWS_S3_REGION`: una región de AWS en la UE (p. ej. `eu-west-1`), para
     que la copia quede en la misma jurisdicción que el original.
   - `BACKUP_CRON_SCHEDULE=0 3 * * *`: diario a las 03:00 UTC, fuera de
     horario lectivo habitual.
3. **Retención de 30 días**: la plantilla no la controla ella misma, así que
   se fija donde sí es nativo — una regla de ciclo de vida (*lifecycle
   rule*) en el bucket S3 que expira (borra) objetos con más de 30 días.
   Así la retención no depende de que el servicio de backups se acuerde de
   limpiar: la cumple el propio almacenamiento.

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

`apps/api/src/main.ts` sustituye el logger de Nest por uno propio
(`JsonLogger`) cuando `NODE_ENV=production` (ya fijado en
`apps/api/Dockerfile`): cada línea de log es un JSON de una sola línea con
`timestamp`, `level`, `message`, `context` y `requestId`. Fuera de
producción se mantiene el logger legible de Nest, para desarrollo local.

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

Igual que las copias, no hay hoy un proveedor de observabilidad contratado
ni un proyecto de Railway en producción (Tarea 10): esta tabla fija el
umbral exacto de cada alerta y el mecanismo más simple para activarla en
cuanto exista ese proveedor. No es una promesa de que ya avisan a nadie.

| Alerta | Umbral | Por qué | Cómo se activa |
|---|---|---|---|
| Sonda de salud caída | 2 fallos seguidos | El servicio no responde | Railway ya reinicia el servicio solo (`railway.json`: `restartPolicyType: ON_FAILURE`, Tarea 10). Para que además avise a un humano: en el proyecto de Railway, Settings → Notifications, conectar un webhook (Slack/Discord/email) a los eventos "Deployment failed" / "Service crashed". |
| Errores 5xx > 1 % en 5 minutos | > 1 % en 5 min | Algo se rompió al desplegar | Railway expone métricas HTTP por servicio (tasa de error, `railway metrics` / panel de Observability). Configurar ahí una alerta sobre esa métrica, o agregarla en el proveedor de errores que se contrate (los JSON de `JsonLogger` con `level: "error"` ya llevan `context` y `requestId` listos para agrupar). |
| Latencia p95 | > 2 s en 10 minutos | La base de datos se está ahogando | Mismas métricas HTTP de Railway (tiempo de respuesta p95); misma alerta de métrica que la fila anterior. |
| Fallo de cobro en Stripe | cualquiera | Es dinero que no entra | Sin integración de Stripe todavía (`BillingModule` es un contexto vacío en esta ola). Cuando exista: cada webhook de fallo (`invoice.payment_failed`, `charge.failed`) debe registrar un `error` JSON (`context: "Billing"`) **y además** notificar directamente desde el propio manejador (Slack/email) — un log solo no basta para dinero. |
| Trabajo de purga fallido | cualquiera | Retención de datos incumplida | El trabajo de purga (Tarea 12, en curso) escribe en `audit_logs` con `actor_kind = 'system'`. Cuando falle, debe registrar también un `error` JSON antes de relanzar la excepción; ese log es lo que hay que vigilar con el mismo mecanismo que la fila de errores 5xx hasta que haya un agregador con alertas propias. |

## Cómo revertir un despliegue

El despliegue automático (job `desplegar` del CI, Tarea 10) no tiene un
paso de rollback separado: revertir es desplegar una versión anterior.

- **Más rápido (sin esperar al CI):** en el dashboard de Railway, pestaña
  "Deployments" del servicio `api`, elegir el despliegue anterior sano y
  pulsar "Redeploy". Ojo: si el despliegue roto ya aplicó una migración
  irreversible, esto vuelve el código atrás pero no la base de datos —
  comprobar antes si hace falta una migración de vuelta.
- **Con git (deja rastro en el historial):** `git revert` del commit que
  rompió `main` y empujarlo; el job `desplegar` construye y despliega esa
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
3. Inmediatamente después, actualizar `DATABASE_URL_APP` en las variables
   del servicio de Railway con esa misma contraseña — cuanto menor sea el
   hueco entre el paso 2 y este, menos peticiones fallan por credencial
   caducada.
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
