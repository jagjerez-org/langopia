import { Module } from "@nestjs/common";
import { AnswerPlacementTestHandler } from "./application/commands/answer-placement-test/answer-placement-test.handler.js";
import { EvaluateStudentHandler } from "./application/commands/evaluate-student/evaluate-student.handler.js";
import { GenerateExamHandler } from "./application/commands/generate-exam/generate-exam.handler.js";
import { GradeExamHandler } from "./application/commands/grade-exam/grade-exam.handler.js";
import { ReturnAttemptHandler } from "./application/commands/return-attempt/return-attempt.handler.js";
import { StartExamHandler } from "./application/commands/start-exam/start-exam.handler.js";
import { StartPlacementTestHandler } from "./application/commands/start-placement-test/start-placement-test.handler.js";
import { SubmitAttemptHandler } from "./application/commands/submit-attempt/submit-attempt.handler.js";
import { SubmitExamHandler } from "./application/commands/submit-exam/submit-exam.handler.js";
import { ValidateAttemptHandler } from "./application/commands/validate-attempt/validate-attempt.handler.js";
import { ValidateExamHandler } from "./application/commands/validate-exam/validate-exam.handler.js";
import { NotifyOverdueAttemptsJob } from "./application/jobs/notify-overdue-attempts.job.js";
import { OnLeadCapturedStartPlacement } from "./application/event-handlers/on-lead-captured.handler.js";
import { ASSESSMENT_READ_MODEL } from "./application/ports/assessment-read-model.port.js";
import { STUDENT_PROGRESS_READ_MODEL } from "./application/ports/student-progress-read-model.port.js";
import { GetExamHandler } from "./application/queries/get-exam/get-exam.handler.js";
import { GetExercisesToDoHandler } from "./application/queries/get-exercises-to-do/get-exercises-to-do.handler.js";
import { GetPendingAttemptsHandler } from "./application/queries/get-pending-attempts/get-pending-attempts.handler.js";
import { GetStudentProgressHandler } from "./application/queries/get-student-progress/get-student-progress.handler.js";
import { GetStudentsWithoutEvaluationHandler } from "./application/queries/get-students-without-evaluation/get-students-without-evaluation.handler.js";
import { AI_GENERATION_REPOSITORY } from "./domain/ports/ai-generation.repository.port.js";
import { ATTEMPT_REPOSITORY } from "./domain/ports/attempt.repository.port.js";
import { CREDIT_LEDGER_PORT } from "./domain/ports/credit-ledger.port.js";
import { EVALUATION_REPOSITORY } from "./domain/ports/evaluation.repository.port.js";
import { EXAM_GENERATOR_PORT } from "./domain/ports/exam-generator.port.js";
import { EXAM_REPOSITORY } from "./domain/ports/exam.repository.port.js";
import { EXERCISE_SOURCE_PORT } from "./domain/ports/exercise-source.port.js";
import { PLACEMENT_BANK_PORT } from "./domain/ports/placement-bank.port.js";
import { SCHOOL_DIRECTORY } from "./domain/ports/school-directory.port.js";
import { STUDENT_MINOR_PORT } from "./domain/ports/student-minor.port.js";
import { TEACHES_STUDENT_PORT } from "./domain/ports/teaches-student.port.js";
import { WRITING_CORRECTOR_PORT } from "./domain/ports/writing-corrector.port.js";
import { BillingCreditLedgerAdapter } from "./infrastructure/acl/billing-credit-ledger.adapter.js";
import { LearningExerciseSourceAdapter } from "./infrastructure/acl/learning-exercise-source.adapter.js";
import { PeopleStudentMinorAdapter } from "./infrastructure/acl/people-student-minor.adapter.js";
import { SchedulingTeachesStudentAdapter } from "./infrastructure/acl/scheduling-teaches-student.adapter.js";
import { ClaudeExamGeneratorAdapter } from "./infrastructure/external/claude-exam-generator.adapter.js";
import { ClaudeWritingCorrectorAdapter } from "./infrastructure/external/claude-writing-corrector.adapter.js";
import { AttemptsController } from "./infrastructure/http/attempts.controller.js";
import { EvaluationsController } from "./infrastructure/http/evaluations.controller.js";
import { ExamsController } from "./infrastructure/http/exams.controller.js";
import { PlacementTestController } from "./infrastructure/http/placement.controller.js";
import { StudentProgressController } from "./infrastructure/http/student-progress.controller.js";
import { DrizzleAiGenerationRepository } from "./infrastructure/persistence/drizzle-ai-generation.repository.js";
import { DrizzleAssessmentReadModel } from "./infrastructure/persistence/drizzle-assessment-read-model.js";
import { DrizzleAttemptRepository } from "./infrastructure/persistence/drizzle-attempt.repository.js";
import { DrizzleCreditLedgerRepository } from "./infrastructure/persistence/drizzle-credit-ledger.repository.js";
import { DrizzleEvaluationRepository } from "./infrastructure/persistence/drizzle-evaluation.repository.js";
import { DrizzleExamRepository } from "./infrastructure/persistence/drizzle-exam.repository.js";
import { DrizzleExerciseSourceRepository } from "./infrastructure/persistence/drizzle-exercise-source.repository.js";
import { DrizzlePlacementBankRepository } from "./infrastructure/persistence/drizzle-placement-bank.repository.js";
import { DrizzleSchoolDirectoryRepository } from "./infrastructure/persistence/drizzle-school-directory.repository.js";
import { DrizzleStudentMinorRepository } from "./infrastructure/persistence/drizzle-student-minor.repository.js";
import { DrizzleStudentProgressReadModel } from "./infrastructure/persistence/drizzle-student-progress-read-model.js";
import { DrizzleTeachesStudentRepository } from "./infrastructure/persistence/drizzle-teaches-student.repository.js";

