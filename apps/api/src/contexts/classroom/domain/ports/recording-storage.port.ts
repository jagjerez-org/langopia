/**
 * Almacenamiento de las grabaciones de clase.
 *
 * `transcripts.recording_storage_key` guarda la clave del fichero; este
 * puerto es quien sabe borrarlo. Va separado del repositorio de
 * transcripciones porque son dos sistemas distintos: uno es Postgres, el
 * otro el almacén de objetos que aloje el audio o el vídeo.
 */
export interface RecordingStoragePort {
  /**
   * Borra el fichero de esa clave. Tiene que ser seguro invocarlo dos veces
   * con la misma clave —una purga que se reintenta no debe fallar porque el
   * fichero ya no estaba.
   */
  delete(key: string): Promise<void>;
}

export const RECORDING_STORAGE = Symbol("RecordingStoragePort");
