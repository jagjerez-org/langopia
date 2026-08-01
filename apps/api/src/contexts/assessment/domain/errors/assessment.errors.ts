import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/** El dominio acepta 1 a 5, ambos inclusive: fuera de ahí no hay valoración que registrar. */
export class InvalidProgressRatingError extends DomainError {
  readonly code = "invalid_progress_rating";
  readonly kind = "invalid_input" as const;

  constructor(rating: number) {
    super("La puntuación de progreso debe estar entre 1 y 5.", { rating });
  }
}

/**
 * No se valora lo que aún no ha pasado: el periodo tiene que haber terminado
 * ya cuando se registra la valoración.
 */
export class EvaluationPeriodInFutureError extends DomainError {
  readonly code = "evaluation_period_in_future";
  readonly kind = "invariant_violation" as const;

  constructor(periodEnd: Date, now: Date) {
    super("No se puede valorar un periodo que todavía no ha terminado: termina en el futuro.", {
      periodEnd: periodEnd.toISOString(),
      now: now.toISOString(),
    });
  }
}

/**
 * Pasados los 7 días de revisión, el historial pedagógico queda congelado: no
 * se reescribe indefinidamente.
 */
export class EvaluationFrozenError extends DomainError {
  readonly code = "evaluation_frozen";
  readonly kind = "invariant_violation" as const;

  constructor(evaluationId: string, createdAt: Date, now: Date) {
    super("Esta valoración ya está congelada: han pasado más de 7 días desde que se creó.", {
      evaluationId,
      createdAt: createdAt.toISOString(),
      now: now.toISOString(),
    });
  }
}

/**
 * Dos valoraciones del mismo profesor al mismo alumno no pueden solaparse en
 * el tiempo: si no, «la última valoración» deja de tener sentido.
 */
export class EvaluationPeriodOverlapError extends DomainError {
  readonly code = "evaluation_period_overlap";
  readonly kind = "conflict" as const;

  constructor(teacherProfileId: string, studentProfileId: string, conflictingEvaluationId: string) {
    super("Ya existe otra valoración de este profesor a este alumno que se solapa con ese periodo.", {
      teacherProfileId,
      studentProfileId,
      conflictingEvaluationId,
    });
  }
}

/**
 * Solo valora un profesor que de verdad haya impartido clase a ese alumno en
 * ese periodo (`TeachesStudentPort`, hacia `scheduling`). El fallo por
 * defecto es denegar.
 */
export class TeacherDoesNotTeachStudentError extends DomainError {
  readonly code = "teacher_does_not_teach_student";
  readonly kind = "forbidden" as const;

  constructor(teacherProfileId: string, studentProfileId: string) {
    super("Este profesor no ha impartido clase a este alumno en el periodo indicado.", {
      teacherProfileId,
      studentProfileId,
    });
  }
}

/**
 * El progreso de un alumno es un dato personal, a veces de un menor (tarea
 * 16 de la ola 2): solo lo ve el propio alumno, su tutor legal, dirección y
 * SU profesor — nunca cualquier profesor de la escuela. Reutiliza el mismo
 * hecho que `TeachesStudentPort` ya resuelve para `EvaluateStudentHandler`
 * (`teachesStudent`), sin acotar a un periodo: consultar el progreso no es
 * un hecho fechado como una valoración.
 */
export class TeacherCannotViewStudentProgressError extends DomainError {
  readonly code = "teacher_cannot_view_student_progress";
  readonly kind = "forbidden" as const;

  constructor(studentProfileId: string) {
    super("Este profesor no da clase a este alumno: no puede ver su progreso.", {
      studentProfileId,
    });
  }
}

/**
 * La otra mitad de la misma tarea: un alumno o un tutor legal que pide el
 * progreso de alguien que no es él ni tutela. `StudentMinorPort.
 * isSelfOrGuardian` (hacia `people`) decide el hecho; este error solo lo
 * cita, igual que `portal_access_denied` ya hace para el resto del portal —
 * nunca alguien de otra familia, aunque sea de la misma escuela.
 */
export class StudentProgressAccessDeniedError extends DomainError {
  readonly code = "student_progress_access_denied";
  readonly kind = "forbidden" as const;

