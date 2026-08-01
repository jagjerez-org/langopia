import type {
  Transcript,
  TranscriptConsentParticipant,
} from "../model/transcript.aggregate.js";
import type { ExternalTranscriptProvider } from "./external-transcript-importer.port.js";

/**
 * Transcripciones de clase, en lo que necesita el trabajo de purga (RGPD).
 *
 * No es un repositorio de propósito general: expone solo «cuáles vencieron»
 * y «bórrala». Cuando `classroom` tenga más casos de uso sobre transcripts,
 * este puerto crece o se divide; no se amplía por adelantado.
 */
export type PurgeCandidate = {
  id: string;
  /**
   * `null` cuando la transcripción está bloqueada por falta de consentimiento
   * (o cualquier otro motivo que impidió generarla): no hay grabación que
   * conservar, así que no hay plazo que vigilar. Ese registro es justamente
   * la prueba de que no se grabó, y no se borra nunca.
   */
  retentionUntil: Date | null;
  recordingStorageKey: string | null;
};

/**
 * Estado de grabación/transcripción de UNA clase, tal como lo decidió el
 * servidor (Tarea 11 del panel: aula del profesor, Paso 4).
 *
 * `blocked` es `true` solo cuando el estado es `blocked_no_consent`: alguien
 * de la clase —o el tutor de un menor— no dio su consentimiento, así que no
 * se grabó ni se transcribió NADA de esa sesión, ni siquiera el resto de
 * participantes que sí habían consentido. `blockedReason` es el motivo tal
 * como lo registró quien creó la transcripción (o la ausencia de ella); el
 * aula lo muestra tal cual, no lo redacta.
 */
export type RecordingConsentStatus = {
  blocked: boolean;
  blockedReason: string | null;
};

export type ExternalTranscriptImportCandidate = {
  sessionId: string;
  schoolId: string;
  provider: ExternalTranscriptProvider;
  externalId: string;
  scheduledEnd: Date;
};

export interface TranscriptRepositoryPort {
  /**
   * Transcripciones de la escuela activa cuyo plazo de conservación ya
   * venció. Filtra por `retention_until` en SQL —hay un índice pensado
   * exactamente para esto—, pero un borrado es irreversible: quien llama a
   * este método vuelve a comprobar la fecha antes de tocar nada, en lugar de
   * fiarse de una única capa.
   */
  findExpired(now: Date): Promise<PurgeCandidate[]>;

  /**
   * Clases externas completadas hace al menos dos horas y sin transcripción
   * registrada. El job corre escuela por escuela, dentro de UoW/RLS; no se
   * filtra `school_id` en código.
   */
  findExternalCompletedWithoutTranscript(now: Date): Promise<ExternalTranscriptImportCandidate[]>;

  /** Borra la transcripción y, en cascada, sus segmentos. */
  delete(id: string): Promise<void>;

  /**
   * El estado de grabación de la transcripción de esta clase, si existe.
   * `null` cuando todavía no hay ninguna fila —una clase futura, o una que
   * no genera transcripción— y entonces no hay bloqueo que avisar.
   */
  recordingStatusForSession(sessionId: string): Promise<RecordingConsentStatus | null>;

  /** Transcripción lista, con segmentos, para enriquecerla con resumen y vocabulario. */
  findReadyById(id: string): Promise<Transcript | null>;

  /**
   * Participantes cuya voz o datos podrían entrar en una transcripción de la
   * clase. Devuelve el estado de consentimiento ya resuelto para el dominio:
   * el agregado decide si eso permite arrancar o bloquea.
   */
  consentReadinessForSession(sessionId: string): Promise<{
    dataRetentionDays: number;
    participants: TranscriptConsentParticipant[];
  }>;

  /** Guarda la cabecera y los segmentos de la transcripción. */
  save(transcript: Transcript): Promise<void>;

  /**
   * Retirada posterior de consentimiento: borra cualquier transcripción ya
   * generada para clases en las que participó esa membresía.
   */
  deleteForParticipant(membershipId: string): Promise<number>;
}

export const TRANSCRIPT_REPOSITORY = Symbol("TranscriptRepositoryPort");
