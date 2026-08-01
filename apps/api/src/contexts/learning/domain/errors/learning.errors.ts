import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/** Publicar un contenedor vacío es el error más fácil de cometer, y el más visible para el alumno. */
export class ContentUnitHasNoExercisesError extends DomainError {
  readonly code = "content_unit_has_no_exercises";
  readonly kind = "invariant_violation" as const;

  constructor(contentUnitId: string) {
    super("No se puede publicar una unidad sin ejercicios.", { contentUnitId });
  }
}

export class ContentUnitAlreadyPublishedError extends DomainError {
  readonly code = "content_unit_already_published";
  readonly kind = "conflict" as const;

  constructor(contentUnitId: string) {
    super("Esta unidad ya está publicada.", { contentUnitId });
  }
}

/** Una unidad archivada no vuelve atrás: ni se publica, ni se reenvía a revisión, ni se archiva otra vez. */
export class ContentUnitArchivedError extends DomainError {
  readonly code = "content_unit_archived";
  readonly kind = "invariant_violation" as const;

  constructor(contentUnitId: string, attempted: string) {
    super(`No se puede ${attempted} una unidad archivada.`, { contentUnitId, attempted });
  }
}

export class ContentUnitNotInDraftError extends DomainError {
  readonly code = "content_unit_not_in_draft";
  readonly kind = "invariant_violation" as const;

  constructor(contentUnitId: string, status: string) {
    super(`No se puede enviar a revisión una unidad en estado «${status}».`, {
      contentUnitId,
      status,
    });
  }
}

/**
 * El agregado no consulta el curso: quien lo asocia (el manejador del
 * comando, que sí tiene puerto hacia `catalog`) le entrega el nivel del curso
 * ya resuelto, y esta comprobación es puramente aritmética sobre ese dato.
 */
export class ContentUnitLevelMismatchError extends DomainError {
  readonly code = "content_unit_level_mismatch";
  readonly kind = "invalid_input" as const;

  constructor(unitLevel: string, courseLevel: string) {
    super(
      `El nivel de la unidad (${unitLevel}) no coincide con el del curso al que se asocia (${courseLevel}).`,
      { unitLevel, courseLevel },
    );
  }
}

/**
 * Tarea 6: `learning` necesita rechazar una generación sin créditos, pero no
 * puede importar `billing/domain/errors/billing.errors.ts` —cruzaría la
 * frontera entre contextos (`ARCHITECTURE.md`, «un contexto no despacha el
 * comando de otro»)—. Este error es la traducción a su propio lenguaje, vía
 * `CreditLedgerPort` (`infrastructure/acl/billing-credit-ledger.adapter.ts`),
 * del mismo rechazo que ya existe en `CreditBalance.spend()`. Mismo `code` y
 * mismo mensaje a propósito: de cara al cliente de la API es exactamente el
 * mismo error, lo lance quien lo lance.
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

/**
 * `CreditLedgerPort.spend()`/`refund()` se pidieron con una cantidad de
 * créditos que no es un entero positivo. Mismo criterio que
 * `InsufficientCreditsError`: mismo `code` que `InvalidCreditAmountError` de
 * `billing`, sin importar su clase.
 */
export class InvalidCreditAmountError extends DomainError {
  readonly code = "invalid_credit_amount";
  readonly kind = "invalid_input" as const;

  constructor(credits: number) {
    super("La cantidad de créditos debe ser un entero positivo.", { credits });
  }
}

/**
 * La generación de la unidad falló entre el paso 3 (generar y validar texto y
 * ejercicios) y el 6 (ajustar créditos): dos intentos de salida estructurada
 * inválida seguidos, un ejercicio que no cumple una regla transversal (sin
 * rúbrica, sin recurso de audio...), o cualquier otro fallo en ese tramo. Los
 * créditos reservados ya se han devuelto cuando esto se lanza — ver
 * `GenerateUnitHandler`.
 */
export class UnitGenerationFailedError extends DomainError {
  readonly code = "unit_generation_failed";
  readonly kind = "conflict" as const;

  constructor(code: string, reason: string) {
    super(`No se pudo generar la unidad «${code}»: ${reason}`, { code, reason });
  }
}

/** Publicar exige un revisor de carne y hueso (`ContentUnit.publish()`); sin membresía efectiva no hay quien firme. */
export class MissingReviewerError extends DomainError {
  readonly code = "missing_reviewer";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Publicar una unidad requiere saber quién la revisa y firma.");
  }
}

/**
 * Tarea 14 de la ola 2: `POST /learning/units/from-material` exige un
 * material ya indexado —con texto extraído y fragmentos con embedding—, no
 * solo subido. Se lanza tanto si el material es de un formato sin texto
 * (jpg, mp3...) como si es pdf/docx pero la indexación falló o está
 * pendiente (por ejemplo, sin proveedor de embeddings configurado en este
 * entorno).
 */
export class MaterialNotIndexedError extends DomainError {
  readonly code = "material_not_indexed";
  readonly kind = "invalid_input" as const;

  constructor(materialId: string) {
    super(
      `El material ${materialId} no está indexado todavía: no se puede generar una unidad a partir ` +
        "de él hasta que tenga texto extraído y fragmentos indexados.",
      { materialId },
    );
  }
}

/**
 * Publicar a grupos (tarea 11 del panel, Paso 4): una unidad se asocia a UN
 * curso, así que los grupos elegidos tienen que ser todos del mismo. Si no,
 * la mitad de la selección se quedaría fuera en silencio — y el profesor
 * creería que publicó a los cinco grupos cuando solo llegó a dos.
 */
export class UnitGroupsMultipleCoursesError extends DomainError {
  readonly code = "unit_groups_multiple_courses";
  readonly kind = "invalid_input" as const;

  constructor(courseCount: number) {
    super(
      `Los grupos elegidos son de ${courseCount} cursos distintos: una unidad se publica a los ` +
        "grupos de un solo curso. Publícala una vez por curso.",
      { courseCount },
    );
  }
}

/**
 * `SrsCard.review()` (tarea 9, repetición espaciada con SM-2) exige una
 * calificación de 0 (fallo total) a 5 (perfecta), como en el algoritmo
 * original: no es una nota sobre `maxScore`, es la escala propia de SM-2.
 */
export class InvalidReviewQualityError extends DomainError {
  readonly code = "invalid_review_quality";
  readonly kind = "invalid_input" as const;

  constructor(quality: number) {
    super(`La calificación de un repaso debe ser un entero entre 0 y 5 (recibido: ${quality}).`, {
      quality,
    });
  }
}

/**
 * `GET /learning/students/:studentId/due-cards` (tarea 12 de la ola 2: panel
 * y portal — hacer ejercicios) enseña qué ejercicios ha fallado un alumno
 * concreto: un dato que ata a un menor de edad con sus fallos, así que solo
 * él mismo o su tutor legal pueden pedirlo (`StudentSelfPort.
 * isSelfOrGuardian`, hacia `people`) — nunca otro alumno, ni siquiera de la
 * misma escuela.
 */
export class DueCardsAccessDeniedError extends DomainError {
  readonly code = "due_cards_access_denied";
  readonly kind = "forbidden" as const;

  constructor(studentProfileId: string) {
    super("No puedes ver el repaso de un alumno que no eres tú ni tutelas.", {
      studentProfileId,
    });
  }
}
