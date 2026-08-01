/**
 * Identificadores de todas las escuelas.
 *
 * Excepción acotada a «todo acceso a datos va dentro de uow.execute()»,
 * igual que `SchoolDirectoryPort` en `classroom` y `notifications`, y por el
 * mismo motivo: `NotifyOverdueAttemptsJob` corre fuera de una petición HTTP,
 * así que no hay ninguna sesión que resuelva un tenant. Antes de poder fijar
 * el primer `app.school_id` hace falta saber por cuáles escuelas empezar.
 */
export interface SchoolDirectoryPort {
  allIds(): Promise<string[]>;
}

export const SCHOOL_DIRECTORY = Symbol("SchoolDirectoryPort");
