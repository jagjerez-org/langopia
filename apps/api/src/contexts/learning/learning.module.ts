import { Module } from "@nestjs/common";
import { CreateUnitFromMaterialHandler } from "./application/commands/create-unit-from-material/create-unit-from-material.handler.js";
import { GenerateUnitHandler } from "./application/commands/generate-unit/generate-unit.handler.js";
import { PublishUnitHandler } from "./application/commands/publish-unit/publish-unit.handler.js";
import { UpdateExerciseHandler } from "./application/commands/update-exercise/update-exercise.handler.js";
import { UploadMaterialHandler } from "./application/commands/upload-material/upload-material.handler.js";
import { OnAttemptAiGraded } from "./application/event-handlers/on-attempt-ai-graded.handler.js";
import { OnClassVocabularyExtracted } from "./application/event-handlers/on-class-vocabulary-extracted.handler.js";
import { GetDueCardsHandler } from "./application/queries/get-due-cards/get-due-cards.handler.js";
import { GetGenerationEstimateHandler } from "./application/queries/get-generation-estimate/get-generation-estimate.handler.js";
import { GetPublishTargetsHandler } from "./application/queries/get-publish-targets/get-publish-targets.handler.js";
import { GetUnitDetailHandler } from "./application/queries/get-unit-detail/get-unit-detail.handler.js";
import { ListUnitsHandler } from "./application/queries/list-units/list-units.handler.js";
import { AI_GENERATION_REPOSITORY } from "./domain/ports/ai-generation.repository.port.js";
import { CONTENT_GENERATOR_PORT } from "./domain/ports/content-generator.port.js";
import { CONTENT_UNIT_REPOSITORY } from "./domain/ports/content-unit.repository.port.js";
import { CREDIT_LEDGER_PORT } from "./domain/ports/credit-ledger.port.js";
import { EMBEDDING_PROVIDER_PORT } from "./domain/ports/embedding-provider.port.js";
import { EXERCISE_REPOSITORY } from "./domain/ports/exercise.repository.port.js";
import { GROUP_COURSE_PORT } from "./domain/ports/group-course.port.js";
import { MATERIAL_REPOSITORY } from "./domain/ports/material.repository.port.js";
import { SCHOOL_CALENDAR_PORT } from "./domain/ports/school-calendar.port.js";
import { SRS_CARD_REPOSITORY } from "./domain/ports/srs-card.repository.port.js";
import { STUDENT_SELF_PORT } from "./domain/ports/student-self.port.js";
import { VIDEO_GENERATOR_PORT } from "./domain/ports/video-generator.port.js";
import { LEARNING_READ_MODEL } from "./application/ports/learning-read-model.port.js";
import { BillingCreditLedgerAdapter } from "./infrastructure/acl/billing-credit-ledger.adapter.js";
import { CatalogGroupCourseAdapter } from "./infrastructure/acl/catalog-group-course.adapter.js";
import { PeopleStudentSelfAdapter } from "./infrastructure/acl/people-student-self.adapter.js";
import { SchoolCalendarAdapter } from "./infrastructure/acl/school-calendar.adapter.js";
import { ClaudeContentGeneratorAdapter } from "./infrastructure/external/claude-content-generator.adapter.js";
import { EmbeddingAdapter } from "./infrastructure/external/embedding.adapter.js";
import { ContentAssetStorageAdapter } from "./infrastructure/external/storage.adapter.js";
import { TextExtractionAdapter } from "./infrastructure/external/text-extraction.adapter.js";
import { VideoAdapter } from "./infrastructure/external/video.adapter.js";
import { ExercisesController } from "./infrastructure/http/exercises.controller.js";
import { MaterialsController } from "./infrastructure/http/materials.controller.js";
import { UnitsController } from "./infrastructure/http/units.controller.js";
import { DrizzleAiGenerationRepository } from "./infrastructure/persistence/drizzle-ai-generation.repository.js";
import { DrizzleContentUnitRepository } from "./infrastructure/persistence/drizzle-content-unit.repository.js";
import { DrizzleCreditLedgerRepository } from "./infrastructure/persistence/drizzle-credit-ledger.repository.js";
import { DrizzleExerciseRepository } from "./infrastructure/persistence/drizzle-exercise.repository.js";
import { DrizzleGroupCourseRepository } from "./infrastructure/persistence/drizzle-group-course.repository.js";
import { DrizzleLearningReadModel } from "./infrastructure/persistence/drizzle-learning-read-model.js";
import { DrizzleMaterialRepository } from "./infrastructure/persistence/drizzle-material.repository.js";
import { DrizzleSchoolTimezoneRepository } from "./infrastructure/persistence/drizzle-school-timezone.repository.js";
import { DrizzleSrsCardRepository } from "./infrastructure/persistence/drizzle-srs-card.repository.js";
import { DrizzleStudentSelfRepository } from "./infrastructure/persistence/drizzle-student-self.repository.js";

