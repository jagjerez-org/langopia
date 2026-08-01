/**
 * Quién está pidiendo esto y en nombre de qué escuela.
 *
 * Lo resuelve un adaptador de entrada (el interceptor HTTP, o el servidor MCP)
 * y viaja por toda la petición sin pasarse como parámetro. El dominio lo lee
 * a través de este puerto; no conoce cabeceras, ni sesiones, ni subdominios.
 */
export interface TenantContext {
  /** Escuela activa. Lanza si no hay ninguna: nunca se opera «sin escuela». */
  schoolId(): string;
  /**
   * Membresía EFECTIVA de quien actúa. Ausente en trabajos de sistema.
   *
   * Durante una impersonación (Tarea 17) es la membresía IMPERSONADA — la
   * escuela, el rol y todo lo demás pasan a ser los de esa persona, que es
   * justo lo que hace que RLS siga aislando por su escuela y no por la de
   * quien impersona de verdad.
   */
  membershipId(): string | null;
  roles(): readonly string[];
  has(role: string): boolean;
  /**
   * Identificador de la impersonación activa (Tarea 17), o `null` si esta
   * petición no ocurre dentro de ninguna. Es la señal de «¿se está
   * impersonando, sí o no?» — separada de `impersonatorMembershipId()`
   * porque soporte de la plataforma puede impersonar sin tener membresía
   * propia en ninguna escuela: ahí `impersonatorMembershipId()` es `null`
   * IGUALMENTE, y sin esta señal aparte no habría forma de distinguir «no se
   * está impersonando» de «se está impersonando, pero quien lo hace no tiene
   * membresía».
   */
  impersonationId?(): string | null;

  /**
   * Membresía REAL de quien impersona, si la tiene; `null` en cualquier otro
   * caso, incluida una impersonación por soporte de la plataforma sin
   * membresía propia en ninguna escuela. Es la otra mitad del rastro:
   * `membershipId()` dice quién PARECÍA, esto dice quién ERA.
   *
   * Ambos métodos son opcionales en la firma, a propósito: hay dobles de
   * prueba de `TenantContext` en varios contextos (fijados en escritos antes
   * de la Tarea 17) que no los implementan. Quien los llama usa `?.() ??
   * null`.
   */
  impersonatorMembershipId?(): string | null;
}

export const TENANT_CONTEXT = Symbol("TenantContext");
