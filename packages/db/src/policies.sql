-- ═══════════════════════════════════════════════════════════════════════════
--  Aislamiento entre escuelas (Row Level Security)
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Se aplica DESPUÉS de cada migración: `npm run db:policies`.
--
--  Cómo funciona:
--    1. La aplicación se conecta con el rol `langopia_app`, que NO tiene
--       BYPASSRLS. Aunque alguien escriba una consulta sin filtrar por
--       escuela, Postgres la filtra igualmente.
--    2. Al abrir la transacción, la aplicación ejecuta:
--         SELECT set_config('app.school_id', '<uuid>', true);
--       El tercer parámetro `true` la hace local a la transacción: no se
--       filtra entre peticiones que comparten conexión del pool.
--    3. Si `app.school_id` no está definido, `current_school_id()` devuelve
--       NULL y toda comparación con NULL es falsa: no se ve ninguna fila.
--       El fallo por defecto es no ver nada, nunca verlo todo.
--
--  El seed y las migraciones usan el rol dueño, que sí salta las políticas.
--  Ese rol jamás debe aparecer en la cadena de conexión de la aplicación.

-- ─── Rol de aplicación ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'langopia_app') THEN
    -- Contraseña de desarrollo/preview. En producción rotarla con
    -- ALTER ROLE langopia_app WITH PASSWORD '<secreto>'; inmediatamente.
    CREATE ROLE langopia_app LOGIN PASSWORD 'Lang0p1a!DevApp_2025_Secure';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO langopia_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO langopia_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO langopia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO langopia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO langopia_app;

-- ─── `audit_logs` es append-only de verdad ────────────────────────────────
--
-- El `GRANT` de arriba es a TODAS las tablas, y eso incluía `audit_logs`:
-- la aplicación podía reescribir o borrar sus propias filas de auditoría.
-- Un registro que quien actúa puede editar después no prueba nada — y la
-- promesa que sostiene esta tabla es que una escuela pueda ver qué hizo
-- soporte dentro de su cuenta, incluido soporte que preferiría que no se
-- viera. El esquema ya la llamaba «append-only»; hasta aquí era un comentario.
--
-- Se queda con `INSERT` (escribirla es justo su trabajo) y `SELECT` (la
-- pantalla de auditoría de la escuela). Se le quitan `UPDATE` y `DELETE`, que
-- no usa ningún repositorio: el único código que la toca es
-- `DrizzleAuditLogRepository`, y solo inserta. Purgar de verdad una fila (una
-- orden judicial, una retención vencida) es una operación del rol dueño,
-- fuera de la aplicación, y así deja de poder hacerse por descuido desde un
-- caso de uso.
--
-- `ALTER DEFAULT PRIVILEGES` no deshace esto: solo afecta a tablas creadas
-- DESPUÉS, y `audit_logs` ya existe. El `REVOKE` va después del `GRANT` a
-- propósito, y este fichero es idempotente: reejecutarlo vuelve a conceder
-- todo y a revocar estas dos.

REVOKE UPDATE, DELETE ON public.audit_logs FROM langopia_app;

-- ─── Contexto de la petición ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_school_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.school_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_membership_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.membership_id', true), '')::uuid;
$$;

-- ─── Política estándar por tenant ─────────────────────────────────────────
--
-- Aplica a toda tabla con columna `school_id`. Se genera en bucle para que
-- añadir una tabla nueva no signifique acordarse de escribir su política:
-- basta con volver a ejecutar este fichero.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'school_id'
      AND NOT a.attisdropped
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (school_id = current_school_id())
         WITH CHECK (school_id = current_school_id())',
      t.table_name
    );
  END LOOP;
END
$$;

