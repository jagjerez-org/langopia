import type { School, SchoolStatus } from "../model/school.aggregate.js";

/**
 * Ajustes de la escuela activa, tal como los necesita el asistente de puesta
 * en marcha (Tarea 12 del panel): ni la fila entera ni el agregado `School`
 * completo, solo los campos que ese asistente lee o toca.
 */
export interface SchoolSettings {
  name: string;
  defaultLocale: string;
  supportedLocales: string[];
  status: SchoolStatus;
  trialEndsAt: Date | null;
}

/**
 * Edición parcial: ausente es «no tocar», igual semántica PATCH que
 * `UpdateTeacherCommand`. `supportedLocales` no se recibe del cliente — lo
 * decide `UpdateSchoolSettingsHandler` a partir de `defaultLocale`, para que
 * las dos columnas nunca queden inconsistentes entre sí (ver el propio
 * manejador).
 */
export interface UpdateSchoolSettingsInput {
  name?: string;
  defaultLocale?: string;
  supportedLocales?: string[];
}

/**
 * Repositorio del agregado `School`.
 *
 * `save` es la única puerta de ALTA (Tarea 11 backend: alta de escuela
 * autoservicio). `existsBySlug`, `findCurrent` y `updateSettings` son de la
 * Tarea 12 del panel (registro y puesta en marcha): la primera corre SIN
 * tenant, igual que `save`; las otras dos corren DENTRO de tenant, una vez
 * quien se registra ya tiene su membresía de `owner` — no pasan por el
 * agregado `School` porque no hay ninguna regla de negocio que decidir
 * (cualquier nombre no vacío vale, cualquiera de los cinco idiomas
 * soportados vale), solo un valor que guardar y su rastro en `audit_logs`.
 */
export interface SchoolRepositoryPort {
  save(school: School): Promise<void>;

  /**
   * ¿Ya existe una escuela con este slug? Aviso de disponibilidad en vivo,
   * antes de enviar el formulario de alta — la unicidad de verdad la impone
   * `schools_slug_uq` en el momento de insertar; esto es solo el adelanto.
   */
  existsBySlug(slug: string): Promise<boolean>;

  /** Ajustes actuales de la escuela activa, o `null` si por lo que sea no hay ninguna (no debería ocurrir: el tenant ya está resuelto). */
  findCurrent(): Promise<SchoolSettings | null>;

  /** Aplica los campos presentes en `input` y devuelve los ajustes ya actualizados. */
  updateSettings(input: UpdateSchoolSettingsInput): Promise<SchoolSettings>;
}

export const SCHOOL_REPOSITORY = Symbol("SchoolRepositoryPort");
