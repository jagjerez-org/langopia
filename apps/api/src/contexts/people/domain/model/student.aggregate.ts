import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  GuardianRequiredError,
  MinorCannotSelfConsentError,
  NotAGuardianError,
  StudentAlreadyLeftError,
} from "../errors/people.errors.js";
import {
  ConsentGranted,
  ConsentWithdrawn,
  StudentEnrolled,
  StudentLeft,
} from "../events/student.events.js";
import { Consent, type ConsentKind } from "./consent.vo.js";
import type { DateOfBirth } from "./date-of-birth.vo.js";
import { GuardianId, StudentId } from "./identifiers.js";

export const StudentStatus = {
  Active: "active",
  Paused: "paused", // matrícula congelada, vuelve
  Left: "left", // baja
} as const;

export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export type Guardian = {
  id: GuardianId;
  membershipId: MembershipId;
  relationship: "mother" | "father" | "legal_guardian" | "other";
  canGiveConsent: boolean;
};

/**
 * Alumno.
 *
 * Concentra la regla que el producto no puede permitirse fallar: quién puede
 * consentir qué. Está aquí y no en el formulario porque la misma pregunta
 * llega desde el panel, desde el portal del alumno y desde el módulo de
 * grabación.
 */
export class Student extends AggregateRoot<StudentId> {
  private constructor(
    id: StudentId,
    private readonly _schoolId: SchoolId,
    private readonly _membershipId: MembershipId,
    private _dateOfBirth: DateOfBirth,
    private _status: StudentStatus,
    private readonly _guardians: Guardian[],
    private readonly _consents: Map<ConsentKind, Consent>,
    private _pausedUntil: Date | null,
    private _leftReason: string | null,
    private _currentLevel: CefrLevel | null,
    readonly nativeLanguage: string,
    readonly targetLanguage: string,
    private _now: Date,
  ) {
    super(id);
  }

  static enrol(params: {
    id: StudentId;
    schoolId: SchoolId;
    membershipId: MembershipId;
    dateOfBirth: DateOfBirth;
    nativeLanguage: string;
    targetLanguage: string;
    now: Date;
  }): Student {
    const student = new Student(
      params.id,
      params.schoolId,
      params.membershipId,
      params.dateOfBirth,
      StudentStatus.Active,
      [],
      new Map(),
      null,
      null,
      null,
      params.nativeLanguage,
      params.targetLanguage,
      params.now,
    );
    student.record(
      new StudentEnrolled({
        studentId: params.id.value,
        schoolId: params.schoolId.value,
        isMinor: params.dateOfBirth.isMinorAt(params.now),
      }),
    );
    return student;
  }

  /**
   * Reconstruye un alumno ya existente desde persistencia.
   *
   * A diferencia de `enrol()`, no valida invariantes de alta ni emite
   * eventos: lo que está guardado ya pasó, y volver a comprobarlo aquí haría
   * que un cambio de reglas rompiera la lectura de datos históricos. `now` es
   * el instante de la LECTURA, no el de cuando se creó el alumno: así
   * `guardianRequired` refleja la edad actual y no la que tenía el día del
   * alta.
   */
  static rehydrate(props: {
    id: StudentId;
    schoolId: SchoolId;
    membershipId: MembershipId;
    dateOfBirth: DateOfBirth;
    status: StudentStatus;
    guardians: Guardian[];
    consents: Map<ConsentKind, Consent>;
    pausedUntil: Date | null;
    leftReason: string | null;
    currentLevel: CefrLevel | null;
    nativeLanguage: string;
    targetLanguage: string;
    now: Date;
  }): Student {
    return new Student(
      props.id,
      props.schoolId,
      props.membershipId,
      props.dateOfBirth,
      props.status,
      props.guardians,
      props.consents,
      props.pausedUntil,
      props.leftReason,
      props.currentLevel,
      props.nativeLanguage,
      props.targetLanguage,
      props.now,
    );
  }

  get guardianRequired(): boolean {
    return this._dateOfBirth.isMinorAt(this._now);
  }

  get status(): StudentStatus {
    return this._status;
  }

  get guardians(): readonly Guardian[] {
    return this._guardians;
  }

  /** Todos los consentimientos conocidos, concedidos o retirados. Lo usa el mapeador. */
  get consents(): ReadonlyMap<ConsentKind, Consent> {
    return this._consents;
  }

