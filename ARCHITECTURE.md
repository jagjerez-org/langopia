# Arquitectura

Hexagonal + DDD + CQRS sobre NestJS. Este documento explica dónde va cada cosa
y por qué, para que los contextos que faltan se escriban igual que el que ya
existe.

## El monorepo

| Ruta | Qué es |
|---|---|
| `apps/api` | API NestJS. **Toda la lógica de negocio está aquí y solo aquí** |
| `apps/app` | Panel, aula y portal. SPA con Vite + React. Consume la API y pinta |
| `apps/sites` | Webs públicas de las escuelas. Astro con SSR multidominio (ola 4) |
| `packages/db` | Esquema, políticas de aislamiento y seed |
| `packages/contracts` | Tipos de la API, compartidos entre backend y frontend |

**Ninguna regla de negocio vive en un frontend.** Si el panel decide si una
cancelación genera devolución, hay dos verdades y una acabará equivocándose.
Esa decisión llega en la respuesta de la API.

## Las tres capas

```
contexts/<contexto>/
├── domain/            TypeScript puro. Cero imports de NestJS, Drizzle o HTTP.
│   ├── model/         Agregados y objetos de valor. Aquí viven las reglas.
│   ├── events/        Hechos pasados que otros contextos pueden escuchar.
│   ├── ports/         Interfaces que el dominio NECESITA. Las define él.
│   └── errors/        Errores con `code` y `kind`. No saben qué es un 404.
├── application/       Casos de uso. Depende de CQRS y del dominio.
│   ├── commands/      Un directorio por comando: comando + manejador.
│   ├── queries/       Lado de lectura. No toca agregados.
│   ├── event-handlers/ Reacciones a eventos de otros contextos.
│   └── ports/         Puertos que solo interesan a la lectura.
└── infrastructure/    Todo lo que enchufa con el mundo.
    ├── persistence/   Repositorios Drizzle, mapeadores, modelos de lectura.
    ├── http/          Controladores y DTOs. Adaptadores de ENTRADA.
    ├── acl/           Capa anticorrupción hacia OTROS contextos.
    └── external/      Stripe, LiveKit, modelos de IA, proveedores de vídeo.
```

La regla que lo gobierna todo: **las dependencias apuntan hacia dentro**. La
infraestructura conoce el dominio; el dominio no sabe que la infraestructura
existe.

Comprobación rápida de que no se ha roto:

```bash
grep -rE "from \"(@nestjs|drizzle-orm|express|@langopia/db)" apps/api/src/contexts/*/domain/
# Sin resultados = el dominio sigue limpio.
```

## Dónde va cada regla

| Tipo de regla | Dónde vive | Ejemplo real |
|---|---|---|
| Un valor no puede existir así | Objeto de valor | Una clase no dura 8 horas → `TimeSlot` |
| Depende del estado del agregado | Método del agregado | No se cancela dos veces → `ClassSession.cancel()` |
| Es una política del negocio | Servicio de dominio | Devolución según antelación → `CancellationPolicy` |
| Necesita consultar otras filas | Manejador del comando | Solape de horario del profesor |
| Es sobre la forma del dato | DTO | `startsAt` es una fecha ISO |
| Es sobre presentación | Manejador de la consulta | Pintar «sobrecargado» a partir del ratio |

El criterio para la cuarta fila: **un agregado nunca consulta la base de
datos**. Si una regla necesita saber qué más hay, la comprueba el manejador,
que sí tiene puertos, y el agregado recibe el resultado.

## Comunicación entre contextos

Dos vías, y elegir mal acopla el sistema.

**Evento** — cuando algo ya pasó y a otros les interesa. El emisor no sabe
quién escucha y el oyente no puede impedirlo.

```
Scheduling: ClassSessionCanceled { refundDue: true }
                    ↓  bus
Billing: OnClassSessionCanceled → abre la nota de abono
```

