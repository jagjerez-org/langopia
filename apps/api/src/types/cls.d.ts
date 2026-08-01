/**
 * Lo que viaja en el almacenamiento por petición.
 *
 * Declararlo aquí en vez de usar claves sueltas hace que el compilador avise
 * si alguien guarda algo con un tipo que no toca — el contexto de tenant es
 * demasiado sensible para escribirlo a ciegas.
 */
declare module "nestjs-cls" {
  interface ClsStore {
    "tenant:schoolId"?: string;
    "tenant:membershipId"?: string;
    "tenant:roles"?: string[];
    /** Idioma resuelto para la petición (Tarea 8/8b). Uno de `SUPPORTED_LOCALES`. */
    "tenant:locale"?: string;
    /** Identificador de la impersonación activa (Tarea 17), si la hay. */
    "tenant:impersonationId"?: string;
    /** Membresía real de quien impersona (Tarea 17), si la tiene. */
    "tenant:impersonatorMembershipId"?: string;
    /** Identificador de la petición (Tarea 8c). Ver `CLS_TRACE_ID`. */
    "trace:id"?: string;
    /**
     * Transacción activa. Va sin tipar a propósito: el almacén no debe
     * conocer el tipo concreto de Drizzle, que es un detalle de la capa de
     * persistencia. `DrizzleService` es quien lo devuelve ya tipado.
     */
    "drizzle:tx"?: unknown;
  }
}

export {};
