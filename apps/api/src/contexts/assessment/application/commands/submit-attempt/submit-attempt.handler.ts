import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { scoreAutomatically } from "../../../domain/model/automatic-grading.js";
import { Attempt } from "../../../domain/model/attempt.aggregate.js";
import { Rubric } from "../../../domain/model/rubric.vo.js";
import { AttemptAccessDeniedError } from "../../../domain/errors/assessment.errors.js";
import { AttemptId, ExerciseId, StudentId } from "../../../domain/model/identifiers.js";
import {
  ATTEMPT_REPOSITORY,
  type AttemptRepository,
} from "../../../domain/ports/attempt.repository.port.js";
import {
  EXERCISE_SOURCE_PORT,
  type ExerciseSourceInfo,
  type ExerciseSourcePort,
} from "../../../domain/ports/exercise-source.port.js";
import {
  STUDENT_MINOR_PORT,
  type StudentMinorPort,
} from "../../../domain/ports/student-minor.port.js";
import {
  WRITING_CORRECTOR_PORT,
  type WritingCorrectorPort,
} from "../../../domain/ports/writing-corrector.port.js";
import { SubmitAttemptCommand, type SubmitAttemptResult } from "./submit-attempt.command.js";

/** Roles de confianza: pueden digitalizar la respuesta de CUALQUIER alumno (ya el comportamiento anterior a la tarea 12). */
const TRUSTED_ROLES = ["owner", "admin", "teacher"];

/** Lo que hace falta para registrar una propuesta de nota, calculada por el camino que sea. */
type GradingOutcome = {
  score: number;
  feedback: string;
  rubricScores: Record<string, number> | null;
  model: string | null;
  costCents: number;
};

/**
 * Manejador del comando.
 *
 * Coreografía en dos tiempos, cada uno su propia transacción:
 *
 *   1. Cargar el ejercicio (`ExerciseSourcePort`), calcular el `attemptNumber`
 *      siguiente y pedirle a `Attempt.submit()` que compruebe el tope de
 *      reintentos. Se guarda y se publica `AttemptSubmitted`.
 *   2. Disparar la corrección: por rúbrica (`WritingCorrectorPort`, para
 *      `written_production`/`spoken_production` con texto) o automática
 *      (`scoreAutomatically`, para el resto). Si ninguna aplica —o la
 *      corrección por IA falla, por ejemplo sin `ANTHROPIC_API_KEY`— el
 *      intento se queda en `submitted`: el profesor puede validarlo
 *      directamente, `Attempt.validate()` lo admite desde ahí. Nunca se deja
 *      sin persistir el intento ya enviado por no poder corregirlo.
 *
 * Separar los dos pasos evita mantener abierta una transacción de base de
 * datos mientras se espera a un proveedor externo.
 */
