/**
 * Escritura del borrado seudonimizador (Tarea 15, RGPD).
 *
 * Vive en `domain/ports/`, igual que `TranscriptRepositoryPort` de la purga
 * de la ola 0: es un repositorio de escritura, no un modelo de lectura para
 * un panel. Deliberadamente NO tiene ningún método que toque `invoices`: la
 * ausencia es la garantía en tiempo de compilación de que esta pieza no
 * puede alterar un importe facturado, por diseño y no por disciplina.
 */

export type PersonEraseTarget = {
  membershipId: string;
  /** `users.id`. Es la fila que de verdad se pseudonimiza: es GLOBAL, no de esta escuela. */
  userId: string;
  role: "owner" | "admin" | "teacher" | "student" | "guardian";
  /** Presente solo si `role === "student"`: es lo que decide si hay grabaciones que revisar. */
  studentProfileId: string | null;
};

export type PrivateRecording = {
  transcriptId: string;
  recordingStorageKey: string;
};

export interface PersonErasureRepository {
  findTarget(membershipId: string): Promise<PersonEraseTarget | null>;

  /** Un borrado repetido no tiene nada nuevo que hacer: se rechaza en vez de auditarlo dos veces. */
  isAlreadyErased(userId: string): Promise<boolean>;

  /**
   * Si `userId` tiene otra membresía ACTIVA en otra escuela. `users` es
   * global (la misma persona puede dar clase en dos academias): pseudonimizar
   * aquí le borraría el nombre también a la otra escuela, que no lo ha
   * pedido. Ver `PersonHasOtherSchoolMembershipsError`.
   */
  hasOtherActiveSchoolMemberships(userId: string): Promise<boolean>;

  pseudonymizeIdentity(params: { userId: string; nameMarker: string; emailMarker: string }): Promise<void>;

  /**
   * Transcripciones de sesiones donde SOLO estuvo este alumno (nadie más
   * pierde su grabación por esto). Solo tiene sentido para `role === "student"`.
   */
  privateRecordingsOf(studentProfileId: string): Promise<PrivateRecording[]>;

  /** Limpia `recording_storage_key` y marca `recording_deleted_at`. El fichero ya se borró aparte. */
  clearRecording(transcriptId: string): Promise<void>;

  /**
   * Todos los segmentos, de cualquier transcripción, donde habló esta
   * persona: quita el enlace de identidad (`speaker_membership_id`,
   * `speaker_label`) sin tocar `text` — es la conversación de la clase
   * entera, no solo de ella. Devuelve cuántos segmentos tocó.
   */
  anonymizeSpeakerSegments(membershipId: string): Promise<number>;
}

export const PERSON_ERASURE_REPOSITORY = Symbol("PersonErasureRepository");

/**
 * `.invalid` es un TLD reservado por la IANA (RFC 2606) para direcciones que
 * a propósito no son de nadie: es lo que hace que `isAlreadyErased` pueda
 * reconocer una fila ya pseudonimizada sin necesitar una columna aparte.
 */
export const ERASED_EMAIL_DOMAIN = "erased.invalid";
export const ERASED_NAME_MARKER = "Persona eliminada (RGPD)";
export const ANONYMIZED_SPEAKER_LABEL = "Hablante eliminado (RGPD)";
