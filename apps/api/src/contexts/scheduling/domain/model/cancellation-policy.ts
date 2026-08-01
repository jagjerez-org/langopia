import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import type { CancellingParty } from "./cancellation.vo.js";
import type { TimeSlot } from "./time-slot.vo.js";

export class InvalidCancellationPolicyError extends DomainError {
  readonly code = "invalid_cancellation_policy";
  readonly kind = "invalid_input" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

/**
 * Política de cancelación de la escuela.
 *
 * Es la regla que decide si una clase cancelada genera derecho a devolución,
 * y vive en el dominio precisamente porque es negocio puro: la misma pregunta
 * se responde igual desde el panel web, desde el portal del alumno o desde
 * una llamada MCP.
 *
 * Dos reglas, y la segunda manda sobre la primera:
 *
 *   1. Si cancela el ALUMNO, hay devolución solo si avisó con la antelación
 *      mínima que fije la escuela.
 *   2. Si cancela la ESCUELA, siempre hay devolución. El alumno no tiene la
 *      culpa de que su profesora se ponga enferma, avise cuando avise.
 */
export class CancellationPolicy extends ValueObject<{ minimumNoticeHours: number }> {
  private constructor(minimumNoticeHours: number) {
    super({ minimumNoticeHours });
  }

  static of(minimumNoticeHours: number): CancellationPolicy {
    if (!Number.isFinite(minimumNoticeHours) || minimumNoticeHours < 0) {
      throw new InvalidCancellationPolicyError(
        "La antelación mínima debe ser un número de horas no negativo.",
        { minimumNoticeHours },
      );
    }
    if (minimumNoticeHours > 168) {
      throw new InvalidCancellationPolicyError(
        "Una antelación de más de una semana deja el calendario inservible.",
        { minimumNoticeHours },
      );
    }
    return new CancellationPolicy(minimumNoticeHours);
  }

  /** 24 horas: lo habitual en el sector. */
  static default(): CancellationPolicy {
    return new CancellationPolicy(24);
  }

  get minimumNoticeHours(): number {
    return this.props.minimumNoticeHours;
  }

  refundDueFor(params: { party: CancellingParty; slot: TimeSlot; canceledAt: Date }): boolean {
    if (params.party === "school") return true;
    return params.slot.hoursOfNoticeFrom(params.canceledAt) >= this.props.minimumNoticeHours;
  }
}