@CommandHandler(SubmitAttemptCommand)
export class SubmitAttemptHandler implements ICommandHandler<SubmitAttemptCommand> {
  constructor(
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: AttemptRepository,
    @Inject(EXERCISE_SOURCE_PORT) private readonly exercises: ExerciseSourcePort,
    @Inject(WRITING_CORRECTOR_PORT) private readonly corrector: WritingCorrectorPort,
    @Inject(STUDENT_MINOR_PORT) private readonly studentMinor: StudentMinorPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @InjectPinoLogger(SubmitAttemptHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: SubmitAttemptCommand): Promise<SubmitAttemptResult> {
    const { props } = command;
    const now = this.clock.now();
    const exerciseId = ExerciseId.of(props.exerciseId);

    const { attempt, exerciseInfo } = await this.uow.execute(async () => {
      // Dentro de la transacción, y lo primero: la comprobación lee
      // `student_profiles`/`guardians`, y fuera de `uow` no hay
      // `app.school_id` fijado — RLS devolvería vacío y la guarda diría «no
      // eres tú» hasta al propio alumno. Sigue ocurriendo ANTES de crear
      // ningún intento.
      await this.assertCanActAsStudent(props.studentProfileId);

      const info = await this.exercises.get(exerciseId);
      if (!info) throw new NotFoundError("el ejercicio", exerciseId.value);

      const previousCount = await this.attempts.countForExerciseAndStudent({
        exerciseId,
        studentProfileId: props.studentProfileId,
      });

      const created = Attempt.submit({
        id: AttemptId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        exerciseId,
        studentProfileId: props.studentProfileId,
        sessionId: props.sessionId ?? null,
        assessmentId: props.assessmentId ?? null,
        attemptNumber: previousCount + 1,
        maxAttempts: info.maxAttempts,
        response: props.response,
        startedAt: props.startedAt ? new Date(props.startedAt) : null,
        durationMs: props.durationMs ?? null,
        now,
      });

      await this.attempts.save(created);
      return { attempt: created, exerciseInfo: info };
    });

    await this.events.publish(attempt.pullDomainEvents());

    const graded = await this.grade(attempt, exerciseInfo, now);
    return {
      attemptId: graded.id.value,
      status: graded.status,
      aiScore: graded.aiScore,
      aiFeedback: graded.aiFeedback,
      maxScore: exerciseInfo.maxScore,
      requiresTeacherValidation: exerciseInfo.requiresTeacherValidation,
    };
  }

  /**
   * Autoservicio del alumno (tarea 12 de la ola 2): dirección y profesorado
   * pueden digitalizar la respuesta de CUALQUIER alumno de la escuela —el
   * comportamiento de siempre—, pero un alumno o su tutor legal solo pueden
   * enviar la suya propia o la de su tutelado (`StudentMinorPort.
   * isSelfOrGuardian`, mismo criterio que ya aplica `GetStudentProgressHandler`,
   * tarea 16). Sin membresía resuelta (caso defensivo), se rechaza igual.
   */
  private async assertCanActAsStudent(studentProfileId: string): Promise<void> {
    if (this.tenant.roles().some((role) => TRUSTED_ROLES.includes(role))) return;

    const membershipId = this.tenant.membershipId();
    const allowed =
      membershipId != null &&
      (await this.studentMinor.isSelfOrGuardian({
        membershipId,
        studentId: StudentId.of(studentProfileId),
      }));
    if (!allowed) throw new AttemptAccessDeniedError(studentProfileId);
  }

  private async grade(attempt: Attempt, info: ExerciseSourceInfo, now: Date): Promise<Attempt> {
    let outcome: GradingOutcome | null;
    try {
      outcome = info.rubricId
        ? await this.gradeByRubric(attempt, info)
        : info.solution
          ? this.gradeAutomatically(attempt, info)
          : null;
    } catch (error) {
      // La IA propone; si no puede proponer nada (sin clave, salida que no
      // valida dos veces...), el profesor firma igual desde `submitted` —
      // `Attempt.validate()` lo admite. No se deja el intento sin persistir.
      this.logger.warn(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo corregir automáticamente el intento ${attempt.id.value}: queda pendiente de validación directa del profesor.`,
      );
      return attempt;
    }

    if (!outcome) return attempt;

    const graded = await this.uow.execute(async () => {
      const found = await this.attempts.findOrFail(attempt.id);
      found.gradeWithAi({ ...outcome, now });
      await this.attempts.save(found);
      return found;
    });
    await this.events.publish(graded.pullDomainEvents());
    return graded;
  }

  /** `written_production`/`spoken_production`: solo si hay texto que corregir (audio queda pendiente de validación manual). */
  private async gradeByRubric(attempt: Attempt, info: ExerciseSourceInfo): Promise<GradingOutcome | null> {
    const responseText = attempt.response["text"];
    if (typeof responseText !== "string" || responseText.length === 0) return null;

    const rubric = Rubric.reconstitute({
      id: info.rubricId!,
      code: info.rubricCode!,
      maxScore: info.rubricMaxScore ?? info.maxScore,
      criteria: info.rubricCriteria ?? [],
    });

    const result = await this.corrector.correct({
      task: info.task ?? "",
      response: responseText,
      rubric: { criteria: rubric.criteria },
      language: info.language,
      level: info.level,
    });

    return {
      score: rubric.weightedScore(result.byCriterion),
      feedback: result.feedback,
      rubricScores: result.byCriterion,
      model: result.cost.model,
      costCents: result.cost.costCents,
    };
  }

  private gradeAutomatically(attempt: Attempt, info: ExerciseSourceInfo): GradingOutcome {
    const result = scoreAutomatically(attempt.response, info.solution!, info.maxScore);
    return { score: result.score, feedback: result.feedback, rubricScores: null, model: null, costCents: 0 };
  }
}
