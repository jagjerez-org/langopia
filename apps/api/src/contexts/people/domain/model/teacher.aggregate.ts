import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { InvalidContractedHoursError, TeacherAlreadyLeftError } from "../errors/people.errors.js";
import { HourlyRate, type TeacherTier } from "./hourly-rate.vo.js";
import type { TeacherId } from "./identifiers.js";
import { WeeklyAvailability } from "./weekly-availability.vo.js";

export const TeacherStatus = {
  Active: "active",
  OnLeave: "on_leave",
  Left: "left",
} as const;

export type TeacherStatus = (typeof TeacherStatus)[keyof typeof TeacherStatus];

const MIN_CONTRACTED_HOURS_PER_WEEK = 1;
const MAX_CONTRACTED_HOURS_PER_WEEK = 60;

/**
 * Profesor.
 *
 * Reglas más simples que las del alumnado: no hay minoría de edad ni
 * consentimientos que firmar, solo que la tarifa caiga en su tramo, que las
 * horas contratadas sean razonables y que su disponibilidad declarada no se
 * solape consigo misma (esa validación vive en `WeeklyAvailability`, no aquí).
 *
 * Que un profesor de baja no admita nuevas clases NO lo comprueba este
 * agregado: lo hace `TeacherAvailabilityPort.isActive()` en `scheduling`,
 * consultando el `status` de esta ficha antes de programar. Repetir esa
 * comprobación aquí la duplicaría sin necesidad — este agregado solo necesita
 * guardar en qué estado está.
 */
export class Teacher extends AggregateRoot<TeacherId> {
  private constructor(
    id: TeacherId,
    private readonly _schoolId: SchoolId,
    private readonly _membershipId: MembershipId,
    private _hourlyRate: HourlyRate,
    private _contractedHoursPerWeek: number,
    private _availability: WeeklyAvailability,
    private _status: TeacherStatus,
    private readonly _hiredAt: Date,
    private _leftReason: string | null,
  ) {
    super(id);
  }

  static hire(params: {
    id: TeacherId;
    schoolId: SchoolId;
    membershipId: MembershipId;
    hourlyRate: HourlyRate;
    contractedHoursPerWeek: number;
    hiredAt: Date;
  }): Teacher {
    Teacher.assertValidContractedHours(params.contractedHoursPerWeek);

    return new Teacher(
      params.id,
      params.schoolId,
      params.membershipId,
      params.hourlyRate,
      params.contractedHoursPerWeek,
      WeeklyAvailability.of([]),
      TeacherStatus.Active,
      params.hiredAt,
      null,
    );
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(props: {
    id: TeacherId;
    schoolId: SchoolId;
    membershipId: MembershipId;
    hourlyRate: HourlyRate;
    contractedHoursPerWeek: number;
    availability: WeeklyAvailability;
    status: TeacherStatus;
    hiredAt: Date;
    leftReason: string | null;
  }): Teacher {
    return new Teacher(
      props.id,
      props.schoolId,
      props.membershipId,
      props.hourlyRate,
      props.contractedHoursPerWeek,
      props.availability,
      props.status,
      props.hiredAt,
      props.leftReason,
    );
  }

  /** Sustituye TODA la disponibilidad semanal: no se combina con la anterior. */
  setAvailability(availability: WeeklyAvailability): void {
    this._availability = availability;
  }

  /**
   * Cambia el tramo y/o la tarifa por hora.
   *
   * Solo toca lo que llega —`params.tier`/`params.hourlyRateCents`
   * ausentes conservan el valor actual—, pero SIEMPRE reconstruye
   * `HourlyRate` con la combinación resultante: cambiar solo el tramo sin
   * ajustar el importe podría dejarlo fuera del nuevo rango, y es
   * exactamente lo que `HourlyRate.of(...)` comprueba, delegando en el VO
   * en vez de repetir aquí sus límites.
   */
  changeHourlyRate(params: { tier?: TeacherTier; hourlyRateCents?: number }): void {
    this.assertNotLeft();
    const tier = params.tier ?? this._hourlyRate.tier;
    const cents = params.hourlyRateCents ?? this._hourlyRate.cents;
    this._hourlyRate = HourlyRate.of(tier, cents);
  }

  release(params: { reason: string; now: Date }): void {
    this.assertNotLeft();
    this._status = TeacherStatus.Left;
    this._leftReason = params.reason;
  }

  private assertNotLeft(): void {
    if (this._status === TeacherStatus.Left) throw new TeacherAlreadyLeftError(this.id.value);
  }

  private static assertValidContractedHours(hours: number): void {
    if (
      !Number.isInteger(hours) ||
      hours < MIN_CONTRACTED_HOURS_PER_WEEK ||
      hours > MAX_CONTRACTED_HOURS_PER_WEEK
    ) {
      throw new InvalidContractedHoursError(hours);
    }
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get membershipId(): MembershipId {
    return this._membershipId;
  }
  get hourlyRate(): HourlyRate {
    return this._hourlyRate;
  }
  get contractedHoursPerWeek(): number {
    return this._contractedHoursPerWeek;
  }
  get availability(): WeeklyAvailability {
    return this._availability;
  }
  get status(): TeacherStatus {
    return this._status;
  }
  get hiredAt(): Date {
    return this._hiredAt;
  }
  get leftReason(): string | null {
    return this._leftReason;
  }
}
