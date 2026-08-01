import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import type { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
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
import {
  ExamGenerationRejectedError,
  ExamSourceUnitNotPublishedError,
  MissingExamActorError,
} from "../../../domain/errors/assessment.errors.js";
import {
  DEFAULT_SKILL_BY_EXAM_ITEM_TYPE,
  RUBRIC_EXAM_ITEM_TYPES,
  type ExamItemType,
} from "../../../domain/model/exam-item-schemas.js";
import { Exam, type ExamItem, type ExamSection, type ExamSourceUnitRef } from "../../../domain/model/exam.aggregate.js";
import { ContentUnitId, ExamId } from "../../../domain/model/identifiers.js";
import {
  AI_GENERATION_REPOSITORY,
  type AiGenerationRepository,
} from "../../../domain/ports/ai-generation.repository.port.js";
import { CREDIT_LEDGER_PORT, type CreditLedgerPort } from "../../../domain/ports/credit-ledger.port.js";
import {
  EXAM_GENERATOR_PORT,
  type ExamGeneratorPort,
  type ExamItemRequest,
  type GeneratedExamItem,
  type GenerationCost,
} from "../../../domain/ports/exam-generator.port.js";
import { EXAM_REPOSITORY, type ExamRepository } from "../../../domain/ports/exam.repository.port.js";
import {
  EXERCISE_SOURCE_PORT,
  type ExamSourceUnit,
  type ExerciseSourcePort,
} from "../../../domain/ports/exercise-source.port.js";
import { GenerateExamCommand } from "./generate-exam.command.js";

/**
 * 1 crédito = 10 céntimos de coste real. Misma proporción que `learning`
 * (`generate-unit.handler.ts`, derivada de los datos del seed) — copia
 * propia porque `assessment` no importa ese fichero.
 */
export const CENTS_PER_CREDIT = 10;

export function costCentsToCredits(costCents: number): number {
  return Math.max(0, Math.round(costCents / CENTS_PER_CREDIT));
}

/**
 * Reserva ANTES de conocer el coste real. Un examen es una única llamada
 * (a diferencia de la unidad, que son dos), y bastante más corta que la
 * generación de ejercicios de una unidad completa: conservadora, con
 * margen, no medida contra un ejemplar real todavía (sin `ANTHROPIC_API_KEY`
 * en este entorno no lo hay) — el ajuste del paso final corrige la diferencia.
 */
export const ESTIMATED_CREDITS_RESERVE = 15;

/** Cuántos ítems automáticos de lectura, y cuántos de gramática/léxico (repartidos entre cloze y multiple_choice), trae por defecto cada examen. */
const READING_ITEM_COUNT = 3;
const GRAMMAR_CLOZE_COUNT = 2;
const GRAMMAR_MULTIPLE_CHOICE_COUNT = 2;

/** Reparto oficial por defecto (brief, verbatim): 25 % cada una de las cuatro destrezas. */
const DEFAULT_SKILL_DISTRIBUTION: Record<string, number> = {
  reading: 25,
  speaking: 25,
  writing: 25,
  grammar: 25,
};

/** Código de rúbrica que cada tipo con rúbrica exige (sembradas en todas las escuelas: `packages/db/src/seed/reference.ts`). */
const RUBRIC_CODE_BY_TYPE: Partial<Record<ExamItemType, string>> = {
  written_production: "mcer-escrita",
  spoken_production: "mcer-oral",
};

/** Duck typing deliberado: el adaptador de infraestructura es quien define `ExamGenerationFailedError`, y la aplicación no lo importa. */
function extractCost(error: unknown): GenerationCost | null {
  if (error && typeof error === "object" && "cost" in error) {
    return (error as { cost: GenerationCost }).cost;
  }
  return null;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Qué generar por cada destreza reconocida, a partir del reparto pedido. Las destrezas no reconocidas no producen ningún ítem. */
function buildItemRequests(skillDistribution: Record<string, number>): ExamItemRequest[] {
  const requests: ExamItemRequest[] = [];
  if ("reading" in skillDistribution) {
    requests.push({ skill: "reading", type: "reading_comprehension", count: READING_ITEM_COUNT });
  }
  if ("writing" in skillDistribution) {
    requests.push({ skill: "writing", type: "written_production", count: 1 });
  }
  if ("speaking" in skillDistribution) {
    requests.push({ skill: "speaking", type: "spoken_production", count: 1 });
  }
  if ("grammar" in skillDistribution) {
    requests.push({ skill: "grammar", type: "cloze", count: GRAMMAR_CLOZE_COUNT });
    requests.push({ skill: "grammar", type: "multiple_choice", count: GRAMMAR_MULTIPLE_CHOICE_COUNT });
  }
  return requests;
}

/** Duración de cada sección, proporcional al reparto de destrezas pedido. */
function buildSectionDurations(
  skillDistribution: Record<string, number>,
  totalMinutes: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(skillDistribution).map(([skill, pct]) => [skill, Math.round((totalMinutes * pct) / 100)]),
  );
}

/**
 * Manejador del comando.
 *
 * Orquestación, en el orden de la regla de la ola:
 *
 *   1-2. Reservar créditos estimados ANTES de llamar al modelo.
 *   3.   Pedir a `ExerciseSourcePort` las unidades de origen (nivel, destreza,
 *        ejercicios de práctica ya existentes) — nunca el agregado `ContentUnit`.
 *   4.   Generar los ítems del examen con `ExamGeneratorPort` (el propio
 *        adaptador valida el esquema y reintenta con el error como contexto).
 *   5.   Construir el examen UNA VEZ (`Exam.generate()`, que rechaza unidades
 *        no publicadas, repartos que no suman 100 y copias literales de
 *        ejercicios de práctica) y guardarlo UNA FILA POR ALUMNO del grupo —
 *        el mismo examen, reproducible para todos.
 *   6-7. Registrar el coste real en `ai_generations` y ajustar la reserva.
 *
 * Si la generación falla, se devuelve la reserva ENTERA y no se guarda
 * ningún examen — ni a medias ni para uno de los alumnos.
 */
@CommandHandler(GenerateExamCommand)
export class GenerateExamHandler implements ICommandHandler<GenerateExamCommand> {
  constructor(
    @Inject(EXAM_REPOSITORY) private readonly exams: ExamRepository,
    @Inject(EXERCISE_SOURCE_PORT) private readonly exerciseSource: ExerciseSourcePort,
    @Inject(AI_GENERATION_REPOSITORY) private readonly aiGenerations: AiGenerationRepository,
    @Inject(CREDIT_LEDGER_PORT) private readonly creditLedger: CreditLedgerPort,
    @Inject(EXAM_GENERATOR_PORT) private readonly generator: ExamGeneratorPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @InjectPinoLogger(GenerateExamHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: GenerateExamCommand): Promise<{ examIds: string[]; status: string }> {
    const { props } = command;
    const now = this.clock.now();
    const schoolId = SchoolId.of(this.tenant.schoolId());
    const actor = this.tenant.membershipId();
    if (!actor) throw new MissingExamActorError();

    const skillDistribution = props.skillDistribution ?? { ...DEFAULT_SKILL_DISTRIBUTION };
    const generationId = this.ids.generate();

    const sourceUnits = await this.uow.read(() =>
      this.exerciseSource.getUnits(props.sourceContentUnitIds.map((id) => ContentUnitId.of(id))),
    );
    if (sourceUnits.length !== props.sourceContentUnitIds.length) {
      const foundIds = new Set(sourceUnits.map((u) => u.id));
      const missing = props.sourceContentUnitIds.find((id) => !foundIds.has(id));
      throw new NotFoundError("la unidad didáctica", missing ?? "?");
    }
    // Comprobación local (sin llamar a ningún modelo), antes de reservar nada
    // — mismo criterio que las rúbricas en `GenerateUnitHandler` (`learning`):
    // examinar de contenido que el alumno no ha visto es el motivo más
    // habitual de reclamación, y `Exam.generate()` lo repite de todos modos
    // al construir el examen, pero fallar aquí evita gastar la llamada real.
    for (const unit of sourceUnits) {
      if (unit.status !== "published") {
        throw new ExamSourceUnitNotPublishedError(unit.id, unit.status);
      }
    }

    // Pasos 1-2: reservar ANTES de llamar a ningún modelo.
    await this.uow.execute(() =>
      this.creditLedger.spend({
        credits: ESTIMATED_CREDITS_RESERVE,
        note: `Reserva estimada para generar el examen «${props.title}»`,
        aiGenerationId: generationId,
      }),
    );

    let generated: { items: GeneratedExamItem[]; cost: GenerationCost } | undefined;
    let sections: ExamSection[] | undefined;
    let failureReason: string | null = null;
    let failureCost: GenerationCost | null = null;

    const practiceExercises = sourceUnits.flatMap((u) => u.exercises.map((e) => ({ type: e.type, prompt: e.prompt })));
    const sourceUnitRefs: ExamSourceUnitRef[] = sourceUnits.map((u) => ({ id: u.id, status: u.status }));

    try {
      const rubricsByType = await this.resolveRubrics(skillDistribution);
      const itemRequests = buildItemRequests(skillDistribution);

      generated = await this.generator.generateItems({
        language: props.language,
        level: props.level,
        topics: sourceUnits.map((u) => u.topic),
        items: itemRequests,
        avoidPrompts: sourceUnits.flatMap((u) => u.exercises.map((e) => e.prompt)),
      });

      sections = this.buildSections(generated.items, sourceUnits, skillDistribution, props.durationMinutes, rubricsByType);

      // Validación completa (unidades publicadas, reparto que suma 100, al
      // menos un ítem, y NINGÚN ítem copia literal de un ejercicio de
      // práctica) ANTES de dar la generación por buena: un examen «de
      // prueba», con un id que se descarta, para que cualquier fallo de
      // `Exam.generate()` entre en el mismo camino de reintento/reembolso
      // que un fallo del propio modelo — nunca se cobra un examen que
      // termina rechazado por el dominio.
      Exam.generate({
        id: ExamId.of(this.ids.generate()),
        schoolId,
        kind: props.kind,
        studentProfileId: props.studentProfileIds[0]!,
        title: props.title,
        language: props.language,
        level: props.level as CefrLevel,
        sourceUnits: sourceUnitRefs,
        skillDistribution,
        sections,
        durationMinutes: props.durationMinutes,
        mockFramework: props.mockFramework,
        practiceExercises,
        now,
      });
    } catch (error) {
      failureReason = reasonOf(error);
      failureCost = extractCost(error);
    }

    if (failureReason !== null) {
      await this.recordFailureAndRefund({ generationId, actor, now, failureCost, failureReason, title: props.title });
      throw new ExamGenerationRejectedError(failureReason);
    }

    const credits = costCentsToCredits(generated!.cost.costCents);

    const examIds: string[] = [];
    await this.uow.execute(async () => {
      for (const studentProfileId of props.studentProfileIds) {
        const examId = ExamId.of(this.ids.generate());
        const exam = Exam.generate({
          id: examId,
          schoolId,
          kind: props.kind,
          studentProfileId,
          title: props.title,
          language: props.language,
          level: props.level as CefrLevel,
          sourceUnits: sourceUnitRefs,
          skillDistribution,
          sections: sections!.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) })),
          durationMinutes: props.durationMinutes,
          mockFramework: props.mockFramework,
          practiceExercises,
          now,
        });
        if (props.scheduledFor) {
          exam.schedule({ scheduledFor: new Date(props.scheduledFor), now });
        }
        await this.exams.save(exam);
        examIds.push(examId.value);
        await this.events.publish(exam.pullDomainEvents());
      }

      await this.aiGenerations.record({
        id: generationId,
        schoolId: schoolId.value,
        status: "succeeded",
        provider: "anthropic",
        model: generated!.cost.model,
        inputTokens: generated!.cost.inputTokens,
        outputTokens: generated!.cost.outputTokens,
        costCents: generated!.cost.costCents,
        creditsCharged: credits,
        requestedByMembershipId: actor,
        now,
      });
    });

    await this.settleCredits({ actualCredits: credits, generationId, title: props.title });

    return { examIds, status: "scheduled" };
  }

  /** Solo consulta (y solo exige) las rúbricas de las destrezas con rúbrica que de verdad se pidieron. */
  private async resolveRubrics(
    skillDistribution: Record<string, number>,
  ): Promise<Map<ExamItemType, { id: string; maxScore: number }>> {
    const result = new Map<ExamItemType, { id: string; maxScore: number }>();
    const neededTypes = (Object.keys(RUBRIC_CODE_BY_TYPE) as ExamItemType[]).filter((type) =>
      skillDistribution[DEFAULT_SKILL_BY_EXAM_ITEM_TYPE[type]] !== undefined,
    );
    if (neededTypes.length === 0) return result;

    await this.uow.read(async () => {
      for (const type of neededTypes) {
        const code = RUBRIC_CODE_BY_TYPE[type]!;
        const rubric = await this.exerciseSource.getRubricByCode(code);
        if (!rubric) {
          throw new Error(
            `No existe la rúbrica «${code}» en esta escuela: créala antes de generar un examen con ítems de tipo «${type}».`,
          );
        }
        result.set(type, rubric);
      }
    });
    return result;
  }

  /** Reparte los ítems generados en sus secciones (por destreza), con la duración proporcional al reparto pedido. */
  private buildSections(
    items: GeneratedExamItem[],
    sourceUnits: readonly ExamSourceUnit[],
    skillDistribution: Record<string, number>,
    totalMinutes: number,
    rubricsByType: Map<ExamItemType, { id: string; maxScore: number }>,
  ): ExamSection[] {
    const durations = buildSectionDurations(skillDistribution, totalMinutes);
    const bySkill = new Map<string, ExamItem[]>();

    items.forEach((raw, index) => {
      const type = raw.type as ExamItemType;
      const rubric = RUBRIC_EXAM_ITEM_TYPES.has(type) ? rubricsByType.get(type) : undefined;
      const sourceUnit = sourceUnits[index % sourceUnits.length]!;
      const item: ExamItem = {
        id: this.ids.generate(),
        sourceExerciseId: null,
        sourceContentUnitId: sourceUnit.id,
        type: raw.type,
        skill: raw.skill,
        level: sourceUnit.level,
        prompt: raw.prompt,
        solution: raw.solution ?? null,
        rubricId: rubric?.id ?? null,
        rubricCode: rubric ? (RUBRIC_CODE_BY_TYPE[type] ?? null) : null,
        maxScore: rubric?.maxScore ?? this.computeMaxScore(raw),
        response: null,
        result: null,
      };
      const list = bySkill.get(raw.skill) ?? [];
      list.push(item);
      bySkill.set(raw.skill, list);
    });

    return [...bySkill.entries()].map(([skill, sectionItems]) => ({
      skill,
      durationMinutes: durations[skill] ?? Math.round(totalMinutes / bySkill.size),
      items: sectionItems,
    }));
  }

  /** Puntuación máxima por tipo automático: cuenta ítems gradables (huecos, opciones), o 1 si el tipo no distingue. */
  private computeMaxScore(raw: GeneratedExamItem): number {
    if (raw.type === "cloze") {
      const blanks = raw.prompt["blanks"];
      return Array.isArray(blanks) ? blanks.length : 1;
    }
    return 1;
  }

  private async recordFailureAndRefund(params: {
    generationId: string;
    actor: string;
    now: Date;
    failureCost: GenerationCost | null;
    failureReason: string;
    title: string;
  }): Promise<void> {
    if (params.failureCost) {
      await this.uow.execute(() =>
        this.aiGenerations.record({
          id: params.generationId,
          schoolId: this.tenant.schoolId(),
          status: "failed",
          provider: "anthropic",
          model: params.failureCost!.model,
          inputTokens: params.failureCost!.inputTokens,
          outputTokens: params.failureCost!.outputTokens,
          costCents: params.failureCost!.costCents,
          creditsCharged: 0,
          requestedByMembershipId: params.actor,
          errorMessage: params.failureReason,
          now: params.now,
        }),
      );
    }

    await this.uow.execute(() =>
      this.creditLedger.refund({
        credits: ESTIMATED_CREDITS_RESERVE,
        note: `Generación fallida del examen «${params.title}»: ${params.failureReason}`,
        aiGenerationId: params.generationId,
      }),
    );
  }

  /** Paso final: ajusta la reserva al coste real, sin deshacer un examen que ya se generó y se guardó bien. */
  private async settleCredits(params: { actualCredits: number; generationId: string; title: string }): Promise<void> {
    const diff = ESTIMATED_CREDITS_RESERVE - params.actualCredits;
    if (diff > 0) {
      await this.uow.execute(() =>
        this.creditLedger.refund({
          credits: diff,
          note: `Ajuste de la reserva del examen «${params.title}»: coste real ${params.actualCredits} créditos`,
          aiGenerationId: params.generationId,
        }),
      );
      return;
    }
    if (diff < 0) {
      try {
        await this.uow.execute(() =>
          this.creditLedger.spend({
            credits: -diff,
            note: `Ajuste de la reserva del examen «${params.title}»: coste real ${params.actualCredits} créditos`,
            aiGenerationId: params.generationId,
          }),
        );
      } catch (error) {
        this.logger.warn(
          { err: error instanceof Error ? error : new Error(String(error)) },
          `No se pudo cobrar el exceso de ${-diff} créditos del examen «${params.title}» sobre lo reservado: ` +
            `el examen ya se generó y se guarda igual.`,
        );
      }
    }
  }
}