-- Los clientes MCP se registran dinámicamente ANTES de que haya una persona
-- autenticada que pueda fijar `app.school_id`: Claude/ChatGPT primero se
-- presentan, y después una membresía concreta autoriza scopes. Por eso
-- `mcp_clients.school_id` puede ser NULL. Las autorizaciones vivas siguen
-- siendo por escuela en `mcp_authorizations`.
ALTER TABLE public.mcp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_clients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.mcp_clients;
DROP POLICY IF EXISTS mcp_clients_registration_and_tenant_visibility ON public.mcp_clients;
CREATE POLICY mcp_clients_registration_and_tenant_visibility ON public.mcp_clients
  USING (school_id IS NULL OR school_id = current_school_id())
  WITH CHECK (school_id IS NULL OR school_id = current_school_id());

-- ─── Resolución pública de webs de escuela (Ola 4) ───────────────────────
--
-- La web pública llega sin sesión, así que todavía no existe `app.school_id`.
-- Solo se necesita resolver "hostname verificado -> school_id"; todo el
-- contenido del sitio se lee después dentro de una `UnitOfWork` con ese tenant
-- fijado y RLS activa. Estas funciones devuelven un UUID o NULL, nunca filas
-- completas ni datos personales.

DROP FUNCTION IF EXISTS public.school_id_for_verified_site_host(text);