  addGuardian(guardian: Guardian): void {
    if (this._guardians.some((g) => g.membershipId.equals(guardian.membershipId))) return;
    this._guardians.push(guardian);
  }

  /**
   * Otorga un consentimiento.
   *
   * Si el alumno es menor, quien firma tiene que ser un tutor con
   * `canGiveConsent`. Que el propio menor firme es la vía por la que una
   * escuela acabaría grabando a un niño sin permiso de su familia.
   */
  grantConsent(params: { kind: ConsentKind; grantedBy: MembershipId; now: Date }): void {
    if (this.guardianRequired) {
      if (params.grantedBy.equals(this._membershipId)) {
        throw new MinorCannotSelfConsentError(this.id.value);
      }
      const tutor = this._guardians.find(
        (g) => g.membershipId.equals(params.grantedBy) && g.canGiveConsent,
      );
      if (!tutor) throw new NotAGuardianError(params.grantedBy.value, this.id.value);
    }

    this._consents.set(
      params.kind,
      Consent.granted({ kind: params.kind, grantedBy: params.grantedBy, at: params.now }),
    );
    this.record(
      new ConsentGranted({
        studentId: this.id.value,
        schoolId: this._schoolId.value,
        kind: params.kind,
        grantedByMembershipId: params.grantedBy.value,
      }),
    );
  }

  withdrawConsent(params: { kind: ConsentKind; now: Date }): void {
    this._consents.set(params.kind, Consent.withdrawn({ kind: params.kind, at: params.now }));
    this.record(
      new ConsentWithdrawn({
        studentId: this.id.value,
        schoolId: this._schoolId.value,
        kind: params.kind,
        subjectMembershipId: this._membershipId.value,
      }),
    );
  }

  hasConsent(kind: ConsentKind): boolean {
    return this._consents.get(kind)?.granted ?? false;
  }

  /**
   * Corrige la fecha de nacimiento.
   *
   * Un error de tecleo es habitual y no debería quedar grabado para
   * siempre, pero la minoría de edad se recalcula sobre la fecha nueva: si
   * el cambio convierte a un adulto en menor y no hay ningún tutor dado de
   * alta, el alumno quedaría en un estado imposible —menor sin quien
   * consienta por él—, así que se rechaza en vez de dejarlo a medias.
   */
  changeDateOfBirth(params: { dateOfBirth: DateOfBirth; now: Date }): void {
    this.assertNotLeft();
    if (params.dateOfBirth.isMinorAt(params.now) && this._guardians.length === 0) {
      throw new GuardianRequiredError();
    }
    this._dateOfBirth = params.dateOfBirth;
    this._now = params.now;
  }

  /**
   * Ajusta el nivel MCER a mano.
   *
   * Sin más invariante que ser un nivel válido —ya lo garantiza el tipo
   * `CefrLevel`—: la traza de qué valor tenía antes la deja el manejador en
   * `audit_logs`, no este método.
   */
  changeLevel(level: CefrLevel | null): void {
    this.assertNotLeft();
    this._currentLevel = level;
  }

  pause(params: { until: Date; now: Date }): void {
    this.assertNotLeft();
    this._status = StudentStatus.Paused;
    this._pausedUntil = params.until;
  }

  resume(_params: { now: Date }): void {
    this.assertNotLeft();
    this._status = StudentStatus.Active;
    this._pausedUntil = null;
  }

  leave(params: { reason: string; now: Date }): void {
    this.assertNotLeft();
    this._status = StudentStatus.Left;
    this._leftReason = params.reason;
    this.record(
      new StudentLeft({
        studentId: this.id.value,
        schoolId: this._schoolId.value,
        reason: params.reason,
      }),
    );
  }

  private assertNotLeft(): void {
    if (this._status === StudentStatus.Left) throw new StudentAlreadyLeftError(this.id.value);
  }

  get pausedUntil(): Date | null {
    return this._pausedUntil;
  }
  get leftReason(): string | null {
    return this._leftReason;
  }
  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get membershipId(): MembershipId {
    return this._membershipId;
  }
  get dateOfBirth(): DateOfBirth {
    return this._dateOfBirth;
  }
  get currentLevel(): CefrLevel | null {
    return this._currentLevel;
  }
}