  constructor(studentProfileId: string) {
    super("No puedes ver el progreso de un alumno que no eres tú ni tutelas.", {
      studentProfileId,
    });
  }
}

/* ─── Intentos (Tarea 7 de la ola 2) ────────────────────────────────────── */

/**
 * Los reintentos tienen tope: `maxAttempts` lo fija el ejercicio, no el
 * intento. Superarlo no es un aviso, es un intento que no debería existir.
 */
export class MaxAttemptsExceededError extends DomainError {
  readonly code = "max_attempts_exceeded";
  readonly kind = "invariant_violation" as const;

  constructor(exerciseId: string, attemptNumber: number, maxAttempts: number) {
    super(
      `El ejercicio ${exerciseId} admite como máximo ${maxAttempts} intento(s), y este sería el ${attemptNumber}.`,
      { exerciseId, attemptNumber, maxAttempts },
    );
  }
}

/**
 * `Attempt` es una máquina de estados: `submitted` → `ai_graded` →
 * `teacher_validated`, con `returned` como bifurcación de vuelta al alumno.
 * Cada método (`gradeWithAi`, `validate`, `returnToStudent`) solo vale desde
 * los estados de los que de verdad puede partir.
 */
export class InvalidAttemptStateError extends DomainError {
  readonly code = "invalid_attempt_state";
  readonly kind = "invariant_violation" as const;

  constructor(attemptId: string, action: string, from: string) {
    super(`El intento ${attemptId} no admite «${action}» desde el estado «${from}».`, {
      attemptId,
      action,
      from,
    });
  }
}

/** Una nota —de la IA o del profesor— no puede ser negativa ni infinita. */
export class InvalidAttemptScoreError extends DomainError {
  readonly code = "invalid_attempt_score";
  readonly kind = "invalid_input" as const;

  constructor(score: number) {
    super(`La puntuación ${score} no es válida: debe ser un número finito y no negativo.`, { score });
  }
}

/** Un intento sin respuesta no es un intento: no hay nada que corregir. */
export class EmptyAttemptResponseError extends DomainError {
  readonly code = "empty_attempt_response";
  readonly kind = "invalid_input" as const;

  constructor(exerciseId: string) {
    super(`El intento sobre el ejercicio ${exerciseId} no trae ninguna respuesta.`, { exerciseId });
  }
}

/**
 * `byCriterion` tiene que traer EXACTAMENTE los criterios de la rúbrica: ni
 * uno inventado, ni uno omitido. Mismo criterio que ya aplica
 * `ClaudeContentGeneratorAdapter.correctWriting` en `learning`, pero
 * comprobado aquí de nuevo porque `assessment` no se fía a ciegas de lo que
 * devuelve su propio corrector externo.
 */
export class RubricScoreMismatchError extends DomainError {
  readonly code = "rubric_score_mismatch";
  readonly kind = "invalid_input" as const;

  constructor(rubricCode: string, expected: string[], received: string[]) {
    super(
      `La corrección de la rúbrica «${rubricCode}» debe traer exactamente los criterios ` +
        `${expected.join(", ")}, y trae ${received.join(", ")}.`,
      { rubricCode, expected, received },
    );
  }
}

/**
 * `POST /assessments/attempts` (tarea 12 de la ola 2: «hacer ejercicios»)
 * también lo puede llamar el propio alumno o su tutor legal, resolviendo su
 * propio `studentProfileId` — pero enviar la respuesta EN NOMBRE de otro
 * alumno (aunque sea de la misma escuela) no es autoservicio, es suplantar.
 * `SubmitAttemptHandler` lo comprueba con `StudentMinorPort.isSelfOrGuardian`
 * únicamente cuando quien llama no es dirección ni profesorado (que sí puede
 * digitalizar la respuesta de cualquier alumno, como ya hacía antes de esta
 * tarea).
 */
export class AttemptAccessDeniedError extends DomainError {
  readonly code = "attempt_access_denied";
  readonly kind = "forbidden" as const;

  constructor(studentProfileId: string) {
    super("No puedes enviar una respuesta en nombre de un alumno que no eres tú ni tutelas.", {
      studentProfileId,
    });
  }
}

