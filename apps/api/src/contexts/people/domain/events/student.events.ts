import { DomainEvent } from "../../../shared/domain/events/domain-event.js";

export class StudentEnrolled extends DomainEvent {
  readonly eventName = "people.student.enrolled";
  constructor(private readonly data: { studentId: string; schoolId: string; isMinor: boolean }) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return { studentId: this.data.studentId, isMinor: this.data.isMinor };
  }
}

export class StudentLeft extends DomainEvent {
  readonly eventName = "people.student.left";
  constructor(private readonly data: { studentId: string; schoolId: string; reason: string }) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return { studentId: this.data.studentId, reason: this.data.reason };
  }
}

export class ConsentGranted extends DomainEvent {
  readonly eventName = "people.consent.granted";
  constructor(
    private readonly data: {
      studentId: string;
      schoolId: string;
      kind: string;
      grantedByMembershipId: string;
    },
  ) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return {
      studentId: this.data.studentId,
      kind: this.data.kind,
      grantedByMembershipId: this.data.grantedByMembershipId,
    };
  }
}

export class ConsentWithdrawn extends DomainEvent {
  readonly eventName = "people.consent.withdrawn";
  constructor(
    private readonly data: {
      studentId: string;
      schoolId: string;
      kind: string;
      subjectMembershipId: string;
    },
  ) {
    super({ aggregateId: data.studentId, schoolId: data.schoolId });
  }
  payload() {
    return {
      studentId: this.data.studentId,
      kind: this.data.kind,
      subjectMembershipId: this.data.subjectMembershipId,
    };
  }
}
