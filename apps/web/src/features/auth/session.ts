import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, getSchoolSlug, setSchoolSlug } from "../../lib/api-client.js";
import { getActiveImpersonation } from "../impersonation/api.js";
import { getMyMembership, getSession, signInWithEmail, signOut, type AuthUser } from "./api.js";

/**
 * Proveedor de sesión sobre TanStack Query (Tarea 3, Paso 3): sin `Context`
 * propio, porque `QueryClientProvider` (montado una vez en `main.tsx`) ya
 * hace de fuente única para toda la aplicación — dos consultas encadenadas,
 * cacheadas y compartidas por cualquier componente que llame a `useSession()`.
 */
export const SESSION_QUERY_KEY = ["auth", "session"] as const;
export const TENANT_QUERY_KEY = ["auth", "tenant"] as const;
export const MY_MEMBERSHIP_QUERY_KEY = ["auth", "my-membership"] as const;

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "unverified"; user: AuthUser }
  | { status: "needs-school"; user: AuthUser; schools: string[] }
  | { status: "ready"; user: AuthUser };

/**
 * `params.schools` es el listado de slugs de `resolveTenant` (API,
 * `session-tenant.guard.ts`) cuando hay más de una escuela usable: no es un
 * dato que este cliente calcule, es el que ya decidió el servidor. Cualquier
 * otro motivo de fallo (una preferencia guardada que ya no vale, la sesión
 * que caduca justo al confirmar, un `code` que no se reconoce) cae al mismo
 * sitio, con la lista vacía: seguir mostrando el selector es más seguro que
 * adivinar, y si la sesión de verdad ha desaparecido, el cliente compartido
 * (`api-client.ts`) ya se encarga de volver a `/entrar`.
 */
function schoolsFrom(error: unknown): string[] {
  if (error instanceof ApiError && error.code === "tenant_resolution_failed") {
    const schools = error.problem.params?.schools;
    if (Array.isArray(schools)) return schools.filter((s): s is string => typeof s === "string");
  }
  return [];
}

/**
 * Resuelve el tenant llamando a una ruta protegida cualquiera. `GET
 * /iam/impersonation` (`@Roles(...MEMBERSHIP_ROLES)`, cualquier rol) no
 * decide nada de negocio propio de esta tarea: es el mismo dato que ya
 * necesita el aviso permanente de impersonación (Tarea 17), así que resolver
 * tenant y comprobar impersonación son la misma llamada, no dos.
 *
 * Si había una escuela guardada de una sesión anterior y ya no vale
 * (`tenant_resolution_failed`), se olvida y se reintenta una vez sin ella:
 * una membresía revocada o una escuela que cambia no debe dejar a nadie
 * atascado repitiendo para siempre la misma preferencia rota.
 */
async function resolveTenant(): Promise<true> {
  const hadStoredSlug = getSchoolSlug() !== undefined;
  try {
    await getActiveImpersonation();
  } catch (error) {
    if (hadStoredSlug && error instanceof ApiError && error.code === "tenant_resolution_failed") {
      setSchoolSlug(undefined);
      await getActiveImpersonation();
      return true;
    }
    throw error;
  }
  // TanStack Query trata `undefined` como "no hay dato" y lo marca como error
  // de programación (`Query data cannot be undefined`): esta consulta solo
  // importa por si lanza o no, así que devuelve un valor fijo, nunca `void`.
  return true;
}

export function useSession(): SessionState {
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSession,
    staleTime: 60_000,
    retry: false,
  });

  const session = sessionQuery.data;
  const verified = session?.user.emailVerified === true;

  const tenantQuery = useQuery({
    queryKey: TENANT_QUERY_KEY,
    queryFn: resolveTenant,
    enabled: verified,
    retry: false,
    staleTime: 30_000,
  });

  if (sessionQuery.isPending) return { status: "loading" };
  if (!session) return { status: "anonymous" };
  if (!session.user.emailVerified) return { status: "unverified", user: session.user };
  if (tenantQuery.isPending) return { status: "loading" };
  if (tenantQuery.isSuccess) return { status: "ready", user: session.user };
  return { status: "needs-school", user: session.user, schools: schoolsFrom(tenantQuery.error) };
}

async function refreshSession(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  await queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEY });
  await queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIP_QUERY_KEY });
}

/**
 * Roles de la membresía activa (Tarea 11 del panel: portal del alumno y aula
 * del profesor). Es la primera pantalla que sirve a la vez a dirección,
 * profesorado, alumnado y tutela: hasta ahora ninguna pantalla necesitaba
 * saber su propio rol para decidir qué mostrar. Solo tiene sentido llamarlo
 * una vez `useSession()` reporta `"ready"` — antes no hay membresía que
 * resolver, y `ProtectedLayout` ya no monta nada de la aplicación hasta
 * entonces.
 */
export function useMyRoles(): string[] | undefined {
  const query = useQuery({
    queryKey: MY_MEMBERSHIP_QUERY_KEY,
    queryFn: getMyMembership,
    staleTime: 60_000,
    retry: false,
  });
  return query.data?.roles;
}

/** Inicia sesión con correo y contraseña, y refresca lo que `useSession()` reporta. */
export function useSignInWithEmail(): (email: string, password: string) => Promise<void> {
  const queryClient = useQueryClient();
  return async (email: string, password: string) => {
    await signInWithEmail(email, password);
    await refreshSession(queryClient);
  };
}

/** Cierra la sesión, olvida la escuela elegida y refresca `useSession()`. */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await signOut();
    setSchoolSlug(undefined);
    await refreshSession(queryClient);
  };
}

/**
 * Fija la escuela elegida (Paso 5 del brief) y vuelve a resolver el tenant.
 * Es una preferencia de interfaz, no un permiso: como mucho selecciona entre
 * las escuelas que `useSession()` ya ofrecía en `schools`.
 */
export function useChooseSchool(): (slug: string) => Promise<void> {
  const queryClient = useQueryClient();
  return async (slug: string) => {
    setSchoolSlug(slug);
    await queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEY });
    // El rol de una misma persona puede variar de una escuela a otra (una
    // profesora en una academia puede ser tutora en otra): la membresía
    // resuelta para la escuela anterior no vale para la recién elegida.
    await queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIP_QUERY_KEY });
  };
}

/**
 * Cambio de escuela (título de la Tarea 3): olvida la preferencia guardada y
 * vuelve a resolver sin ella. Para quien pertenece a una sola, no cambia
 * nada observable — vuelve a resolver la misma; para quien pertenece a
 * varias, `useSession()` vuelve a reportar "needs-school" y el panel
 * muestra el selector otra vez, esta vez por elección, no por ambigüedad.
 */
export function useSwitchSchool(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    setSchoolSlug(undefined);
    await queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIP_QUERY_KEY });
  };
}
