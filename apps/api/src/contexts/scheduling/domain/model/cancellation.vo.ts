import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { MembershipId } from "../../../shared/domain/primitives/school-id.js";

/** Quién cancela. Determina si el alumno tiene derecho a que le devuelvan. */
export type CancellingParty = "school" | "student";

/**
 * Los datos de una cancelación, ya resueltos.
 *
 * `refundDue` no es una opinión de quien llama a la API: lo calcula la
 * política de cancelación de la escuela y queda congelado aquí. Si mañana la
 * escuela cambia su política, las cancelaciones pasadas no cambian.
 */
export class Cancellation extends ValueObject<{
  at: Date;
  by: MembershipId;
  party: CancellingParty;
  reason: string;
  noticeHours: number;
  refundDue: boolean;
}> {
  private constructor(props: {
    at: Date;
    by: MembershipId;
    party: CancellingParty;
    reason: string;
    noticeHours: number;
    refundDue: boolean;
  }) {
    super(props);
  }

  static of(props: {
    at: Date;
    by: MembershipId;
    party: CancellingParty;
    reason: string;
    noticeHours: number;
    refundDue: boolean;
  }): Cancellation {
    return new Cancellation({
      ...props,
      at: new Date(props.at),
      reason: props.reason.trim(),
      noticeHours: Math.round(props.noticeHours * 100) / 100,
    });
  }

  get at(): Date {
    return this.props.at;
  }
  get by(): MembershipId {
    return this.props.by;
  }
  get party(): CancellingParty {
    return this.props.party;
  }
  get reason(): string {
    return this.props.reason;
  }
  get noticeHours(): number {
    return this.props.noticeHours;
  }
  get refundDue(): boolean {
    return this.props.refundDue;
  }
}
