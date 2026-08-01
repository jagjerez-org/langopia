import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

/**
 * Eventos del agregado `Impersonation`.
 *
 * En un fichero propio, y no junto al agregado como hace `Invitation` —a
 * diferencia de `MemberInvited`, `ImpersonationStarted` SÍ tiene un
 * consumidor cruzando de contexto (`notifications`, para el aviso al
 * afectado, paso 11 del brief), y la guardia de fronteras solo permite
 * importar de OTRO contexto lo que vive bajo `domain/events/`.
 */

export class ImpersonationStarted extends DomainEvent {
  readonly eventName = "iam.impersonation.started";

  constructor(
    private readonly data: {
      impersonationId: string;
      schoolId: string;
      targetMembershipId: string;
      impersonatorUserId: string;
      impersonatorMembershipId: string | null;
      impersonatorName: string;
      impersonatorEmail: string;
      reason: string;
      involvesMinor: boolean;
      guardianMembershipIds: string[];
      startedAt: Date;
      expiresAt: Date;
    },
  ) {
    super({ aggregateId: data.impersonationId, schoolId: data.schoolId });
  }

  payload() {
    return {
      targetMembershipId: this.data.targetMembershipId,
      impersonatorUserId: this.data.impersonatorUserId,
      impersonatorMembershipId: this.data.impersonatorMembershipId,
      impersonatorName: this.data.impersonatorName,
      impersonatorEmail: this.data.impersonatorEmail,
      reason: this.data.reason,
      involvesMinor: this.data.involvesMinor,
      guardianMembershipIds: this.data.guardianMembershipIds,
      startedAt: this.data.startedAt.toISOString(),
      expiresAt: this.data.expiresAt.toISOString(),
    };
  }
}

export class ImpersonationEnded extends DomainEvent {
  readonly eventName = "iam.impersonation.ended";

  constructor(
    private readonly data: {
      impersonationId: string;
      schoolId: string;
      targetMembershipId: string;
      durationSeconds: number;
      endedReason: "manual" | "expired";
    },
  ) {
    super({ aggregateId: data.impersonationId, schoolId: data.schoolId });
  }

  payload() {
    return {
      targetMembershipId: this.data.targetMembershipId,
      durationSeconds: this.data.durationSeconds,
      endedReason: this.data.endedReason,
    };
  }
}
