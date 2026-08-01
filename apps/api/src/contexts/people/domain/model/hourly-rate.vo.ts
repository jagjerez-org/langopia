import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { ValueObject } from "../../../shared/domain/primitives/value-object.js";

export class InvalidHourlyRateError extends DomainError {
  readonly code = "invalid_hourly_rate";
  readonly kind = "invalid_input" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export const TeacherTier = {
  Community: "community", // conversación, sin titulación — 4-15 €/h
  Professional: "professional", // titulado, clases estructuradas — 15-40 €/h
  Specialist: "specialist", // preparación de examen, business — 30-75 €/h
} as const;

export type TeacherTier = (typeof TeacherTier)[keyof typeof TeacherTier];

/** Tramos reales del mercado (italki, Preply, julio 2026), en céntimos por hora. */
const TIER_RANGES: Record<TeacherTier, { minCents: number; maxCents: number }> = {
  [TeacherTier.Community]: { minCents: 400, maxCents: 1500 },
  [TeacherTier.Professional]: { minCents: 1500, maxCents: 4000 },
  [TeacherTier.Specialist]: { minCents: 3000, maxCents: 7500 },
};

/**
 * Tarifa por hora de un profesor, en céntimos, ligada a su tramo.
 *
 * El tramo y el importe viven juntos a propósito: la regla de negocio es que
 * la tarifa caiga dentro del tramo declarado, y guardarlos como dos columnas
 * sueltas sin nada que las ate permitiría un `community` a 50 €/h sin que
 * nadie lo note hasta la nómina. Los límites son inclusivos: 4 €/h es una
 * tarifa `community` válida, no el primer valor rechazado.
 */
export class HourlyRate extends ValueObject<{ tier: TeacherTier; cents: number }> {
  private constructor(tier: TeacherTier, cents: number) {
    super({ tier, cents });
  }

  static of(tier: TeacherTier, cents: number): HourlyRate {
    const range = TIER_RANGES[tier];
    if (!Number.isInteger(cents) || cents < range.minCents || cents > range.maxCents) {
      throw new InvalidHourlyRateError(
        `La tarifa del tramo «${tier}» debe estar entre ${range.minCents / 100} y ${range.maxCents / 100} €/h.`,
        { tier, cents },
      );
    }
    return new HourlyRate(tier, cents);
  }

  get tier(): TeacherTier {
    return this.props.tier;
  }

  get cents(): number {
    return this.props.cents;
  }
}
