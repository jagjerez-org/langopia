import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { Uuid } from "../../../shared/domain/primitives/uuid.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { ImpersonationEnded, ImpersonationStarted } from "../events/impersonation.events.js";

export { ImpersonationEnded, ImpersonationStarted };

export class ImpersonationId extends Uuid {
  private constructor(value: string) {
    super(value, "impersonación");
  }
  static of(value: string): ImpersonationId {
    return new ImpersonationId(value);
  }
}

/** Texto libre, pero no cualquier texto: por debajo de esto no hay motivo real que auditar. */
const MIN_REASON_LENGTH = 10;

/** No se renueva: pasados 30 minutos hay que volver a justificar. */
const DURATION_MINUTES = 30;

export class InvalidImpersonationReasonError extends DomainError {
  readonly code = "invalid_impersonation_reason";
  readonly kind = "invalid_input" as const;
  constructor() {
    super(`El motivo de la impersonación debe tener al menos ${MIN_REASON_LENGTH} caracteres.`, {
      minLength: MIN_REASON_LENGTH,
    });
  }
}

export class ImpersonationAlreadyEndedError extends DomainError {
  readonly code = "impersonation_already_ended";
  readonly kind = "conflict" as const;
  constructor(impersonationId: string) {
    super(`La impersonación ${impersonationId} ya había terminado.`, { impersonationId });
  }
}

/**
 * Una sesión de soporte actuando como otra persona.
 *
 * `start()` es la única puerta de alta: valida el motivo, fija la caducidad
 * a 30 minutos exactos desde `now` y no admite prorrogarla — «no se renueva:
 * se vuelve a justificar» (brief de la tarea) es una propiedad de la firma,
 * no una promesa de quien la llama. Las reglas de QUIÉN puede impersonar a
 * QUIÉN no viven aquí: las decide `assertCanImpersonate`
 * (`impersonation-rules.ts`) ANTES de construir el agregado, porque
 * necesitan datos que este agregado no tiene por qué conocer (los roles de
 * quien impersona, si ya hay otra impersonación en curso). Este agregado
 * solo sabe de SÍ MISMO: cuándo caduca y si ya ha terminado.
 */
export class Impersonation extends AggregateRoot<ImpersonationId> {
  private constructor(
    id: ImpersonationId,
    private readonly _schoolId: string,
    private readonly _targetMembershipId: string,
    private readonly _impersonatorUserId: string,
    private readonly _impersonatorMembershipId: string | null,
    private readonly _impersonatorName: string,
    private readonly _impersonatorEmail: string,
    private readonly _reason: string,
    private readonly _involvesMinor: boolean,
    private readonly _startedAt: Date,
    private readonly _expiresAt: Date,
    private _endedAt: Date | null,
  ) {
    super(id);
  }

  static start(props: {
    id: ImpersonationId;
    schoolId: string;
    targetMembershipId: string;
    impersonatorUserId: string;
    impersonatorMembershipId: string | null;
    impersonatorName: string;
    impersonatorEmail: string;
    reason: string;
    involvesMinor: boolean;
    guardianMembershipIds: string[];
    now: Date;
  }): Impersonation {
    const reason = props.reason.trim();
    if (reason.length < MIN_REASON_LENGTH) throw new InvalidImpersonationReasonError();

    const expiresAt = new Date(props.now.getTime() + DURATION_MINUTES * 60_000);

    const impersonation = new Impersonation(
      props.id,
      props.schoolId,
      props.targetMembershipId,
      props.impersonatorUserId,
      props.impersonatorMembershipId,
      props.impersonatorName,
      props.impersonatorEmail,
      reason,
      props.involvesMinor,
      props.now,
      expiresAt,
      null,
    );

    impersonation.record(
      new ImpersonationStarted({
        impersonationId: props.id.value,
        schoolId: props.schoolId,
        targetMembershipId: props.targetMembershipId,
        impersonatorUserId: props.impersonatorUserId,
        impersonatorMembershipId: props.impersonatorMembershipId,
        impersonatorName: props.impersonatorName,
        impersonatorEmail: props.impersonatorEmail,
        reason,
        involvesMinor: props.involvesMinor,
        guardianMembershipIds: props.guardianMembershipIds,
        startedAt: props.now,
        expiresAt,
      }),
    );

    return impersonation;
  }

  /** Reconstruye desde persistencia. No emite `ImpersonationStarted`: eso ya ocurrió. */
  static reconstruct(props: {
    id: ImpersonationId;
    schoolId: string;
    targetMembershipId: string;
    impersonatorUserId: string;
    impersonatorMembershipId: string | null;
    impersonatorName: string;
    impersonatorEmail: string;
    reason: string;
    involvesMinor: boolean;
    startedAt: Date;
    expiresAt: Date;
    endedAt: Date | null;
  }): Impersonation {
    return new Impersonation(
      props.id,
      props.schoolId,
      props.targetMembershipId,
      props.impersonatorUserId,
      props.impersonatorMembershipId,
      props.impersonatorName,
      props.impersonatorEmail,
      props.reason,
      props.involvesMinor,
      props.startedAt,
      props.expiresAt,
      props.endedAt,
    );
  }

  /** ¿Ha pasado ya su hora de caducidad? No se renueva: solo dice sí o no. */
  isExpired(now: Date): boolean {
    return now >= this._expiresAt;
  }

  get hasEnded(): boolean {
    return this._endedAt !== null;
  }

  /**
   * Termina la impersonación, a mano o porque caducó. Muta el agregado;
   * quien llama lo guarda después. Registra el cierre y su duración —lo que
   * pide el brief en «Rastro»— para que la auditoría no tenga que restar
   * fechas por su cuenta.
   */
  end(now: Date): void {
    if (this._endedAt) throw new ImpersonationAlreadyEndedError(this.id.value);

    const endedReason: "manual" | "expired" = this.isExpired(now) ? "expired" : "manual";
    // La duración nunca supera los 30 minutos nominales: si ha caducado, el
    // cierre cuenta hasta la caducidad, no hasta el instante en que alguien
    // (o el propio guardia) se dio cuenta.
    const effectiveEnd = endedReason === "expired" ? this._expiresAt : now;
    this._endedAt = effectiveEnd;

    this.record(
      new ImpersonationEnded({
        impersonationId: this.id.value,
        schoolId: this._schoolId,
        targetMembershipId: this._targetMembershipId,
        durationSeconds: Math.round((effectiveEnd.getTime() - this._startedAt.getTime()) / 1000),
        endedReason,
      }),
    );
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get targetMembershipId(): string {
    return this._targetMembershipId;
  }

  get impersonatorUserId(): string {
    return this._impersonatorUserId;
  }

  get impersonatorMembershipId(): string | null {
    return this._impersonatorMembershipId;
  }

  get impersonatorName(): string {
    return this._impersonatorName;
  }

  get impersonatorEmail(): string {
    return this._impersonatorEmail;
  }

  get reason(): string {
    return this._reason;
  }

  get involvesMinor(): boolean {
    return this._involvesMinor;
  }

  get startedAt(): Date {
    return this._startedAt;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }
}
