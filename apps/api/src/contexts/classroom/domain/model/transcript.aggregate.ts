import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Uuid } from "../../../shared/domain/primitives/uuid.js";
import { TranscriptReady } from "../events/transcript.events.js";

export class TranscriptId extends Uuid {
  private constructor(value: string) {
    super(value, "transcripción");
  }

  static of(value: string): TranscriptId {
    return new TranscriptId(value);
  }
}

export type TranscriptStatus = "pending" | "processing" | "ready" | "failed" | "blocked_no_consent";
export type TranscriptConsentStatus = "granted" | "missing" | "denied" | "withdrawn";

export type TranscriptConsentParticipant = {
  membershipId: MembershipId;
  displayName: string;
  isMinor: boolean;
  guardianMembershipId: MembershipId | null;
  consentStatus: TranscriptConsentStatus;
  grantedByMembershipId?: MembershipId | null;
};

export type TranscriptVocabulary = { term: string; lemma?: string; level?: string; count: number };
export type TranscriptRecurringError = { pattern: string; suggestion: string; count: number };

export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
  speakerMembershipId: MembershipId | null;
  speakerLabel: string | null;
  confidenceBps: number | null;
  isTeacher: boolean;
};

export class TranscriptBlockedError extends DomainError {
  readonly code = "transcript_blocked";
  readonly kind = "conflict" as const;

  constructor(transcriptId: string) {
    super(`La transcripción ${transcriptId} está bloqueada por falta de consentimiento.`, {
      transcriptId,
    });
  }
}

export class TranscriptNotProcessingError extends DomainError {
  readonly code = "transcript_not_processing";
  readonly kind = "conflict" as const;

  constructor(transcriptId: string, action: string) {
    super(`No se puede ${action} la transcripción ${transcriptId} en su estado actual.`, {
      transcriptId,
      action,
    });
  }
}

export class Transcript extends AggregateRoot<TranscriptId> {
  private constructor(
    id: TranscriptId,
    private readonly _schoolId: SchoolId,
    private readonly _sessionId: string,
    private readonly _provider: string,
    private readonly _language: string,
    private _status: TranscriptStatus,
    private _durationMs: number | null,
    private _summary: string | null,
    private _vocabulary: TranscriptVocabulary[],
    private _blockedReason: string | null,
    private _recordingStorageKey: string | null,
    private _retentionUntil: Date | null,
    private _readyAt: Date | null,
    private readonly _participants: MembershipId[],
    private readonly _segments: TranscriptSegment[],
  ) {
    super(id);
  }

  static start(params: {
    id: TranscriptId;
    schoolId: SchoolId;
    sessionId: string;
    provider: string;
    language: string;
    participants: TranscriptConsentParticipant[];
    now: Date;
  }): Transcript {
    const blockedReason = this.blockingReason(params.participants);
    return new Transcript(
      params.id,
      params.schoolId,
      params.sessionId,
      params.provider,
      params.language,
      blockedReason ? "blocked_no_consent" : "processing",
      null,
      null,
      [],
      blockedReason,
      null,
      null,
      null,
      params.participants.map((participant) => participant.membershipId),
      [],
    );
  }

  static rehydrate(props: {
    id: TranscriptId;
    schoolId: SchoolId;
    sessionId: string;
    provider: string;
    language: string;
    status: TranscriptStatus;
    durationMs: number | null;
    summary: string | null;
    vocabulary: TranscriptVocabulary[];
    blockedReason: string | null;
    recordingStorageKey: string | null;
    retentionUntil: Date | null;
    readyAt: Date | null;
    participants: MembershipId[];
    segments: TranscriptSegment[];
  }): Transcript {
    return new Transcript(
      props.id,
      props.schoolId,
      props.sessionId,
      props.provider,
      props.language,
      props.status,
      props.durationMs,
      props.summary,
      props.vocabulary,
      props.blockedReason,
      props.recordingStorageKey,
      props.retentionUntil,
      props.readyAt,
      props.participants,
      props.segments,
    );
  }

  appendSegment(params: {
    startMs: number;
    endMs: number;
    text: string;
    speakerMembershipId: MembershipId | null;
    speakerLabel?: string | null;
    confidenceBps?: number | null;
    isTeacher?: boolean;
  }): void {
    if (this._status === "blocked_no_consent") throw new TranscriptBlockedError(this.id.value);
    if (this._status !== "processing") throw new TranscriptNotProcessingError(this.id.value, "añadir segmentos a");
    this._segments.push({
      startMs: params.startMs,
      endMs: params.endMs,
      text: params.text,
      speakerMembershipId: params.speakerMembershipId,
      speakerLabel:
        params.speakerLabel ?? (params.speakerMembershipId ? null : "Participante sin identificar"),
      confidenceBps: params.confidenceBps ?? null,
      isTeacher: params.isTeacher ?? false,
    });
  }

