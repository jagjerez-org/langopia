/**
 * Almacenamiento de grabaciones, visto desde `iam`.
 *
 * Es la MISMA idea que `classroom/domain/ports/recording-storage.port.ts`
 * (borrar la clave de un fichero), pero redeclarada aquí a propósito: un
 * contexto no importa nada de otro salvo sus eventos de dominio
 * (`architecture.spec.ts`, «un contexto solo importa los eventos de otro»).
 * Cada contexto que necesita hablar con el almacén de objetos declara su
 * propio puerto y su propio adaptador — el borrado RGPD a petición
 * (`ErasePersonHandler`) no es la purga por retención de `classroom`, aunque
 * las dos acaben borrando la misma clase de fichero.
 */
export interface RecordingStoragePort {
  /** Seguro de invocar dos veces con la misma clave: un borrado que se reintenta no debe fallar. */
  delete(key: string): Promise<void>;
}

export const IAM_RECORDING_STORAGE = Symbol("IamRecordingStoragePort");