Scheduling no conoce facturas. Billing no decide si toca devolver: eso lo
resolvió la política de cancelación y viaja ya calculado en el evento. Lo
único que se importa del otro contexto es **la clase del evento**, que es su
contrato público — nunca su agregado ni su repositorio.

**Puerto + capa anticorrupción** — cuando hace falta preguntar algo *ahora* y
la respuesta cambia la decisión.

```
Scheduling declara:  TeacherAvailabilityPort   (en su domain/ports/)
Scheduling implementa: PeopleTeacherAvailabilityAdapter (en su infrastructure/acl/)
```

El puerto está escrito en el lenguaje de Scheduling y pide solo tres datos. Si
mañana Personas es un servicio aparte, se cambia el cuerpo del adaptador por
llamadas HTTP y no se toca ni el dominio ni los manejadores.

**Lo que no se hace nunca:** `imports: [OtroContextoModule]` en un módulo de
contexto. Si aparece, la frontera se ha roto.

## Superficie pública de un contexto

Cada contexto es un módulo NestJS independiente. De puertas afuera solo existe
esto:

| Se puede importar | Quién puede hacerlo | Por qué |
|---|---|---|
| `domain/events/` | Cualquier contexto | Es el contrato de lo que ya pasó |
| `application/commands/` (la clase del comando) | Solo adaptadores de entrada | Traducir una petición en un caso de uso |
| `application/queries/` (la clase de la consulta) | Solo adaptadores de entrada | Igual, en el lado de lectura |

Todo lo demás —agregados, objetos de valor, repositorios, manejadores,
mapeadores, puertos— es interno. Que un contexto viva en el mismo proceso no
lo convierte en una biblioteca compartida.

**Los puertos no se exportan.** Un puerto lo declara el contexto que *necesita*
preguntar, escrito en su propio lenguaje, y lo implementa en su
`infrastructure/acl/`. Importar el puerto de otro contexto invierte la
dirección de la dependencia: es el mismo acoplamiento que evitas, con otro
nombre.

```
MAL:  assessment importa learning/domain/ports/content-generator.port.ts
BIEN: assessment declara assessment/domain/ports/exercise-source.port.ts
      y lo implementa en assessment/infrastructure/acl/
```

**Adaptador de entrada ≠ contexto.** HTTP, MCP y las tareas programadas
importan comandos y consultas de varios contextos porque ese es su trabajo:
convertir una petición en un caso de uso. Un contexto **no** despacha el
comando de otro — para eso están los eventos y los puertos.

## Proveedores externos

Stripe, LiveKit, Zoom, el modelo de IA y el almacenamiento son **detalles
sustituibles**. Ninguno aparece en `domain/` ni en `application/`: el dominio
declara un puerto en su propio lenguaje y la infraestructura lo implementa.

```
billing/domain/ports/payment-gateway.port.ts       ← el negocio: cobrar, devolver
billing/infrastructure/external/stripe/             ← un proveedor
billing/infrastructure/external/<otro>/             ← el siguiente, sin tocar el dominio
```

**El puerto habla de negocio, no de Stripe.** `charge()`, no
`createPaymentIntent()`. `PlatformFee`, no `application_fee_amount`. Si el
nombre de un método solo se entiende leyendo la documentación del proveedor,
el puerto está mal escrito.

**Los identificadores del proveedor no son conceptos del dominio.** Una tabla
guarda `provider` + `provider_ref`, no `stripe_payment_intent_id`. Con una
columna por proveedor, añadir el segundo significa añadir columnas y llenar de
`NULL` las del primero; con un par discriminado, los dos conviven —que es
justo lo que hace falta, porque una migración de pasarela nunca es un corte
limpio: los cobros antiguos siguen en el proveedor viejo durante meses.

**Los webhooks son entrada, no salida.** Cada proveedor tiene su controlador,
que verifica su firma y traduce su evento al **mismo comando** del dominio.
`stripe-webhook.controller.ts` y el que venga después despachan
`RecordPaymentCommand`; el dominio no sabe cuál de los dos le habló.