CREATE FUNCTION public.school_id_for_verified_site_host(p_host text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT d.school_id
  FROM public.school_domains d
  JOIN public.sites s ON s.school_id = d.school_id
  WHERE lower(d.hostname) = lower(p_host)
    AND d.verified_at IS NOT NULL
    AND s.status = 'published'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.school_id_for_verified_site_host(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_id_for_verified_site_host(text) TO langopia_app;

DROP FUNCTION IF EXISTS public.school_id_for_published_site(uuid);

CREATE FUNCTION public.school_id_for_published_site(p_site_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT s.school_id
  FROM public.sites s
  WHERE s.id = p_site_id
    AND s.status = 'published'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.school_id_for_published_site(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_id_for_published_site(uuid) TO langopia_app;

-- ─── La raíz del tenant: `schools` ────────────────────────────────────────
--
-- `schools` es la única tabla del modelo multi-tenant que NO tiene columna
-- `school_id`: su identificador ES el tenant. Por eso el bucle de arriba no la
-- alcanzaba y se quedó sin política —una fuga real, no teórica: con el rol de
-- la aplicación se leían las tres escuelas con su NIF, su referencia de cobro y
-- su saldo de créditos, y `SELECT timezone FROM schools LIMIT 1` (que Scheduling
-- usa creyendo que RLS filtra) devolvía la escuela equivocada.
--
-- La política compara `id` en lugar de `school_id`. `WITH CHECK` con la misma
-- condición impide además que una escuela se renombre a sí misma como otra o
-- que la aplicación cree escuelas: el alta de una escuela nueva ocurre antes de
-- que haya tenant, así que cuando llegue el onboarding tendrá que ser una
-- decisión explícita —una función con privilegios como `memberships_for_auth_user`,
-- no un `INSERT` suelto que se cuele por aquí.

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.schools;
CREATE POLICY tenant_isolation ON public.schools
  USING (id = current_school_id())
  WITH CHECK (id = current_school_id());

-- ─── Tablas globales ──────────────────────────────────────────────────────
--
-- `users` y `plans` no tienen `school_id` a propósito.
--
--   users → una persona puede dar clase en dos escuelas. Duplicarla rompería
--           el inicio de sesión único. Lo que se protege es qué usuarios PUEDE
--           VER cada escuela: solo aquellos con un `membership` en ella.
--
--   plans → el catálogo de planes es tuyo. Todo el mundo puede leerlo; nadie
--           puede escribirlo desde la aplicación.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_visible_within_school ON public.users;
CREATE POLICY users_visible_within_school ON public.users
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = users.id
        AND m.school_id = current_school_id()
    )
  )
  WITH CHECK (true);  -- el alta de un usuario nuevo ocurre antes de tener membership

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_readable ON public.plans;
CREATE POLICY plans_readable ON public.plans FOR SELECT USING (true);

-- El correo de `users` vuelve a ser un dato editable.
--
-- Mientras el puente con la credencial de Better Auth fue el correo, poder
-- editarlo era poder apropiarse de la membresía de otra persona —bastaba con
-- cambiar el propio `users.email` al de un dueño ya registrado—, así que un
-- disparador lo hacía inmutable. Era un tapón con dos costes: no había forma
-- de corregir un correo mal escrito, y cualquier pantalla de edición de perfil
-- se llevaba un `check_violation` de Postgres en la cara.
--
-- El puente es ahora `users.auth_user_id` (migración 0002), un identificador
-- opaco que la persona no elige ni puede cambiar. El disparador sobra, y se
-- retira aquí para que las bases de datos que ya lo tienen se queden sin él.

DROP TRIGGER IF EXISTS users_email_immutable ON public.users;
DROP FUNCTION IF EXISTS public.users_email_is_immutable();

-- ─── Tablas de Better Auth ────────────────────────────────────────────────
--
-- `user`, `session`, `account` y `verification` quedan FUERA del modelo
-- multi-tenant, y esto es una decisión, no un olvido: guardan la credencial
-- de una persona, y una persona puede dar clase en dos escuelas. Ponerles
-- `school_id` obligaría a duplicar la contraseña por escuela.
--
-- Lo que se hace en su lugar:
--
--   1. RLS activado y NINGUNA política: para cualquier rol que no sea el
--      dueño, el resultado por defecto es no ver ni escribir nada.
--   2. Permisos revocados a `langopia_app`: la aplicación no las lee ni las
--      escribe nunca. Quien las toca es el `Pool` de Better Auth, que usa el
--      rol dueño (`DATABASE_URL`).
--   3. Sin FORCE ROW LEVEL SECURITY, justo por lo anterior: con FORCE ni el
--      dueño podría escribirlas y nadie podría registrarse.
--
-- El aislamiento entre escuelas de una sesión NO vive aquí: vive en
-- `memberships`, que sí lleva `school_id` y sí tiene política. La sesión dice
-- quién eres; `memberships` dice en qué escuela y con qué papel.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user', 'session', 'account', 'verification'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM langopia_app', t);
    END IF;
  END LOOP;
END
$$;

-- ─── Soporte de la plataforma (Tarea 17) ──────────────────────────────────
--
-- `platform_support_staff` es global, sin `school_id`: soporte no pertenece
-- a ninguna escuela en particular, puede impersonar en cualquiera. Mismo
-- tratamiento que las tablas de Better Auth de arriba: RLS activada, SIN
-- política, permisos revocados a `langopia_app`. Nadie la consulta por SQL
-- directo; la única vía es `is_platform_support`, más abajo.

ALTER TABLE public.platform_support_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_support_staff FROM langopia_app;

-- ─── Membresías de una sesión ya verificada ───────────────────────────────
--
-- El huevo y la gallina del multi-tenant: para fijar `app.school_id` hay que
-- saber a qué escuelas pertenece quien pregunta, y esa consulta —contra
-- `memberships` y `users`, ambas con RLS y FORCE— no puede fijar todavía
-- ninguna escuela. Con el rol `langopia_app` devuelve cero filas y nadie
-- podría entrar nunca.
--
-- La salida NO es dar `BYPASSRLS` a la aplicación: es esta función
-- `SECURITY DEFINER`, un agujero del tamaño exacto del problema.
--
--   · Recibe el identificador de la credencial de Better Auth (`user.id`) y
--     devuelve las membresías ACTIVAS de la persona atada a ella por
--     `users.auth_user_id`. No admite ningún otro parámetro, así que no hay
--     forma de pedirle las de otra ni de listarlas todas.
--   · Ese identificador sale de una sesión ya verificada por Better Auth
--     (`SessionTenantGuard`), nunca de algo que escriba el cliente.
--   · `EXECUTE` revocado a PUBLIC y concedido solo a `langopia_app`.
--   · `search_path` fijado, **con `pg_temp` al final**: no basta con poner
--     `public`. Todo rol puede crear tablas temporales, y `pg_temp` se
--     consulta antes que `public` si no se nombra explícitamente. Sin esta
--     precaución, una sesión de `langopia_app` que creara
--     `pg_temp.memberships`, `pg_temp.schools` y `pg_temp.users` conseguía que
--     la función —propiedad de un superusuario— devolviera una membresía de
--     `owner` inventada. Nombrarlo el último obliga a resolver primero contra
--     `public`. Comprobado: con este orden, el mismo ataque devuelve 0 filas.
--
-- **Por qué ya no se pregunta por el correo.** La versión anterior se llamaba
-- `memberships_for_email` y unía con `lower(u.email) = lower(p_email)`. Eso
-- hacía del correo una llave: quien lograra poner el correo de un dueño en su
-- propia fila —o registrarse con él antes que su titular— heredaba la escuela.
-- Se tapaba haciendo `users.email` inmutable con un disparador, un tapón que
-- además rompía cualquier edición de perfil. Con `auth_user_id` el vínculo lo
-- fija quien crea la cuenta en el dominio, no quien elige un correo, y una
-- credencial recién registrada con el correo de un dueño no encuentra ninguna
-- fila: `auth_user_id` de esa persona sigue siendo NULL o apuntando a OTRA
-- credencial. El correo, mientras tanto, vuelve a ser editable.
--
-- El rol de la aplicación sigue SIN `BYPASSRLS`: lo único que gana es poder
-- preguntar «¿a qué escuelas pertenece esta credencial?».

-- `CREATE OR REPLACE` no puede cambiar el tipo de retorno ni el nombre de los
-- parámetros de una función que ya existe, y este fichero se ejecuta sobre
-- bases de datos que ya tienen la versión anterior. La vieja se retira: dejarla
-- viva sería dejar en pie justo el camino que se acaba de cerrar.
DROP FUNCTION IF EXISTS public.memberships_for_email(text);
DROP FUNCTION IF EXISTS public.memberships_for_auth_user(text);

CREATE FUNCTION public.memberships_for_auth_user(p_auth_user_id text)
RETURNS TABLE (
  "membershipId" uuid,
  "schoolId"     uuid,
  "schoolSlug"   text,
  "schoolLocale" text,
  "schoolStatus" text,
  role           text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT m.id, s.id, s.slug, s.default_locale, s.status::text, m.role::text
  FROM public.memberships m
  JOIN public.schools s ON s.id = m.school_id
  JOIN public.users   u ON u.id = m.user_id
  WHERE u.auth_user_id = p_auth_user_id
    AND m.status = 'active'
  ORDER BY s.slug, m.role::text, m.id
$$;

REVOKE ALL ON FUNCTION public.memberships_for_auth_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.memberships_for_auth_user(text) TO langopia_app;

-- ─── Directorio de escuelas para trabajos de sistema ──────────────────────
--
-- El mismo huevo y la gallina que memberships_for_auth_user, para un trabajo
-- distinto: la purga de datos vencidos (RGPD) corre en un `@nestjs/schedule`,
-- fuera de toda petición HTTP. No hay sesión que resolver un tenant, y sin
-- embargo el trabajo tiene que recorrer TODAS las escuelas para no dejar
-- vencido lo de ninguna. Antes de fijar el primer `app.school_id` hace falta
-- saber por cuáles empezar, y esa pregunta no se puede responder con el
-- tenant ya fijado.
--
-- La función devuelve solo el `id` de cada escuela —nada de NIF, referencia
-- de cobro ni cualquier otra columna de `schools`—, así que un trabajo de
-- sistema puede saber CUÁLES son las escuelas; no puede leer nada de ellas
-- sin fijar tenant primero, exactamente igual que memberships_for_auth_user solo
-- deja preguntar por las membresías de un correo. Mismo `search_path` con
-- `pg_temp` al final, por el mismo motivo.

DROP FUNCTION IF EXISTS public.school_ids_for_system_jobs();

CREATE FUNCTION public.school_ids_for_system_jobs()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT s.id FROM public.schools s ORDER BY s.id
$$;

REVOKE ALL ON FUNCTION public.school_ids_for_system_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_ids_for_system_jobs() TO langopia_app;

-- ─── Resolución de tenant para webhooks del proveedor de pago (Tarea 8) ────
--
-- El mismo huevo y la gallina que memberships_for_auth_user, para un
-- trabajo distinto: un webhook del proveedor de pago no trae sesión ni
-- tenant —Stripe no sabe qué es un `x-school-slug`—, y antes de fijar
-- `app.school_id` hace falta saber a qué escuela pertenece la cuenta de
-- comerciante o el cobro que menciona el evento. Dos funciones, cada una
-- del tamaño exacto de la pregunta que resuelve:
--
--   · school_id_for_merchant_ref: qué escuela dio de alta esta cuenta de
--     comerciante (`account.updated`).
--   · school_id_for_charge_ref: qué escuela registró el cobro con esta
--     referencia del proveedor (`payment_intent.succeeded`,
--     `charge.refunded` — este último llega con la referencia del COBRO,
--     no de la devolución; la devolución se busca después, ya con el
--     tenant fijado).
--
-- Ninguna de las dos devuelve nada más que un `uuid` (o NULL si el evento no
-- es de ninguna escuela que conozcamos): no hay forma de traer NIF,
-- referencia de cobro ni ningún otro dato por esta puerta.

DROP FUNCTION IF EXISTS public.school_id_for_merchant_ref(text);

CREATE FUNCTION public.school_id_for_merchant_ref(p_merchant_ref text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT s.id FROM public.schools s WHERE s.merchant_ref = p_merchant_ref
$$;

REVOKE ALL ON FUNCTION public.school_id_for_merchant_ref(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_id_for_merchant_ref(text) TO langopia_app;

DROP FUNCTION IF EXISTS public.school_id_for_charge_ref(text);

CREATE FUNCTION public.school_id_for_charge_ref(p_charge_ref text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p.school_id
  FROM public.payments p
  WHERE p.provider_ref = p_charge_ref
  ORDER BY p.created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.school_id_for_charge_ref(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_id_for_charge_ref(text) TO langopia_app;

-- ─── Alta de escuela e invitaciones (Tarea 11) ─────────────────────────────
--
-- El mismo huevo y la gallina que `memberships_for_auth_user`, dos veces más:
--
--   · user_id_for_auth_user_id: si esta credencial de Better Auth ya tiene
--     una persona del dominio atada (alguien que da clase en otra escuela y
--     ahora abre la suya). La política de `users` solo hace visible a quien
--     YA tiene una membresía en la escuela ACTUAL —`current_school_id()`—, y
--     una escuela recién registrada, o una invitación recién aceptada,
--     todavía no tiene ninguna: sin esta función, el rol de la aplicación
--     vería siempre cero filas y cada alta de escuela nueva de una persona
--     que ya usa Langopia en otra terminaría insertando una fila duplicada en
--     `users` en vez de reutilizar la suya. Devuelve solo el `id`, o NULL si
--     es la primera vez que esta credencial se ata a alguien.
--
--   · school_id_for_invitation_token: a qué escuela pertenece un token de
--     invitación. Quien llega a `POST /invitations/:token/accept` no
--     pertenece todavía a ninguna escuela —si perteneciera, no necesitaría
--     una invitación—, así que no hay `app.school_id` que fijar antes de
--     preguntar por él. Devuelve solo el `id` de la escuela, nada de la
--     invitación en sí (ni el correo, ni el rol, ni si ya caducó: eso lo
--     comprueba el dominio, ya con el tenant fijado y RLS filtrando).
--
-- `schools` en sí NO necesita una función así: `RegisterSchoolHandler` genera
-- el id de la escuela antes de escribir nada (`IdGenerator`, no la base de
-- datos) y fija `app.school_id` a ese mismo valor antes de insertarla, así
-- que su propia política (`id = current_school_id()`) la deja pasar sin
-- tocar ni la política ni `BYPASSRLS`.

DROP FUNCTION IF EXISTS public.user_id_for_auth_user_id(text);

CREATE FUNCTION public.user_id_for_auth_user_id(p_auth_user_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT u.id FROM public.users u WHERE u.auth_user_id = p_auth_user_id
$$;

REVOKE ALL ON FUNCTION public.user_id_for_auth_user_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_id_for_auth_user_id(text) TO langopia_app;

DROP FUNCTION IF EXISTS public.school_id_for_invitation_token(text);

CREATE FUNCTION public.school_id_for_invitation_token(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT i.school_id
  FROM public.invitations i
  WHERE i.token = p_token
$$;

REVOKE ALL ON FUNCTION public.school_id_for_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_id_for_invitation_token(text) TO langopia_app;

-- ─── Aviso de disponibilidad del identificador (Tarea 12 del panel) ────────
--
-- El mismo huevo y la gallina de siempre, una vez más: el formulario de
-- registro quiere avisar EN VIVO, mientras se escribe, si un slug ya está en
-- uso — antes de que exista ninguna escuela, y por tanto sin `app.school_id`
-- que fijar. `schools` sí que tiene política (`id = current_school_id()`,
-- más arriba), pero esa política compara por `id`, no por `slug`: sin
-- tenant, cualquier `SELECT ... WHERE slug = ...` ve cero filas siempre,
-- disponible o no. Devuelve solo un booleano, nada de la fila entera.

DROP FUNCTION IF EXISTS public.school_slug_is_taken(text);

CREATE FUNCTION public.school_slug_is_taken(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.schools s WHERE s.slug = p_slug)
$$;

REVOKE ALL ON FUNCTION public.school_slug_is_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_slug_is_taken(text) TO langopia_app;

-- ─── Impersonación de soporte (Tarea 17) ───────────────────────────────────
--
-- El mismo huevo y la gallina de siempre, cuatro veces más: para decidir SI
-- alguien puede empezar a impersonar hace falta preguntar cosas que RLS, sin
-- tenant fijado todavía, dejaría vacías.
--
--   · is_platform_support: si esta credencial pertenece a soporte de la
--     plataforma. `platform_support_staff` no tiene política —solo esta
--     función la lee—, así que sin este agujero nadie podría entrar nunca
--     por esa puerta.
--   · school_id_for_membership: a qué escuela pertenece una membresía
--     cualquiera. Hace falta ANTES de fijar tenant porque fijar el tenant
--     correcto (el de la persona a impersonar) es precisamente lo que esta
--     función resuelve — igual que school_id_for_invitation_token resuelve
--     la escuela de una invitación antes de que exista ninguna sesión.
--   · active_impersonation_for_impersonator: si esta credencial tiene AHORA
--     MISMO una impersonación abierta como quien impersona, y hacia dónde.
--     La usan dos sitios: el guardia de tenant, en CADA petición, para
--     decidir si el efectivo pasa a ser el de la persona impersonada; y el
--     comando que empieza una impersonación nueva, para impedir apilarlas
--     («sin encadenar», dos veces: aquí para quien empieza, y con el mismo
--     resultado consultado sobre la persona objetivo, para impedir
--     impersonar a alguien que a su vez está impersonando a un tercero).
--   · is_being_impersonated: si esta credencial está siendo impersonada por
--     otra persona ahora mismo. Cierra la otra mitad de «sin encadenar»: si
--     A actúa como B, B no puede empezar una impersonación propia aunque
--     abra su propia sesión real para intentarlo.
--
-- Las cuatro filtran `ended_at IS NULL AND expires_at > now()`: una
-- impersonación caducada deja de contar sin que nadie tenga que cerrarla a
-- mano, y el guardia de tenant simplemente deja de encontrarla.

DROP FUNCTION IF EXISTS public.is_platform_support(text);

CREATE FUNCTION public.is_platform_support(p_auth_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_support_staff ps
    JOIN public.users u ON u.id = ps.user_id
    WHERE u.auth_user_id = p_auth_user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_platform_support(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_support(text) TO langopia_app;

DROP FUNCTION IF EXISTS public.school_id_for_membership(uuid);

CREATE FUNCTION public.school_id_for_membership(p_membership_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT m.school_id FROM public.memberships m WHERE m.id = p_membership_id
$$;

REVOKE ALL ON FUNCTION public.school_id_for_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_id_for_membership(uuid) TO langopia_app;

DROP FUNCTION IF EXISTS public.active_impersonation_for_impersonator(text);

-- `targetSchoolSlug` y `targetSchoolStatus` (saneamiento de cierre de la ola
-- 1): el guardia de tenant fijaba la escuela de destino sin mirar su estado,
-- así que una impersonación entraba en una escuela `canceled` — la única
-- puerta que se saltaba `SCHOOL_STATUSES_THAT_ALLOW_ACCESS`, y precisamente
-- la que usa quien no es de la escuela. Ya se hacía el `JOIN` con `schools`
-- para el idioma; devolver dos columnas más de la misma fila no cuesta nada.
CREATE FUNCTION public.active_impersonation_for_impersonator(p_auth_user_id text)
RETURNS TABLE (
  "impersonationId"          uuid,
  "schoolId"                 uuid,
  "targetMembershipId"       uuid,
  "targetRole"               text,
  "targetSchoolLocale"       text,
  "targetSchoolSlug"         text,
  "targetSchoolStatus"       text,
  "impersonatorMembershipId" uuid,
  "reason"                   text,
  "involvesMinor"            boolean,
  "expiresAt"                timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT i.id, m.school_id, m.id, m.role::text, s.default_locale, s.slug, s.status::text,
         i.impersonator_membership_id,
         i.reason, i.involves_minor, i.expires_at
  FROM public.impersonations i
  JOIN public.memberships m ON m.id = i.target_membership_id
  JOIN public.schools s      ON s.id = m.school_id
  JOIN public.users iu       ON iu.id = i.impersonator_user_id
  WHERE iu.auth_user_id = p_auth_user_id
    AND i.ended_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.started_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.active_impersonation_for_impersonator(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_impersonation_for_impersonator(text) TO langopia_app;

DROP FUNCTION IF EXISTS public.is_being_impersonated(text);

CREATE FUNCTION public.is_being_impersonated(p_auth_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.impersonations i
    JOIN public.memberships m ON m.id = i.target_membership_id
    JOIN public.users tu       ON tu.id = m.user_id
    WHERE tu.auth_user_id = p_auth_user_id
      AND i.ended_at IS NULL
      AND i.expires_at > now()
  )
$$;

REVOKE ALL ON FUNCTION public.is_being_impersonated(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_being_impersonated(text) TO langopia_app;

-- ═══════════════════════════════════════════════════════════════════════════
--  Comprobación
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Tablas con `school_id` pero SIN política: el resultado tiene que ser vacío.
--  Si devuelve algo, hay una tabla por la que se puede filtrar información.
--
--    SELECT c.relname
--    FROM pg_class c
--    JOIN pg_namespace n ON n.oid = c.relnamespace
--    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'school_id'
--    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT a.attisdropped
--      AND NOT EXISTS (SELECT 1 FROM pg_policies p
--                      WHERE p.tablename = c.relname AND p.schemaname = 'public')
--    ORDER BY 1;
