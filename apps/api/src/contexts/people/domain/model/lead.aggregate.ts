import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import type { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { LeadCaptured, LeadConverted } from "../events/lead.events.js";
import { LeadAlreadyConvertedError, LeadAlreadyClosedError } from "../errors/people.errors.js";

export type LeadStatus =
  | "new"
  | "placement_sent"
  | "placement_done"
  | "contacted"
  | "converted"
  | "cold"
  | "discarded";

export type LeadSnapshot = {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string | null;
  locale: string;
  message: string | null;
  interestedLanguage: string | null;
  declaredLevel: CefrLevel | null;
  placementLevel: CefrLevel | null;
  placementScore: number | null;
  suggestedCourseId: string | null;
  status: LeadStatus;
  sourcePage: string | null;
  sourceCampaign: string | null;
  referrer: string | null;
  convertedStudentProfileId: string | null;
  convertedAt: string | null;
  assignedToMembershipId: string | null;
  createdAt: string;
  lastContactedAt: string | null;
  discardedReason: string | null;
};

const COLD_AFTER_DAYS = 30;
const STALE_STATUSES: ReadonlySet<LeadStatus> = new Set(["new", "placement_sent", "contacted"]);

export class Lead {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly schoolId: SchoolId,
    readonly name: string,
    readonly email: string,
    readonly phone: string | null,
    readonly locale: string,
    readonly message: string | null,
    readonly interestedLanguage: string | null,
    readonly declaredLevel: CefrLevel | null,
    private _placementLevel: CefrLevel | null,
    private _placementScore: number | null,
    private _suggestedCourseId: string | null,
    private _status: LeadStatus,
    readonly sourcePage: string | null,
    readonly sourceCampaign: string | null,
    readonly referrer: string | null,
    private _convertedStudentProfileId: string | null,
    private _convertedAt: Date | null,
    private _assignedToMembershipId: string | null,
    readonly createdAt: Date,
    private _lastContactedAt: Date | null,
    private _discardedReason: string | null,
  ) {
  }

  static capture(params: {
    id: string;
    schoolId: SchoolId;
    name: string;
    email: string;
    phone?: string | null;
    locale?: string | null;
    message?: string | null;
    interestedLanguage?: string | null;
    declaredLevel?: string | null;
    sourcePage?: string | null;
    sourceCampaign?: string | null;
    referrer?: string | null;
    now: Date;
  }): Lead {
    const lead = new Lead(
      params.id,
      params.schoolId,
      params.name.trim(),
      params.email.trim().toLowerCase(),
      nullableTrim(params.phone),
      nullableTrim(params.locale) ?? "es-ES",
      nullableTrim(params.message),
      nullableTrim(params.interestedLanguage),
      (nullableTrim(params.declaredLevel) as CefrLevel | null) ?? null,
      null,
      null,
      null,
      "new",
      nullableTrim(params.sourcePage),
      nullableTrim(params.sourceCampaign),
      nullableTrim(params.referrer),
      null,
      null,
      null,
      params.now,
      null,
      null,
    );
    lead.record(
      new LeadCaptured({
        leadId: lead.id,
        schoolId: lead.schoolId.value,
        name: lead.name,
        email: lead.email,
        interestedLanguage: lead.interestedLanguage,
        declaredLevel: lead.declaredLevel,
      }),
    );
    return lead;
  }

  static rehydrate(props: LeadSnapshot): Lead {
    return new Lead(
      props.id,
      SchoolId.of(props.schoolId),
      props.name,
      props.email,
      props.phone,
      props.locale,
      props.message,
      props.interestedLanguage,
      props.declaredLevel,
      props.placementLevel,
      props.placementScore,
      props.suggestedCourseId,
      props.status,
      props.sourcePage,
      props.sourceCampaign,
      props.referrer,
      props.convertedStudentProfileId,
      props.convertedAt ? new Date(props.convertedAt) : null,
      props.assignedToMembershipId,
      new Date(props.createdAt),
      props.lastContactedAt ? new Date(props.lastContactedAt) : null,
      props.discardedReason,
    );
  }

  assignPlacement(params: { level: string; score: number; suggestedCourseId?: string | null }): void {
    this.assertOpen();
    this._placementLevel = params.level as CefrLevel;
    this._placementScore = params.score;
    this._suggestedCourseId = params.suggestedCourseId ?? null;
    this._status = "placement_done";
  }

  markPlacementSent(): void {
    if (this._status === "new") this._status = "placement_sent";
  }

  convert(params: { studentProfileId: string; now: Date }): void {
    if (this._status === "converted") throw new LeadAlreadyConvertedError(this.id);
    this.assertOpen();
    this._status = "converted";
    this._convertedStudentProfileId = params.studentProfileId;
    this._convertedAt = params.now;
    this.record(
      new LeadConverted({
        leadId: this.id,
        schoolId: this.schoolId.value,
        studentProfileId: params.studentProfileId,
      }),
    );
  }

  discard(params: { reason: string }): void {
    if (this._status === "converted") throw new LeadAlreadyConvertedError(this.id);
    this._status = "discarded";
    this._discardedReason = params.reason.trim();
  }

  markColdIfInactive(now: Date): void {
    if (!STALE_STATUSES.has(this._status)) return;
    const lastActivity = this._lastContactedAt ?? this.createdAt;
    const ageMs = now.getTime() - lastActivity.getTime();
    if (ageMs >= COLD_AFTER_DAYS * 24 * 60 * 60 * 1000) this._status = "cold";
  }

  get status(): LeadStatus {
    return this._status;
  }

  get placementLevel(): CefrLevel | null {
    return this._placementLevel;
  }

  get placementScore(): number | null {
    return this._placementScore;
  }

  get suggestedCourseId(): string | null {
    return this._suggestedCourseId;
  }

  get convertedStudentProfileId(): string | null {
    return this._convertedStudentProfileId;
  }

  get convertedAt(): Date | null {
    return this._convertedAt;
  }

  get assignedToMembershipId(): string | null {
    return this._assignedToMembershipId;
  }

  get lastContactedAt(): Date | null {
    return this._lastContactedAt;
  }

  get discardedReason(): string | null {
    return this._discardedReason;
  }

  toSnapshot(): LeadSnapshot {
    return {
      id: this.id,
      schoolId: this.schoolId.value,
      name: this.name,
      email: this.email,
      phone: this.phone,
      locale: this.locale,
      message: this.message,
      interestedLanguage: this.interestedLanguage,
      declaredLevel: this.declaredLevel,
      placementLevel: this._placementLevel,
      placementScore: this._placementScore,
      suggestedCourseId: this._suggestedCourseId,
      status: this._status,
      sourcePage: this.sourcePage,
      sourceCampaign: this.sourceCampaign,
      referrer: this.referrer,
      convertedStudentProfileId: this._convertedStudentProfileId,
      convertedAt: this._convertedAt?.toISOString() ?? null,
      assignedToMembershipId: this._assignedToMembershipId,
      createdAt: this.createdAt.toISOString(),
      lastContactedAt: this._lastContactedAt?.toISOString() ?? null,
      discardedReason: this._discardedReason,
    };
  }

  private assertOpen(): void {
    if (this._status === "discarded" || this._status === "cold") {
      throw new LeadAlreadyClosedError(this.id, this._status);
    }
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }
}

function nullableTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