  complete(params: {
    durationMs: number;
    summary: string | null;
    vocabulary: TranscriptVocabulary[];
    recordingStorageKey: string | null;
    dataRetentionDays: number;
    now: Date;
  }): void {
    if (this._status === "blocked_no_consent") throw new TranscriptBlockedError(this.id.value);
    if (this._status !== "processing") throw new TranscriptNotProcessingError(this.id.value, "completar");
    this._status = "ready";
    this._durationMs = params.durationMs;
    this._summary = params.summary;
    this._vocabulary = params.vocabulary;
    this._recordingStorageKey = params.recordingStorageKey;
    this._retentionUntil = addDays(params.now, params.dataRetentionDays);
    this._readyAt = params.now;
    this.record(
      new TranscriptReady({
        transcriptId: this.id.value,
        schoolId: this.schoolId.value,
        sessionId: this.sessionId,
        language: this.language,
        participantMembershipIds: this.participantMembershipIds.map((id) => id.value),
      }),
    );
  }

  enrichSummary(params: {
    summary: string;
    vocabulary: TranscriptVocabulary[];
    recurringErrors: TranscriptRecurringError[];
  }): void {
    if (this._status !== "ready") throw new TranscriptNotProcessingError(this.id.value, "resumir");
    this._summary = formatTeacherSummary(params.summary, params.recurringErrors);
    this._vocabulary = params.vocabulary;
  }

  fail(reason: string): void {
    if (this._status === "blocked_no_consent") throw new TranscriptBlockedError(this.id.value);
    this._status = "failed";
    this._blockedReason = reason;
    this._recordingStorageKey = null;
    this._retentionUntil = null;
    this._readyAt = null;
    this._segments.length = 0;
  }

  block(reason: string): void {
    this._status = "blocked_no_consent";
    this._blockedReason = reason;
    this._recordingStorageKey = null;
    this._segments.length = 0;
  }

  mustBeDeletedAfterConsentWithdrawal(membershipId: MembershipId): boolean {
    return this._status !== "blocked_no_consent" && this._participants.some((p) => p.equals(membershipId));
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get sessionId(): string {
    return this._sessionId;
  }
  get provider(): string {
    return this._provider;
  }
  get language(): string {
    return this._language;
  }
  get status(): TranscriptStatus {
    return this._status;
  }
  get durationMs(): number | null {
    return this._durationMs;
  }
  get summary(): string | null {
    return this._summary;
  }
  get vocabulary(): readonly TranscriptVocabulary[] {
    return this._vocabulary;
  }
  get blockedReason(): string | null {
    return this._blockedReason;
  }
  get recordingStorageKey(): string | null {
    return this._recordingStorageKey;
  }
  get retentionUntil(): Date | null {
    return this._retentionUntil;
  }
  get readyAt(): Date | null {
    return this._readyAt;
  }
  get participantMembershipIds(): readonly MembershipId[] {
    return this._participants;
  }
  get segments(): readonly TranscriptSegment[] {
    return this._segments;
  }

  private static blockingReason(participants: TranscriptConsentParticipant[]): string | null {
    const blocked = participants.find((participant) => !hasValidConsent(participant));
    if (!blocked) return null;

    if (blocked.isMinor) {
      return `El tutor legal de ${blocked.displayName} no ha autorizado la grabación. No se generó ni audio ni transcripción.`;
    }
    return `${blocked.displayName} no ha autorizado la grabación. No se generó ni audio ni transcripción.`;
  }
}

function hasValidConsent(participant: TranscriptConsentParticipant): boolean {
  if (participant.consentStatus !== "granted") return false;
  if (!participant.isMinor) return true;
  return Boolean(
    participant.guardianMembershipId &&
      participant.grantedByMembershipId?.equals(participant.guardianMembershipId),
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatTeacherSummary(summary: string, recurringErrors: TranscriptRecurringError[]): string {
  if (recurringErrors.length === 0) return summary;
  const lines = recurringErrors.map(
    (error) => `- ${error.pattern} (${error.count}): ${error.suggestion}`,
  );
  return `${summary}\n\nErrores recurrentes para la próxima sesión:\n${lines.join("\n")}`;
}