**Hasta dónde llega la abstracción, con honestidad:** cobrar, devolver y
consultar el estado de un cobro son iguales en todas partes y se abstraen
bien. El alta de comerciante con verificación de identidad no: cada plataforma
tiene su flujo, sus estados y sus requisitos legales. Ese puerto se declara
igualmente —para que el dominio no dependa de él—, pero cambiar de proveedor
implicará reescribir ese adaptador entero. Es un coste asumido, no un fallo de
diseño.

## Aislamiento entre escuelas

Tres capas, y ninguna sobra:

1. La API se conecta con el rol `langopia_app`, **sin `BYPASSRLS`**.
2. `UnitOfWork` abre la transacción y fija `app.school_id` con
   `set_config(..., true)` — local a la transacción, para que el pool no
   filtre el tenant entre peticiones.
3. Cada tabla con `school_id` tiene su política RLS (`packages/db/src/policies.sql`).

Por eso los repositorios **no filtran por `school_id`**: hacerlo daría la
falsa impresión de que la protección está en el código.

**`schools` es la excepción que casi cuesta cara.** Es la raíz del tenant: no
tiene columna `school_id` porque su `id` *es* el tenant, así que el bucle que
genera las políticas no la alcanzaba y se quedó sin RLS. Con el rol de la
aplicación se leían las tres escuelas con su NIF y su referencia de cobro, y
`SELECT timezone FROM schools LIMIT 1` —que Scheduling usa creyendo que RLS
filtra— devolvía la escuela equivocada. Su política compara `id` con
`app.school_id`.

Lo que lo hizo invisible fue la comprobación, no la política: `db:policies`
solo miraba tablas *con* `school_id`, así que cantaba «sin tablas
desprotegidas» sobre una tabla desprotegida. Ahora el criterio va al revés y
**toda** tabla de `public` tiene que caer en una de tres categorías declaradas
en `apply-policies.ts`:

| Categoría | Qué exige |
|---|---|
| Tiene `school_id` | RLS activada y política `tenant_isolation` |
| Raíz del tenant (`TENANT_ROOT`) | RLS activada y política sobre su `id` |
| Global declarada (`GLOBAL_TABLES`) | RLS activada, con política propia o denegación total |

Una tabla nueva que no encaje hace fallar el script con su nombre. «Global por
decisión» y «desprotegida por olvido» dejan de parecerse.

> **Todo acceso a datos va dentro de `uow.execute()` o `uow.read()`, también
> las consultas.** Fuera de ahí no hay contexto de escuela y RLS no devuelve
> nada — un resultado vacío en silencio, que parece «no hay datos» cuando en
> realidad es «no me has dicho de quién».

## El acceso a datos vive en un repositorio

**Nadie escribe SQL fuera de `infrastructure/persistence/`.** Ni un
interceptor, ni un adaptador anticorrupción, ni un manejador, ni un
controlador. Si un fichero fuera de esa carpeta importa `sql` de
`drizzle-orm`, está mal colocado.

| Quién quiere datos | Qué hace |
|---|---|
| Un manejador de comando | Pide el agregado al repositorio, dentro de `uow.execute()` |
| Un manejador de consulta | Llama al modelo de lectura, dentro de `uow.read()` |
| Un adaptador de ACL | Delega en el repositorio de su contexto. No escribe SQL |
| Un interceptor o guardia | Depende de un puerto. No toca la base de datos |

El motivo no es purismo: un `INSERT` suelto en un adaptador se ejecuta fuera
de la transacción del caso de uso. Si el alta del alumno falla después, la
membresía ya está creada y queda huérfana.

**La única excepción, y está acotada:** `DrizzleMembershipLookupRepository`
lee las membresías de una sesión verificada *antes* de que exista tenant —es
la consulta que averigua cuál fijar, así que dentro del `UnitOfWork` RLS la
dejaría vacía y nadie podría entrar—. Sigue siendo un repositorio, con ese
nombre, y no se reutiliza para nada más.