const commandHandlers = [
  GenerateUnitHandler,
  PublishUnitHandler,
  UpdateExerciseHandler,
  UploadMaterialHandler,
  CreateUnitFromMaterialHandler,
];
const queryHandlers = [
  GetDueCardsHandler,
  ListUnitsHandler,
  GetUnitDetailHandler,
  GetGenerationEstimateHandler,
  GetPublishTargetsHandler,
];
const eventHandlers = [OnAttemptAiGraded, OnClassVocabularyExtracted];

/**
 * Contexto acotado de contenido y generación con IA.
 *
 * El módulo es la frontera: aquí se declara qué adaptador cumple cada
 * puerto, y nada de esto sale fuera. `billing` se consulta solo a través de
 * `CreditLedgerPort`, con su propio repositorio contra las mismas tablas
 * (`schools`, `credit_ledger`) — nunca importando el agregado `CreditBalance`
 * ni ningún comando de `contexts/billing/` (ver
 * `domain/ports/credit-ledger.port.ts`).
 *
 * Deja fuera, a propósito, `MediaGeneratorPort`/`TtsAdapter`/`ImageAdapter`
 * (tarea 4 de la ola 2): están construyéndose en paralelo a esta tarea y
 * necesitan un dato que todavía no resuelve nadie —los idiomas de la escuela
 * para el texto alternativo de una imagen— antes de poder engancharse aquí.
 * Ver el informe de la tarea 6.
 *
 * `MaterialsController` y sus piezas (tarea 14 de la ola 2: material propio)
 * sí entran aquí: `MATERIAL_REPOSITORY` para persistirlo, `TextExtractionAdapter`
 * para sacar el texto de un PDF/DOCX y `EMBEDDING_PROVIDER_PORT` para
 * indexarlo con `pgvector`. Sin credenciales de proveedor de embeddings en el
 * entorno, `EmbeddingAdapter` falla limpio y el material queda «subido, sin
 * indexar»: la subida no se pierde nunca por eso.
 *
 * `OnAttemptAiGraded` (tarea 9: repetición espaciada) escucha un evento de
 * `assessment` — lo único público de otro contexto (`domain/events/`,
 * `ARCHITECTURE.md`) — sin que `assessment` sepa que `learning` existe.
 */
@Module({
  controllers: [UnitsController, ExercisesController, MaterialsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    DrizzleCreditLedgerRepository,
    DrizzleSchoolTimezoneRepository,
    DrizzleStudentSelfRepository,
    DrizzleGroupCourseRepository,
    ContentAssetStorageAdapter,
    TextExtractionAdapter,
    { provide: CONTENT_UNIT_REPOSITORY, useClass: DrizzleContentUnitRepository },
    { provide: AI_GENERATION_REPOSITORY, useClass: DrizzleAiGenerationRepository },
    { provide: CREDIT_LEDGER_PORT, useClass: BillingCreditLedgerAdapter },
    { provide: CONTENT_GENERATOR_PORT, useClass: ClaudeContentGeneratorAdapter },
    { provide: SRS_CARD_REPOSITORY, useClass: DrizzleSrsCardRepository },
    { provide: SCHOOL_CALENDAR_PORT, useClass: SchoolCalendarAdapter },
    { provide: STUDENT_SELF_PORT, useClass: PeopleStudentSelfAdapter },
    { provide: EXERCISE_REPOSITORY, useClass: DrizzleExerciseRepository },
    { provide: LEARNING_READ_MODEL, useClass: DrizzleLearningReadModel },
    { provide: MATERIAL_REPOSITORY, useClass: DrizzleMaterialRepository },
    { provide: EMBEDDING_PROVIDER_PORT, useClass: EmbeddingAdapter },
    { provide: GROUP_COURSE_PORT, useClass: CatalogGroupCourseAdapter },
    { provide: VIDEO_GENERATOR_PORT, useClass: VideoAdapter },
  ],
})
export class LearningModule {}