/* ─── Prueba de nivelación adaptativa (Tarea 8 de la ola 2) ─────────────── */

/**
 * `PlacementTest` es una prueba de una sola sentada: `answer()` no admite
 * nada más una vez que el algoritmo decidió el nivel (estabilidad de seis
 * preguntas, o el tope de treinta).
 */
export class PlacementTestAlreadyFinishedError extends DomainError {
  readonly code = "placement_test_already_finished";
  readonly kind = "invariant_violation" as const;

  constructor(placementTestId: string) {
    super(`La prueba de nivelación ${placementTestId} ya ha terminado: no admite más respuestas.`, {
      placementTestId,
    });
  }
}

/**
 * El identificador de la URL y el de la prueba reconstruida a partir del
 * estado que envía el cliente no coinciden: alguien está mezclando dos
 * pruebas de nivelación en la misma petición.
 */
export class PlacementTestIdMismatchError extends DomainError {
  readonly code = "placement_test_id_mismatch";
  readonly kind = "invalid_input" as const;

  constructor(expected: string, received: string) {
    super(`La prueba de nivelación ${expected} no coincide con el estado recibido (${received}).`, {
      expected,
      received,
    });
  }
}

/**
 * No queda ningún ítem del banco de nivelación —de este idioma— que la
 * prueba no haya usado ya. Con 120 ítems calibrados y un máximo de 30
 * preguntas no debería ocurrir en condiciones normales; si ocurre, mejor
 * frenar la prueba que repetir preguntas sin avisar.
 */
export class PlacementBankExhaustedError extends DomainError {
  readonly code = "placement_bank_exhausted";
  readonly kind = "conflict" as const;

  constructor(language: string) {
    super(`No quedan ítems del banco de nivelación para el idioma «${language}».`, { language });
  }
}

/* ─── Exámenes (Tarea 15 de la ola 2) ────────────────────────────────────── */

/** Un examen se genera a partir de unidades ya publicadas: sin ninguna, no hay de qué examinar. */
export class ExamRequiresSourceUnitsError extends DomainError {
  readonly code = "exam_requires_source_units";
  readonly kind = "invalid_input" as const;

  constructor() {
    super("Un examen necesita al menos una unidad de origen.");
  }
}

/**
 * Examinar de contenido que el alumno no ha visto todavía es el motivo más
 * habitual de reclamación: un examen solo puede generarse desde unidades
 * `published`.
 */
export class ExamSourceUnitNotPublishedError extends DomainError {
  readonly code = "exam_source_unit_not_published";
  readonly kind = "invariant_violation" as const;

  constructor(contentUnitId: string, status: string) {
    super(
      `La unidad ${contentUnitId} no está publicada (estado: «${status}»): no puede formar parte de un examen.`,
      { contentUnitId, status },
    );
  }
}

/** El reparto de destrezas del examen tiene que sumar el 100 %, ni más ni menos. */
export class ExamSkillDistributionInvalidError extends DomainError {
  readonly code = "exam_skill_distribution_invalid";
  readonly kind = "invalid_input" as const;

  constructor(sum: number) {
    super(`El reparto de destrezas debe sumar 100 %, y suma ${sum}.`, { sum });
  }
}

/** Un examen sin ningún ítem no es un examen. */
export class ExamHasNoItemsError extends DomainError {
  readonly code = "exam_has_no_items";
  readonly kind = "invalid_input" as const;

  constructor() {
    super("El examen no tiene ningún ítem generado.");
  }
}

/** `mock_official` simula un examen real (DELE, Cambridge, Goethe): sin decir cuál, no hay estructura que imitar. */
export class ExamMockFrameworkRequiredError extends DomainError {
  readonly code = "exam_mock_framework_required";
  readonly kind = "invalid_input" as const;

  constructor() {
    super("Un examen «mock_official» necesita indicar qué examen real simula (DELE, Cambridge, Goethe...).");
  }
}

/**
 * Un ítem del examen es una copia literal de un ejercicio de práctica ya
 * existente: reutilizarlo mide memoria, no aprendizaje (regla de la ola,
 * verbatim del brief).
 */
