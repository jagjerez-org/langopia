import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

export class LeadCaptured extends DomainEvent {
  readonly eventName = "people.lead.captured";
  constructor(
    private readonly data: {
      leadId: string;
      schoolId: string;
      name: string;
      email: string;
      interestedLanguage: string | null;
      declaredLevel: string | null;
    },
  ) {
    super({ aggregateId: data.leadId, schoolId: data.schoolId });
  }

  payload() {
    return {
      leadId: this.data.leadId,
      name: this.data.name,
      email: this.data.email,
      interestedLanguage: this.data.interestedLanguage,
      declaredLevel: this.data.declaredLevel,
    };
  }
}

export class LeadConverted extends DomainEvent {
  readonly eventName = "people.lead.converted";
  constructor(
    private readonly data: {
      leadId: string;
      schoolId: string;
      studentProfileId: string;
    },
  ) {
    super({ aggregateId: data.leadId, schoolId: data.schoolId });
  }

  payload() {
    return {
      leadId: this.data.leadId,
      studentProfileId: this.data.studentProfileId,
    };
  }
}
