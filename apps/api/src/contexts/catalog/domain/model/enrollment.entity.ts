import { Entity } from "../../../shared/domain/primitives/entity.js";
import { EnrollmentStatus } from "./enrollment-status.js";
import { EnrollmentId, GroupId, StudentId } from "./identifiers.js";

/**
 * Matrícula de un alumno en un grupo.
 *
 * Entidad interna del agregado `Group`, no una raíz propia: su invariante
 * central —no superar la capacidad del grupo— solo se puede comprobar
 * teniendo a la vista todas las matrículas del grupo a la vez, así que viven
 * y se guardan juntas.
 */
export class Enrollment extends Entity<EnrollmentId> {
  private constructor(
    id: EnrollmentId,
    private readonly _groupId: GroupId,
    private readonly _studentId: StudentId,
    private _status: EnrollmentStatus,
    /** Precio realmente acordado. `null` = el de catálogo. Nunca negativo. */
    private readonly _agreedPriceCents: number | null,
    private readonly _enrolledAt: Date,
    private _endedAt: Date | null,
    private _endedReason: string | null,
  ) {
    super(id);
  }

  static create(params: {
    id: EnrollmentId;
    groupId: GroupId;
    studentId: StudentId;
    agreedPriceCents: number | null;
    now: Date;
  }): Enrollment {
    return new Enrollment(
      params.id,
      params.groupId,
      params.studentId,
      EnrollmentStatus.Active,
      params.agreedPriceCents,
      params.now,
      null,
      null,
    );
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: EnrollmentId;
    groupId: GroupId;
    studentId: StudentId;
    status: EnrollmentStatus;
    agreedPriceCents: number | null;
    enrolledAt: Date;
    endedAt: Date | null;
    endedReason: string | null;
  }): Enrollment {
    return new Enrollment(
      props.id,
      props.groupId,
      props.studentId,
      props.status,
      props.agreedPriceCents,
      props.enrolledAt,
      props.endedAt,
      props.endedReason,
    );
  }

  get groupId(): GroupId {
    return this._groupId;
  }
  get studentId(): StudentId {
    return this._studentId;
  }
  get status(): EnrollmentStatus {
    return this._status;
  }
  get agreedPriceCents(): number | null {
    return this._agreedPriceCents;
  }
  get enrolledAt(): Date {
    return this._enrolledAt;
  }
  get endedAt(): Date | null {
    return this._endedAt;
  }
  get endedReason(): string | null {
    return this._endedReason;
  }
}
