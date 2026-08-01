/**
 * Almacenamiento de objetos (S3/R2) para ficheros de la aplicación: audio,
 * imágenes, y cualquier otro binario que un contexto necesite guardar fuera
 * de Postgres.
 *
 * Es el mismo tipo de capacidad que `Clock` o `AuditLogPort`: infraestructura
 * de propósito general que cualquier contexto puede necesitar, así que vive
 * en `shared` y no dentro de uno solo de ellos. Lo que SÍ declara cada
 * contexto en su propio lenguaje es su necesidad concreta (por ejemplo,
 * `classroom/domain/ports/recording-storage.port.ts`, que solo pide
 * `delete(key)` porque es lo único que le hace falta); ese puerto propio
 * puede resolverse contra este mismo adaptador sin que el contexto sepa que
 * existe (ver `classroom.module.ts` e `iam.module.ts`, que atan su puerto a
 * este vía `useExisting`).
 */
export interface ObjectStoragePort {
  /** Sube (o sobrescribe) el fichero de esa clave. */
  put(params: { key: string; body: Buffer; contentType: string }): Promise<void>;

  /**
   * Borra el fichero de esa clave. Tiene que ser seguro invocarlo dos veces
   * con la misma clave —una purga o un borrado RGPD que se reintenta no debe
   * fallar porque el fichero ya no estaba—.
   */
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol("ObjectStoragePort");
