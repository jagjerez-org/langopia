/** La forma que devuelve la API para cualquier error (ola 0, T8b). */
export type Problem = {
  code: string;
  title: string;
  status: number;
  params?: Record<string, unknown>;
  details?: Record<string, unknown>;
  traceId?: string;
};

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.title);
  }

  get code(): string {
    return this.problem.code;
  }

  /** El identificador que el usuario puede dar en soporte. */
  get traceId(): string | undefined {
    return this.problem.traceId;
  }
}

/**
 * `missing_tenant` (Tarea 8c, `AuthenticatedGuard`) es lo que devuelve
 * cualquier ruta protegida cuando no hay sesión que resolver tenant: no es un
 * fallo de negocio que una pantalla deba explicar, es que hay que volver a
 * entrar. La cabecera `x-school-slug` que manda este cliente (T2, T4) no es
 * autoridad — el servidor ya comprobó las membresías —, así que este código
 * nunca lo produce una escuela mal elegida, solo una sesión que ya no vale.
 *
 * `/entrar` (Tarea 3, verbatim del brief): la Tarea 2 dejó aquí `/login` como
 * «convención a la espera de que exista la pantalla real» (su propio informe
 * lo dice así); ahora que existe, se corrige al nombre real de la ruta.
 */
const LOGIN_PATH = "/entrar";

/**
 * Preferencia de interfaz, no un permiso: el servidor ya comprobó las
 * membresías (`resolveTenant`, `SessionTenantGuard`), así que esta cabecera
 * como mucho SELECCIONA entre las escuelas a las que la sesión ya pertenece;
 * pedir otra no da acceso. La fija el selector de escuela (Tarea 3, Paso 5)
 * para las peticiones siguientes, y se recuerda entre recargas porque es
 * exactamente eso, una preferencia, no un secreto que proteger.
 */
const SCHOOL_SLUG_STORAGE_KEY = "langopia:school-slug";

function readStoredSchoolSlug(): string | undefined {
  try {
    return localStorage.getItem(SCHOOL_SLUG_STORAGE_KEY) ?? undefined;
  } catch {
    // Almacenamiento no disponible (privado, cuota, SSR de pruebas...): sin
    // preferencia recordada, cada petición vuelve a la resolución automática.
    return undefined;
  }
}

let schoolSlug: string | undefined = readStoredSchoolSlug();

/** Preferencia de escuela activa para las próximas peticiones, o `undefined` si no hay ninguna elegida. */
export function getSchoolSlug(): string | undefined {
  return schoolSlug;
}

/**
 * Fija (o borra, con `undefined`) la escuela activa y la recuerda entre
 * recargas. La llama el selector de escuela al confirmar una elección, y el
 * flujo de resolución de tenant cuando una preferencia guardada deja de valer.
 */
export function setSchoolSlug(slug: string | undefined): void {
  schoolSlug = slug;
  try {
    if (slug) localStorage.setItem(SCHOOL_SLUG_STORAGE_KEY, slug);
    else localStorage.removeItem(SCHOOL_SLUG_STORAGE_KEY);
  } catch {
    // Sin almacenamiento persistente, la preferencia solo dura lo que dure
    // esta pestaña — degradación aceptable, no un motivo para lanzar.
  }
}

/**
 * Cliente HTTP.
 *
 * `credentials: "include"` manda la cookie de sesión que emite Better Auth.
 * El error llega con `title` ya traducido y con `params` aparte: quien lo
 * pinta decide si usa el catálogo del panel (`useErrorMessage`, T5) o el
 * título de la API. Aquí no se decide, solo se transporta.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": document.documentElement.lang,
        ...(schoolSlug ? { "x-school-slug": schoolSlug } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    console.error("fallo de red", { path, cause });
    throw new ApiError({
      code: "network_error",
      title: "No se pudo contactar con el servidor.",
      status: 0,
    });
  }

  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (cause) {
    // Un cuerpo ilegible no se descarta en silencio: si la respuesta además
    // era un error, perderíamos la única pista de qué pasó.
    console.error("respuesta sin JSON válido", { path, status: response.status, cause });
  }

  if (!response.ok) {
    // Better Auth (`/auth/*`, Tarea 3) no habla Problem Details: su cuerpo de
    // error trae `message` (y a veces `code`, en SCREAMING_CASE, sin
    // relación con el catálogo del panel), nunca `title`. Sin este respaldo,
    // cualquier fallo de inicio de sesión se enseñaría como el `statusText`
    // genérico del navegador («Unauthorized») en vez del motivo real.
    const problem = body as (Partial<Problem> & { message?: string }) | null;
    const error = new ApiError({
      code: problem?.code ?? "unknown_error",
      title: problem?.title ?? problem?.message ?? response.statusText,
      status: response.status,
      params: problem?.params,
      details: problem?.details,
      traceId: problem?.traceId,
    });
    // La sesión ya no resuelve ninguna escuela: no hay pantalla que pueda
    // arreglar esto mostrando un mensaje, hace falta iniciar sesión de nuevo.
    if (error.code === "missing_tenant") {
      window.location.assign(LOGIN_PATH);
    }
    throw error;
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  /** Añadido por la Tarea 8 (Profesorado): `PUT /teachers/:id/availability` reemplaza la semana entera. */
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
