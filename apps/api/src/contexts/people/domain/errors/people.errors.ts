import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class MinorCannotSelfConsentError extends DomainError {
  readonly code = "minor_cannot_self_consent";
  readonly kind = "invariant_violation" as const;
  constructor(studentId: string) {
    super(
      "Un alumno menor de edad no puede firmar su propio consentimiento: debe hacerlo su tutor legal.",
      { studentId },
    );
  }
}

export class NotAGuardianError extends DomainError {
  readonly code = "not_a_guardian";
  readonly kind = "forbidden" as const;
  constructor(membershipId: string, studentId: string) {
    super("Quien firma no consta como tutor legal de este alumno.", { membershipId, studentId });
  }
}

export class StudentAlreadyLeftError extends DomainError {
  readonly code = "student_already_left";
  readonly kind = "invariant_violation" as const;
  constructor(studentId: string) {
    super("Este alumno ya está de baja.", { studentId });
  }
}

export class InvalidContractedHoursError extends DomainError {
  readonly code = "invalid_contracted_hours";
  readonly kind = "invalid_input" as const;
  constructor(hours: number) {
    super("Las horas contratadas deben estar entre 1 y 60 semanales.", { hours });
  }
}

export class TeacherAlreadyLeftError extends DomainError {
  readonly code = "teacher_already_left";
  readonly kind = "invariant_violation" as const;
  constructor(teacherId: string) {
    super("Este profesor ya está de baja.", { teacherId });
  }
}

/**
 * Vivía en `EnrolStudentHandler` (aplicación) porque solo el alta la
 * lanzaba. La Tarea 13 la necesita también desde `Student.changeDateOfBirth`
 * —el dominio no puede importar de la capa de aplicación—, así que se muda
 * aquí y el alta pasa a importarla de este fichero.
 */
export class GuardianRequiredError extends DomainError {
  readonly code = "guardian_required";
  readonly kind = "invariant_violation" as const;
  constructor() {
    super("Un alumno menor de edad necesita al menos un tutor legal para darse de alta.");
  }
}

export class LeadAlreadyConvertedError extends DomainError {
  readonly code = "lead_already_converted";
  readonly kind = "invariant_violation" as const;
  constructor(leadId: string) {
    super(`El candidato ${leadId} ya se ha convertido en alumno.`, { leadId });
  }
}

export class LeadAlreadyClosedError extends DomainError {
  readonly code = "lead_already_closed";
  readonly kind = "invariant_violation" as const;
  constructor(leadId: string, status: string) {
    super(`El candidato ${leadId} ya está cerrado y no admite esa operación.`, { leadId, status });
  }
}

/**
 * Tarea 14 (ola 1): importación de alumnado desde CSV.
 *
 * El fichero entero no se puede interpretar de forma fiable: faltan columnas
 * obligatorias, o el CSV está mal formado (una comilla sin cerrar, por
 * ejemplo). No es un error de fila —no hay filas fiables que analizar—, así
 * que aborta la importación entera antes de tocar nada, en vez de adivinar.
 */
export class InvalidImportFileError extends DomainError {
  readonly code = "invalid_import_file";
  readonly kind = "invalid_input" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

/**
 * Un mismo correo aparece en más de una fila del fichero. No se puede saber
 * cuál de las dos filas es la buena —pueden traer datos distintos—, así que
 * las dos se marcan como inválidas: mejor que la escuela decida a mano cuál
 * de las dos es la correcta a que la importación elija una en su lugar.
 */
export class DuplicateEmailInImportError extends DomainError {
  readonly code = "duplicate_email_in_import";
  readonly kind = "invalid_input" as const;
  constructor(email: string) {
    super(`El correo «${email}» aparece en más de una fila del fichero.`, { email });
  }
}

/**
 * Un campo de una fila del CSV no es válido: vacío cuando es obligatorio,
 * con un formato que no se reconoce, o con un valor fuera del conjunto
 * aceptado (un nivel MCER inventado, un parentesco que no es ninguno de los
 * cuatro conocidos). `reason` viaja en `details` para quien consuma la API,
 * nunca en el mensaje traducido: varía en cada instancia y `messages.ts` no
 * puede traducir un texto libre, así que el mensaje se queda genérico, igual
 * que hace `invalid_time_slot`.
 */
export class InvalidImportFieldError extends DomainError {
  readonly code = "invalid_import_field";
  readonly kind = "invalid_input" as const;
  constructor(field: string, reason: string) {
    super(`El campo «${field}» de la fila no es válido: ${reason}.`, { field, reason });
  }
}
