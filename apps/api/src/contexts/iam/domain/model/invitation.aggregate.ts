import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { Uuid } from "../../../shared/domain/primitives/uuid.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

export class InvitationId extends Uuid {
  private constructor(value: string) {
    super(value, "invitación");
  }
  static of(value: string): InvitationId {
    return new InvitationId(value);
  }
}

/**
 * Roles que se pueden invitar. Subconjunto cerrado de `membership_role`
 * (`packages/db/src/schema/enums.ts`): mantenerla aquí en vez de importar el
 * `pgEnum` de Drizzle es lo que le permite al dominio no depender de él
 * (`ARCHITECTURE.md`).
 */
export const MEMBERSHIP_ROLES = ["owner", "admin", "teacher", "student", "guardian"] as const;
export type MembershipRoleName = (typeof MEMBERSHIP_ROLES)[number];

const INVITATION_TTL_DAYS = 7;

/** Evento del agregado. Es lo que hace que el correo de invitación (Tarea 12) pueda existir. */
export class MemberInvited extends DomainEvent {
  readonly eventName = "iam.member.invited";

  constructor(
    private readonly data: {
      invitationId: string;
      schoolId: string;
      email: string;
      role: MembershipRoleName;
      token: string;
      expiresAt: Date;
    },
  ) {
    super({ aggregateId: data.invitationId, schoolId: data.schoolId });
  }

  payload() {
    return {
      email: this.data.email,
      role: this.data.role,
      token: this.data.token,
      expiresAt: this.data.expiresAt.toISOString(),
    };
  }
}

export class InvitationExpiredError extends DomainError {
  readonly code = "invitation_expired";
  readonly kind = "conflict" as const;
  constructor(invitationId: string) {
    super(`La invitación ${invitationId} ha caducado.`, { invitationId });
  }
}

export class InvitationAlreadyResolvedError extends DomainError {
  readonly code = "invitation_already_resolved";
  readonly kind = "conflict" as const;
  constructor(invitationId: string) {
    super(`La invitación ${invitationId} ya se aceptó o se revocó.`, { invitationId });
  }
}

/** El mensaje no repite el correo al que se envió: sería un espejo para adivinarlo por fuerza bruta. */
export class InvitationEmailMismatchError extends DomainError {
  readonly code = "invitation_email_mismatch";
  readonly kind = "forbidden" as const;
  constructor() {
    super("Esta invitación no es para tu correo.");
  }
}

/**
 * Invitación a unirse a una escuela.
 *
 * Agregado propio, no una entidad hija de `School`: se resuelve por su
 * propio `token`, sin cargar la escuela entera, y su ciclo de vida (caduca,
 * se acepta, se revoca) no toca ningún otro dato de la escuela.
 *
 * Las dos reglas del brief son invariantes suyos, no de quien la usa:
 * caduca a los 7 días de crearse, y solo la acepta el correo exacto al que
 * se envió — comparado en minúsculas, para que un correo con mayúsculas
 * distintas no cuele como «otro» correo.
 */
export class Invitation extends AggregateRoot<InvitationId> {
  private constructor(
    id: InvitationId,
    private readonly _schoolId: string,
    private readonly _email: string,
    private readonly _role: MembershipRoleName,
    private readonly _token: string,
    private readonly _expiresAt: Date,
    private _acceptedAt: Date | null,
    private _revokedAt: Date | null,
  ) {
    super(id);
  }

  static invite(props: {
    id: InvitationId;
    schoolId: string;
    email: string;
    role: MembershipRoleName;
    token: string;
    now: Date;
    ttlDays?: number;
  }): Invitation {
    const expiresAt = new Date(
      props.now.getTime() + (props.ttlDays ?? INVITATION_TTL_DAYS) * 24 * 60 * 60 * 1000,
    );
    const email = props.email.toLowerCase();
    const invitation = new Invitation(
      props.id,
      props.schoolId,
      email,
      props.role,
      props.token,
      expiresAt,
      null,
      null,
    );
    invitation.record(
      new MemberInvited({
        invitationId: props.id.value,
        schoolId: props.schoolId,
        email,
        role: props.role,
        token: props.token,
        expiresAt,
      }),
    );
    return invitation;
  }

  /** Reconstruye desde persistencia. No emite `MemberInvited`: eso ya ocurrió. */
  static reconstruct(props: {
    id: InvitationId;
    schoolId: string;
    email: string;
    role: MembershipRoleName;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  }): Invitation {
    return new Invitation(
      props.id,
      props.schoolId,
      props.email,
      props.role,
      props.token,
      props.expiresAt,
      props.acceptedAt,
      props.revokedAt,
    );
  }

  /** Acepta la invitación. Muta el agregado; quien llama la guarda después. */
  accept(email: string, now: Date): void {
    if (this._acceptedAt || this._revokedAt) {
      throw new InvitationAlreadyResolvedError(this.id.value);
    }
    if (now > this._expiresAt) {
      throw new InvitationExpiredError(this.id.value);
    }
    if (this._email !== email.toLowerCase()) {
      throw new InvitationEmailMismatchError();
    }
    this._acceptedAt = now;
  }

  get schoolId(): string {
    return this._schoolId;
  }

  get email(): string {
    return this._email;
  }

  get role(): MembershipRoleName {
    return this._role;
  }

  get token(): string {
    return this._token;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get acceptedAt(): Date | null {
    return this._acceptedAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }
}
