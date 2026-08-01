import { api } from "../../lib/api-client.js";

/**
 * Puente con Better Auth (Tarea 3), montado sobre el cliente compartido
 * (`apps/web/src/lib/api-client.ts`, Tarea 2): mismas cookies, mismo
 * `Accept-Language`, mismo manejo de `missing_tenant`. Solo las rutas bajo
 * `/auth` — `AuthController` (`apps/api/.../iam/infrastructure/http/
 * auth.controller.ts`) las reenvía tal cual a Better Auth, así que su cuerpo
 * de error no es un Problem Details (trae `message`, no `title`); el cliente
 * compartido ya sabe caer a `message` cuando falta `title`.
 */

/** Recorte de lo que expone `session.user` de Better Auth — solo lo que usa el panel. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

/** Forma de `GET /auth/get-session`. `null` cuando no hay sesión que valga. */
export type BetterAuthSession = {
  session: { id: string; expiresAt: string };
  user: AuthUser;
};

export function getSession(): Promise<BetterAuthSession | null> {
  return api.get<BetterAuthSession | null>("/auth/get-session");
}

export function signInWithEmail(email: string, password: string): Promise<BetterAuthSession> {
  return api.post<BetterAuthSession>("/auth/sign-in/email", { email, password });
}

export function signOut(): Promise<void> {
  return api.post<void>("/auth/sign-out");
}

/** Quién soy en la escuela activa (Tarea 11 del panel: portal del alumno y aula del profesor). */
export type MyMembership = {
  membershipId: string | null;
  roles: string[];
};

/**
 * `GET /iam/me`: la membresía y los roles de la sesión activa, dentro de la
 * escuela ya resuelta. Hasta esta tarea ninguna pantalla necesitaba conocer
 * su propio rol —dirección, alumnado y calendario dan por hecho que quien
 * mira es personal—; el portal del alumno es la primera que convive con
 * varios roles a la vez y necesita decidir qué navegación mostrar.
 */
export function getMyMembership(): Promise<MyMembership> {
  return api.get<MyMembership>("/iam/me");
}

/**
 * Inicia el ida y vuelta de OAuth con Google. Better Auth no redirige él
 * mismo desde esta llamada —es una petición `fetch`, no una navegación de
 * verdad—: devuelve la URL de Google a la que hay que enviar al navegador.
 */
export async function signInWithGoogle(callbackURL = "/"): Promise<void> {
  const result = await api.post<{ url: string }>("/auth/sign-in/social", {
    provider: "google",
    callbackURL,
  });
  window.location.assign(result.url);
}