export class ExamItemDuplicatesPracticeError extends DomainError {
  readonly code = "exam_item_duplicates_practice";
  readonly kind = "invariant_violation" as const;

  constructor(itemId: string, sourceExerciseId: string) {
    super(
      `El ítem ${itemId} del examen es una copia literal del ejercicio de práctica ${sourceExerciseId}: hace falta una variante, no el mismo contenido.`,
      { itemId, sourceExerciseId },
    );
  }
}

/** `Exam` es una máquina de estados: cada método solo vale desde los estados de los que de verdad puede partir. */
export class InvalidExamStateError extends DomainError {
  readonly code = "invalid_exam_state";
  readonly kind = "invariant_violation" as const;

  constructor(examId: string, action: string, from: string) {
    super(`El examen ${examId} no admite «${action}» desde el estado «${from}».`, {
      examId,
      action,
      from,
    });
  }
}

/** Un examen entregado sin ninguna respuesta no tiene nada que corregir. */
export class EmptyExamSubmissionError extends DomainError {
  readonly code = "empty_exam_submission";
  readonly kind = "invalid_input" as const;

  constructor(examId: string) {
    super(`El examen ${examId} se entrega sin ninguna respuesta.`, { examId });
  }
}

/** Una nota —de la IA o del profesor— no puede ser negativa ni infinita. */
export class InvalidExamScoreError extends DomainError {
  readonly code = "invalid_exam_score";
  readonly kind = "invalid_input" as const;

  constructor(score: number) {
    super(`La puntuación ${score} no es válida: debe ser un número finito y no negativo.`, { score });
  }
}

/** No se programa un examen en el pasado. */
export class ExamScheduledInPastError extends DomainError {
  readonly code = "exam_scheduled_in_past";
  readonly kind = "invalid_input" as const;

  constructor(scheduledFor: Date, now: Date) {
    super("No se puede programar un examen en una fecha que ya ha pasado.", {
      scheduledFor: scheduledFor.toISOString(),
      now: now.toISOString(),
    });
  }
}

/**
 * Copia propia de `learning/domain/errors/learning.errors.ts`
 * (`InsufficientCreditsError`): assessment no importa ese fichero
 * (`ARCHITECTURE.md`), y generar un examen con IA gasta créditos igual que
 * generar una unidad. Mismo `code` a propósito —es el mismo error de
 * negocio, «no hay créditos suficientes»— así que ya tiene su traducción en
 * los cinco idiomas y su ejemplar en `i18n-coverage.spec.ts`: no hace falta
 * añadir ninguno de los dos.
 */
export class InsufficientCreditsError extends DomainError {
  readonly code = "insufficient_credits";
  readonly kind = "invariant_violation" as const;

  constructor(schoolId: string, requestedCredits: number, availableCredits: number) {
    super("No hay créditos suficientes para generar contenido con IA.", {
      schoolId,
      requestedCredits,
      availableCredits,
    });
  }
}

/** Copia propia de `InvalidCreditAmountError` (`learning`), mismo motivo que la anterior. */
export class InvalidCreditAmountError extends DomainError {
  readonly code = "invalid_credit_amount";
  readonly kind = "invalid_input" as const;

  constructor(credits: number) {
    super("La cantidad de créditos debe ser un entero positivo.", { credits });
  }
}

/**
 * La generación del examen falló dos veces seguidas (la regla de la ola: un
 * reintento con el error como contexto, y si el segundo también falla, se
 * marca como fallida). Ningún examen a medio generar llega al alumnado.
 */
export class ExamGenerationRejectedError extends DomainError {
  readonly code = "exam_generation_rejected";
  readonly kind = "conflict" as const;

  constructor(reason: string) {
    super(`La generación del examen no se pudo completar: ${reason}`, { reason });
  }
}

/**
 * Sin actor conocido no hay a quién cargarle el coste de generar un examen,
 * ni con qué firma registrar quién lo valida — mismo criterio que
 * `MissingActorError` (`scheduling`, `assessment/validate-attempt`).
 */
export class MissingExamActorError extends DomainError {
  readonly code = "missing_exam_actor";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Esta acción sobre un examen requiere saber quién la pide.");
  }
}