Estar fuera del `UnitOfWork` no basta: `memberships` y `users` tienen RLS con
`FORCE`, así que el rol `langopia_app` sin escuela fijada tampoco ve nada al
consultarlas directamente. Por eso la consulta vive en
`memberships_for_auth_user(text)`, una función `SECURITY DEFINER` declarada en
`packages/db/src/policies.sql` con `EXECUTE` concedido solo a `langopia_app`.
Es un agujero en RLS del tamaño exacto del problema: recibe el identificador de
una credencial de Better Auth —el de una sesión ya verificada— y devuelve las
membresías activas de la persona atada a ella por `users.auth_user_id`. No
admite ningún otro parámetro, así que no hay forma de pedirle las de otra ni de
listarlas todas, y la aplicación sigue conectándose sin `BYPASSRLS`.

Su `search_path` es `pg_catalog, public, pg_temp`, y el orden no es decorativo.
Todo rol puede crear tablas temporales, y `pg_temp` se consulta *antes* que
`public` cuando no se nombra al final. Con `SET search_path = public`, una
sesión de `langopia_app` que creara `pg_temp.memberships`, `pg_temp.schools` y
`pg_temp.users` conseguía que la función —propiedad de un superusuario—
devolviera una membresía de `owner` inventada en la escuela que quisiera. Toda
función `SECURITY DEFINER` que se escriba aquí lleva `pg_temp` el último.

**La segunda excepción, con la misma forma:** `DrizzleSchoolDirectoryRepository`
(`classroom`) lee los identificadores de todas las escuelas para la purga de
datos vencidos (RGPD, módulo 13). Ese trabajo lo dispara `@nestjs/schedule`,
fuera de toda petición HTTP: no hay sesión que resuelva un tenant, y sin
embargo tiene que recorrer todas las escuelas para no dejar vencido lo de
ninguna. Mismo problema que `memberships_for_auth_user`, mismo remedio:
`school_ids_for_system_jobs()`, `SECURITY DEFINER`, `search_path` con
`pg_temp` al último, `EXECUTE` solo para `langopia_app`, y devuelve
únicamente el `id` de cada escuela —nada de NIF ni referencia de cobro—. Con
esa lista en la mano, el trabajo fija `app.school_id` escuela por escuela y
borra a través del `UnitOfWork` de siempre; la función nunca borra ni lee
nada más que el directorio.

## Quién puede entrar, y en qué escuela

Dos condiciones antes de fijar tenant, y las dos se comprueban en
`SessionTenantGuard`:

**El correo tiene que estar verificado.** Se cierra por los dos lados:
`requireEmailVerification` en Better Auth, y una sesión con `emailVerified`
falso no fija tenant aunque exista. Dos cierres porque uno de ellos es
configuración, y la configuración se cambia sin querer.

Cuando el puente con `users` era el correo, esto era además lo único que
separaba a un desconocido de la escuela ajena: registrarse con el correo del
dueño *era* apropiarse de la escuela. Ya no —el puente es
`users.auth_user_id`—, y la verificación sigue siendo obligatoria igualmente:
es la prueba de que quien tiene la credencial es quien dice ser, y de ella
dependen la invitación por correo y el aprovisionamiento que faltan.

**El tenant se resuelve por `users.auth_user_id`, nunca por el correo.** Esa
columna, con clave foránea única contra `user.id` de Better Auth, es lo que
ata la credencial con la que alguien entra a la persona del dominio que tiene
membresías. Es un identificador opaco que nadie elige: quien se registra con un
correo que no corresponde a ninguna persona atada no obtiene ninguna membresía
y recibe «No perteneces a ninguna escuela». Y como el vínculo ya no es el
correo, el correo vuelve a ser un dato editable —antes lo congelaba un
disparador de Postgres, precisamente para tapar esto.

**La escuela tiene que estar operativa.** La regla es explícita, no un olvido:

| Estado | ¿Entra? | Por qué |
|---|---|---|
| `trial`, `active` | Sí | — |
| `past_due` | **Sí** | El impago es de la suscripción de la escuela a la plataforma. Cortar el acceso deja tirados a alumnos y profesores, que no han hecho nada, y borra el calendario de la semana. La palanca de cobro es el aviso y, al final, la cancelación |
| `canceled` | No | La escuela ya no existe para el producto; ni su dueño entra. Recuperar los datos es un procedimiento aparte, no un inicio de sesión |

Y una precisión sobre roles: el índice único de `memberships` es
`(school_id, user_id, role)`, así que **una persona puede tener varias
membresías en la misma escuela** —dueña que además da clase—. Se agrupan por
escuela y los roles se acumulan; la membresía que acaba en `app.membership_id`
se elige de forma determinista, porque viaja a la auditoría y dos peticiones
idénticas no pueden atribuirse a membresías distintas.

## Errores: una sola forma de salir

El dominio lanza `DomainError` con un `code` estable y un `kind`. **No sabe qué
es un código HTTP.** Un único filtro global (`AllExceptionsFilter`, con
`@Catch()` sin argumentos) traduce todo lo que se rompa a la misma estructura,
RFC 9457:

```jsonc
{ "type": "…/errors/teacher_overlap", "title": "…traducido…", "status": 409,
  "code": "teacher_overlap", "instance": "/api/v1/…", "traceId": "01K2Q…",
  "details": { … } }
```

`code` es el contrato: estable, en inglés, nunca traducido. `title` va en el
idioma de quien pregunta. Cambiar qué status corresponde a qué `kind` no toca
ni una regla de negocio.

**Cuatro familias y ninguna se escapa:** errores de dominio, `HttpException`
de Nest (incluida la validación), errores de Postgres reconocidos, y todo lo
demás → 500 con mensaje genérico al cliente y la excepción entera al registro.

Es un **filtro**, no un interceptor: un interceptor no ve lo que lanzan los
guardias ni el `ValidationPipe`.

## Quién traduce qué

Tres niveles, y confundirlos genera el error de creer que basta con traducir en
un sitio:

| Nivel | Dónde vive | Ejemplo |
|---|---|---|
| Interfaz | Ficheros de traducción en `apps/app/src/i18n/` | «Guardar», «Alumnado» |
| Mensajes de la API | Catálogo del backend, por `code` | «El profesor ya tiene otra clase…» |
| Datos de la escuela | Tablas `*_translations` en la base de datos | Nombre de un curso |

**El `code` es el contrato; el texto, no.** Un error viaja con `code` estable
en inglés, `params` para interpolar y `title` ya traducido.

**Traducen los dos, y no es redundancia:**

- El **backend** traduce siempre, porque tiene consumidores sin interfaz:
  correos, facturas en PDF, respuestas MCP y webhooks. Ahí no hay panel que
  traduzca nada.
- El **frontend** traduce cuando reconoce el `code`, porque puede dar contexto
  que la API no tiene —enlazar a la pantalla que resuelve el problema, agrupar
  errores de un formulario— y porque el idioma de la interfaz puede cambiar sin
  volver a pedir nada.

**La regla que los concilia:** el panel usa su catálogo si conoce el `code`; si
no lo conoce —backend desplegado antes que el panel—, muestra el `title` que ya
viene traducido. Lo que **nunca** se enseña es el `code` crudo.

Los mensajes llevan parámetros en formato ICU, no concatenación: el plural y el
género no se resuelven pegando cadenas.

```
insufficient_role: "Esta acción requiere el rol {required}."
pending_reviews: "{count, plural, one {# valoración pendiente} other {# valoraciones pendientes}}"
```