const commandHandlers = [
  EvaluateStudentHandler,
  SubmitAttemptHandler,
  ValidateAttemptHandler,
  ReturnAttemptHandler,
  StartPlacementTestHandler,
  AnswerPlacementTestHandler,
  GenerateExamHandler,
  StartExamHandler,
  SubmitExamHandler,
  GradeExamHandler,
  ValidateExamHandler,
];
const queryHandlers = [
  GetStudentsWithoutEvaluationHandler,
  GetStudentProgressHandler,
  GetExamHandler,
  GetExercisesToDoHandler,
  GetPendingAttemptsHandler,
];

/**
 * Contexto acotado de valoración pedagógica del alumnado.
 *
 * El módulo es la frontera: aquí se declara qué adaptador cumple cada
 * puerto, y nada de esto sale fuera. `scheduling`, `people` y `learning` se
 * consultan solo a través de sus puertos (`TeachesStudentPort`,
 * `StudentMinorPort`, `ExerciseSourcePort`), nunca importando sus agregados.
 * `WritingCorrectorPort` es un proveedor externo propio de este contexto
 * (tarea 7 de la ola 2): no el `ContentGeneratorPort` de `learning`.
 * `PlacementBankPort` (tarea 8) es una tabla propia de `assessment`
 * (`placement_items`), no un cruce de contexto: se lee directo, sin ACL.
 */
@Module({
  controllers: [
    EvaluationsController,
    AttemptsController,
    PlacementTestController,
    StudentProgressController,
    ExamsController,
  ],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    NotifyOverdueAttemptsJob,
    OnLeadCapturedStartPlacement,
    DrizzleTeachesStudentRepository,
    DrizzleStudentMinorRepository,
    DrizzleExerciseSourceRepository,
    DrizzleCreditLedgerRepository,
    { provide: EVALUATION_REPOSITORY, useClass: DrizzleEvaluationRepository },
    { provide: ASSESSMENT_READ_MODEL, useClass: DrizzleAssessmentReadModel },
    { provide: STUDENT_PROGRESS_READ_MODEL, useClass: DrizzleStudentProgressReadModel },
    { provide: TEACHES_STUDENT_PORT, useClass: SchedulingTeachesStudentAdapter },
    { provide: STUDENT_MINOR_PORT, useClass: PeopleStudentMinorAdapter },
    { provide: ATTEMPT_REPOSITORY, useClass: DrizzleAttemptRepository },
    { provide: EXERCISE_SOURCE_PORT, useClass: LearningExerciseSourceAdapter },
    { provide: WRITING_CORRECTOR_PORT, useClass: ClaudeWritingCorrectorAdapter },
    { provide: SCHOOL_DIRECTORY, useClass: DrizzleSchoolDirectoryRepository },
    { provide: PLACEMENT_BANK_PORT, useClass: DrizzlePlacementBankRepository },
    { provide: EXAM_REPOSITORY, useClass: DrizzleExamRepository },
    { provide: AI_GENERATION_REPOSITORY, useClass: DrizzleAiGenerationRepository },
    { provide: CREDIT_LEDGER_PORT, useClass: BillingCreditLedgerAdapter },
    { provide: EXAM_GENERATOR_PORT, useClass: ClaudeExamGeneratorAdapter },
  ],
})
export class AssessmentModule {}
