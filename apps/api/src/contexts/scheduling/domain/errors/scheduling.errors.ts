import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class InvalidTimeSlotError extends DomainError {
  readonly code = "invalid_time_slot";
  readonly kind = "invalid_input" as const;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(`Franja horaria no válida: ${reason}`, details);
  }
}

export class SessionAlreadyClosedError extends DomainError {
  readonly code = "session_already_closed";
  readonly kind = "invariant_violation" as const;

  constructor(sessionId: string, status: string, attempted: string) {
    super(
      `No se puede ${attempted} una clase en estado «${status}».`,
      { sessionId, status, attempted },
    );
  }
}

export class TeacherNotAvailableError extends DomainError {
  readonly code = "teacher_not_available";
  readonly kind = "invariant_violation" as const;

  constructor(teacherId: string, from: Date, to: Date) {
    super(
      "El profesor no tiene disponibilidad declarada en esa franja.",
      { teacherId, from: from.toISOString(), to: to.toISOString() },
    );
  }
}

export class TeacherOverlapError extends DomainError {
  readonly code = "teacher_overlap";
  readonly kind = "conflict" as const;

  constructor(teacherId: string, conflictingSessionId: string) {
    super(
      "El profesor ya tiene otra clase que se solapa con esa franja.",
      { teacherId, conflictingSessionId },
    );
  }
}

export class UnknownRoomProviderError extends DomainError {
  readonly code = "unknown_room_provider";
  readonly kind = "invalid_input" as const;

  constructor(value: string, allowed: readonly string[]) {
    super(`«${value}» no es un tipo de aula conocido.`, { value, allowed });
  }
}

export class CannotScheduleInThePastError extends DomainError {
  readonly code = "cannot_schedule_in_the_past";
  readonly kind = "invariant_violation" as const;

  constructor(start: Date, now: Date) {
    super("No se puede programar una clase en el pasado.", {
      start: start.toISOString(),
      now: now.toISOString(),
    });
  }
}

/**
 * Pasar lista antes de que la clase empiece no tiene sentido: nadie ha podido
 * conectarse todavía. La comparación es contra la hora programada, no contra
 * un estado «en curso» — aquí nunca se llama a `ClassSession.start()`, así
 * que exigir ese estado dejaría la asistencia bloqueada para siempre.
 */
export class SessionNotStartedError extends DomainError {
  readonly code = "session_not_started";
  readonly kind = "invariant_violation" as const;

  constructor(sessionId: string, sessionStart: Date, now: Date) {
    super("No se puede pasar lista de una clase que todavía no ha empezado.", {
      sessionId,
      sessionStart: sessionStart.toISOString(),
      now: now.toISOString(),
    });
  }
}

/** Marcar asistencia de alguien que no está matriculado no es un dato: es un error. */
export class StudentNotEnrolledError extends DomainError {
  readonly code = "student_not_enrolled";
  readonly kind = "invariant_violation" as const;

  constructor(studentId: string, groupId: string) {
    super("El alumno no está matriculado en este grupo.", { studentId, groupId });
  }
}