Los `params` del mensaje son los `details` del error: se declaran juntos o se
separan. **Y son valores simples** —texto, número, fecha—, nunca un array ni un
objeto: `IntlMessageFormat` no lanza con un array, devuelve un array mezclando
texto y el valor sin convertir, y el filtro lo trata como traducción fallida y
cae al mensaje en español del `super()`. El síntoma es que los cinco idiomas
devuelven castellano con el catálogo aparentemente completo. Si el panel
necesita la lista suelta, el error puede llevar las dos formas; lo que interpola
el mensaje tiene que ser la escalar.

**Tres pruebas lo sostienen**, porque esto se rompe por omisión y en silencio:
una comprueba que todo `DomainError` del código tiene entrada en **todos** los
idiomas de `SUPPORTED_LOCALES`; otra **instancia cada error de dominio y lo
traduce con sus propios `details`**, que es lo único que ve un parámetro
intraducible o un marcador que nadie rellena; la tercera, que las claves de
error del panel coinciden con los códigos del backend.

## Ningún error en silencio

Un fallo que no deja rastro es peor que un fallo: parece que no pasó nada.

- `catch {}` y `catch { /* ignorar */ }` están prohibidos. Los detecta
  `architecture.spec.ts`.
- `.catch(() => null)` también.
- Continuar tras un error es legítimo; **continuar sin registrarlo, no**. Si
  el fallo no merece una línea de log, no merece un `try`.
- El filtro de errores escribe siempre: 5xx como `error`, 4xx como `warn`.

## Registro

Pino vía `nestjs-pino`. JSON de una línea en producción, `pino-pretty` en
desarrollo. Los mismos campos en todos los eventos —`time`, `level`,
`context`, `msg`, `traceId`, `schoolId`, `membershipId`, `durationMs`—, porque
un registro sin campos comunes no se puede buscar.

El `traceId` nace en el borde y vive en `nestjs-cls` junto al tenant: la línea
del dominio, la del filtro de errores y el `traceId` que recibe el cliente son
el mismo.

**Redacción obligatoria** de `email`, `phone`, `dateOfBirth`, `password`,
`token`, `cookie`, `authorization` y `stripe*`. Hay menores en la base de
datos: un correo en un log es una brecha con la retención que tenga el
agregador.

## Nada de literales sueltos

Un valor de un conjunto cerrado —un rol, un estado, un proveedor de aula, un
tipo de consentimiento— **no se escribe a mano dos veces**. Se declara una vez
y se referencia.

```typescript
// contexts/people/domain/model/student-status.ts
export const StudentStatus = {
  Active: "active",
  Paused: "paused",   // matrícula congelada, vuelve
  Left: "left",       // baja
} as const;

export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];
```

```typescript
if (this.status === StudentStatus.Left) throw new StudentAlreadyLeftError();
```

**Objeto `as const`, no `enum` de TypeScript.** El `enum` emite código en
tiempo de ejecución, no se borra al compilar —choca con el borrado de tipos de
Node— y no es asignable al tipo que genera Drizzle sin una conversión. El
objeto congelado da el mismo símbolo único, sigue siendo un `string` en
ejecución y encaja directo con la columna.

**Dónde vive cada uno:**

| Conjunto | Dónde se declara |
|---|---|
| Concepto de un solo contexto (`StudentStatus`) | `<contexto>/domain/model/` |
| Concepto compartido por varios (`CefrLevel`, `LanguageSkill`) | `shared/domain/model/` |
| La columna de Postgres | `packages/db/src/schema/enums.ts` |

El dominio **no importa `@langopia/db`** —lo prohíbe la guardia—, así que estos
conjuntos se declaran dos veces por necesidad: una en el dominio y otra como
`pgEnum`. Que no puedan divergir lo garantiza una prueba que compara ambos y
falla si alguien añade un valor en un sitio y se olvida del otro.

Se salvan de la regla los textos que **son** datos: mensajes de error
traducidos, contenido de la escuela, descripciones de prueba. Un enum de
mensajes no aporta nada.

## Cómo añadir un contexto

1. `domain/model/` — el agregado y sus objetos de valor. Escribe las reglas
   aquí antes de pensar en tablas.
