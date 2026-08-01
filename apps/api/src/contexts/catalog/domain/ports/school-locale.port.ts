/**
 * La configuración de la escuela que afecta al catálogo formativo.
 *
 * Igual que `SchoolSchedulingPolicyPort` en `scheduling`: vive en el contexto
 * de tenants, no aquí, así que se pide por un puerto.
 */
export interface SchoolLocalePort {
  /** Idioma por defecto de la escuela activa. Todo curso necesita su nombre en este. */
  defaultLocale(): Promise<string>;

  /**
   * Idiomas que la escuela activa soporta (Tarea 8 del panel web): el alta
   * de curso pinta un campo de nombre/descripción por cada uno de estos, no
   * uno fijo — es lo que permite que `Course.create()` exija el del idioma
   * por defecto sin que el formulario tenga que adivinar cuáles hacen falta.
   */
  supportedLocales(): Promise<string[]>;
}

export const SCHOOL_LOCALE_PORT = Symbol("SchoolLocalePort");