2. `domain/ports/` — lo que necesitas del exterior, en tu propio lenguaje.
3. `domain/events/` — los hechos que otros querrán oír.
4. `application/commands/` — un directorio por caso de uso.
5. `application/queries/` + `application/ports/` — el lado de lectura.
6. `infrastructure/` — repositorio, modelo de lectura, controlador, ACL.
7. `<contexto>.module.ts` — ata cada puerto con su adaptador.
8. Regístralo en `app.module.ts`.

`contexts/scheduling/` está completo y sirve de plantilla.

## Los contextos previstos

| Contexto | Módulos del plan | Estado |
|---|---|---|
| `iam` | 9, 10 — identidad, OAuth, tenants | pendiente |
| `people` | 1, 2 — alumnos, profesores, tutores, consentimientos | pendiente |
| `catalog` | 3 — cursos, grupos, matrículas | pendiente |
| `scheduling` | 3, 12 — calendario, clases, asistencia, aulas | **listo** |
| `learning` | 4 — contenido, ejercicios, generación con IA | pendiente |
| `assessment` | 5, 11 — exámenes, nivelación, valoraciones | pendiente |
| `billing` | 7 — facturas, cobros, comisión, créditos | esqueleto (solo escucha) |
| `feedback` | 2 — encuestas, NPS, reseñas | pendiente |
| `classroom` | 13 — transcripción, grabaciones | esqueleto (solo purga RGPD) |
| `sites` | 10 — constructor de webs | pendiente |

El servidor MCP (módulo 8) **no es un contexto**: es otro adaptador de entrada
sobre los mismos comandos y consultas. Vive en `apps/api/src/entrypoints/mcp/`,
fuera de `contexts/`, porque importa casos de uso de varios contextos y eso es
precisamente lo que un contexto no puede hacer. Cancelar una clase desde Claude
y desde el panel recorre exactamente el mismo camino y aplica exactamente las
mismas reglas.

## Deuda conocida

- **Falta el alta desde una invitación y el aprovisionamiento de la persona del
  dominio.** El puente entre `user` (Better Auth) y `users` (Langopia) ya no es
  el correo: es `users.auth_user_id`, con clave foránea única contra `user.id`
  (migración `0002_auth_user_id`), y `memberships_for_auth_user` resuelve por
  ahí. Lo que no existe todavía es quién **rellena** esa columna para alguien
  que no venga del seed.

  Y no se rellena en el primer inicio de sesión buscando por correo: eso sería
  volver a poner la llave debajo del felpudo —quien se registrara antes que el
  dueño de una escuela se ataría a su fila—. Tiene que hacerlo un flujo en el
  que alguien de la escuela ya haya dicho quién es esa persona: aceptar una
  invitación (`invitations`, que ya existe como tabla) ata el `user.id` recién
  creado a la fila de `users` que la invitación nombra. Hasta entonces, quien
  se registra por su cuenta recibe «No perteneces a ninguna escuela», que es el
  fallo correcto.

  El seed **sí** crea credenciales verificadas para todas sus personas y las
  ata (`packages/db/src/seed/credentials.ts`), con una contraseña común
  anunciada al final de `npm run db:seed`; `verifyCredentials` falla si alguna
  queda sin atar.
- `DomainErrorFilter` solo captura `DomainError`: todo lo demás sale con la
  forma por defecto de Nest. Su rama `status >= 500` es además código muerto,
  así que hoy **no se registra ningún error**. Lo sustituye
  `AllExceptionsFilter` en la ola 0 (tarea 8b).
- `SchoolSchedulingPolicyAdapter` devuelve 24 h fijas. Falta la columna.
- Los eventos van por un bus en memoria. Cuando un fallo al publicar deje de
  ser aceptable, sustituir `NestEventPublisher` por una cola con reintentos.
- No hay pruebas automatizadas todavía. El dominio es puro, así que se prueba
  sin base de datos ni NestJS: es el sitio por donde empezar.
