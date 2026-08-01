import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
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
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { ContentUnit } from "../../../domain/model/content-unit.aggregate.js";
import {
  AUDIO_EXERCISE_TYPES,
  InvalidExerciseError,
  RUBRIC_EXERCISE_TYPES,
  type ExerciseType,
} from "../../../domain/model/exercise-schemas.js";
import { Exercise } from "../../../domain/model/exercise.entity.js";
import { ContentUnitId, ExerciseId } from "../../../domain/model/identifiers.js";
import { UnitGenerationFailedError } from "../../../domain/errors/learning.errors.js";
import {
  AI_GENERATION_REPOSITORY,
  type AiGenerationRepository,
} from "../../../domain/ports/ai-generation.repository.port.js";
import {
  CONTENT_GENERATOR_PORT,
  type ContentGeneratorPort,
  type GenerationCost,
} from "../../../domain/ports/content-generator.port.js";
import {
  CONTENT_UNIT_REPOSITORY,
  type ContentUnitRepository,
} from "../../../domain/ports/content-unit.repository.port.js";
import { CREDIT_LEDGER_PORT, type CreditLedgerPort } from "../../../domain/ports/credit-ledger.port.js";
import { GenerateUnitCommand } from "./generate-unit.command.js";

/**
 * 1 crédito = 10 céntimos de coste real.
 *
 * Cifra derivada de los datos del seed (`packages/db/src/seed/scenarios/`),
 * no inventada: `generationCostCents`/`creditsSpent` de cada unidad y
 * `costCents`/`creditsCharged` de cada fila de `ai_generations` mantienen
 * exactamente esta proporción (232/23, 184/18, 94/9, 62/6, 28/3, 18/2...,
 * todas ≈10, redondeando al entero más cercano). No hay una tabla de precios
 * por escuela ni por plan todavía; el día que la haya, esta es la única
 * función que cambia.
 */
export const CENTS_PER_CREDIT = 10;

export function costCentsToCredits(costCents: number): number {
  return Math.max(0, Math.round(costCents / CENTS_PER_CREDIT));
}

/**
 * Reserva ANTES de conocer el coste real (pasos 1-2 del brief). Conservadora
 * a propósito: cubre con margen la unidad más cara del seed (26 créditos,
 * unidad + audio + imagen) aunque hoy no se generen ni audio ni imagen (ver
 * el informe) — sin tabla de estimación por número de ejercicios todavía
 * (queda para el formulario del panel, tarea 11, que si la afina no tiene
 * que tocar nada de aquí: el ajuste del paso 6 corrige la diferencia).
 */
export const ESTIMATED_CREDITS_RESERVE = 40;

/** Código de rúbrica que cada tipo con rúbrica exige (sembrados en todas las escuelas: `packages/db/src/seed/reference.ts`). */
const RUBRIC_CODE_BY_TYPE: Partial<Record<ExerciseType, string>> = {
  written_production: "mcer-escrita",
  spoken_production: "mcer-oral",
};

/**
 * Destreza principal por tipo de ejercicio. `generateExercises()` no la
 * devuelve (el envelope es solo `{type, prompt, solution}`, tarea 3), y
 * `exercises.skill` no admite nulo: esta es la asignación por defecto,
 * verificada contra los seis ejercicios reales de «En la consulta del
 * médico» (`ES_B1_DOCTOR_EXERCISES`, `packages/db/src/seed/reference.ts`),
 * donde coincide en los seis.
 */
const DEFAULT_SKILL_BY_TYPE: Record<ExerciseType, string> = {
  cloze: "grammar",
  multiple_choice: "grammar",
  matching: "vocabulary",
  ordering: "grammar",
  minimal_pairs: "phonetics",
  dictation: "listening",
  shadowing: "speaking",
  listening_comprehension: "listening",
  reading_comprehension: "reading",
  written_production: "writing",
  spoken_production: "speaking",
};

/** Tipos de recuperación/reconocimiento: candidatos naturales al repaso espaciado (tarea 9, todavía sin construir). */
const SRS_ELIGIBLE_TYPES: ReadonlySet<ExerciseType> = new Set([
  "cloze",
  "multiple_choice",
  "matching",
  "ordering",
  "minimal_pairs",
  "dictation",
]);

/** Puntuación máxima por tipo: cuenta ítems gradables cuando los hay, si no, 1; rúbrica cuando corrige un profesor. */
function computeMaxScore(
  type: ExerciseType,
  prompt: Record<string, unknown>,
  solution: Record<string, unknown> | undefined,
  rubricMaxScore: number | undefined,
): number {
  switch (type) {
    case "cloze": {
      const blanks = prompt["blanks"];
      return Array.isArray(blanks) ? blanks.length : 1;
    }
    case "matching": {
      const left = prompt["left"];
      return Array.isArray(left) ? left.length : 1;
    }
    case "minimal_pairs": {
      const pairs = prompt["pairs"];
      return Array.isArray(pairs) ? pairs.length : 1;
    }
    case "dictation": {
      const segments = solution?.["segments"];
      return Array.isArray(segments) ? segments.length : 1;
    }
    case "written_production":
    case "spoken_production":
      return rubricMaxScore ?? 20;
    default:
      return 1;
  }
}

/** Igual criterio que `MissingActorError` de `scheduling` (tarea 5 de la ola 1), con su propio código y mensaje. */
export class MissingActorError extends DomainError {
  readonly code = "unit_generation_missing_actor";
  readonly kind = "forbidden" as const;

  constructor() {
    super("Generar contenido con IA requiere saber quién lo pide.");
  }
}

type GenerationOutcome = {
  unitGen?: { title: string; description: string; body: string; cost: GenerationCost };
  exercisesGen?: { exercises: unknown[]; cost: GenerationCost };
};

/** Duck typing deliberado: el adaptador de infraestructura es quien define `ContentGenerationFailedError`, y la aplicación no lo importa (`ARCHITECTURE.md`: las dependencias apuntan hacia dentro). */
function extractCost(error: unknown): GenerationCost | null {
  if (error && typeof error === "object" && "cost" in error) {
    return (error as { cost: GenerationCost }).cost;
  }
  return null;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Manejador del comando.
 *
 * El orden es el del brief, literal:
 *
 *   1-2. Comprobar saldo y reservar los créditos estimados — `creditLedger.spend()`,
 *        ANTES de tocar `ContentGeneratorPort`. Si el tope duro lo impide, propaga
 *        `InsufficientCreditsError` y aquí termina: el doble del generador no
 *        recibe ninguna llamada.
 *   3.   Generar texto → validar → generar ejercicios → validar. La validación de
 *        ESQUEMA la hace el adaptador de Claude (tarea 3, reintento incluido); la
 *        de las reglas transversales (rúbrica, audio) la hace `Exercise.create()`
 *        (tarea 2) al construir cada ejercicio.
 *   4.   Audio e imágenes en paralelo — pendiente de la tarea 4: no hay ningún
 *        proveedor conectado a este caso de uso todavía (ver el informe), así que
 *        ningún ejercicio de audio puede validar hoy y `exerciseTypes` no los
 *        admite (rechazo temprano, antes de reservar nada).
 *   5-6. Registrar el coste real en `ai_generations` (antes de tocar créditos:
 *        regla de la ola) y ajustar la reserva a ese coste real.
 *   7.   Guardar la unidad en `in_review` (nace así: `ContentUnit.draft()` con
 *        `source: "ai_generated"`).
 *
 * Si algo falla entre el 3 y el 6 (dos intentos de salida inválida, una rúbrica
 * que falta, un ejercicio que no cumple una regla transversal...), se registra en
 * `ai_generations` lo que de verdad se llegó a llamar, se devuelve la reserva
 * ENTERA (no una parte: «el cliente no paga por lo que no recibió») y se lanza
 * `UnitGenerationFailedError` — ninguna unidad ni ejercicio queda persistido a
 * medias, porque no se persiste nada hasta que las dos llamadas y la validación
 * completa han terminado bien.
 */
@CommandHandler(GenerateUnitCommand)
export class GenerateUnitHandler implements ICommandHandler<GenerateUnitCommand> {
  constructor(
    @Inject(CONTENT_UNIT_REPOSITORY) private readonly contentUnits: ContentUnitRepository,
    @Inject(AI_GENERATION_REPOSITORY) private readonly aiGenerations: AiGenerationRepository,
    @Inject(CREDIT_LEDGER_PORT) private readonly creditLedger: CreditLedgerPort,
    @Inject(CONTENT_GENERATOR_PORT) private readonly generator: ContentGeneratorPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @InjectPinoLogger(GenerateUnitHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: GenerateUnitCommand): Promise<{ contentUnitId: string; status: string }> {
    const { props } = command;
    const now = this.clock.now();
    const schoolId = SchoolId.of(this.tenant.schoolId());
    const actor = this.tenant.membershipId();
    if (!actor) throw new MissingActorError();
    const createdBy = MembershipId.of(actor);

    for (const type of props.exerciseTypes) {
      if (AUDIO_EXERCISE_TYPES.has(type as ExerciseType)) {
        throw new InvalidExerciseError(
          type,
          "necesita un recurso de audio real, y todavía no hay ningún proveedor conectado a la " +
            "generación (tarea 4 de la ola 2, pendiente de integrar aquí).",
        );
      }
    }

    const contentUnitId = ContentUnitId.of(this.ids.generate());
    const unitBodyGenerationId = this.ids.generate();
    const exerciseSetGenerationId = this.ids.generate();

    // Pasos 1-2: comprobar saldo y reservar, ANTES de llamar a ningún modelo.
    // Si `ai_hard_limit` lo impide, `InsufficientCreditsError` sale de aquí sin
    // que `this.generator` se haya invocado ni una vez.
    await this.uow.execute(() =>
      this.creditLedger.spend({
        credits: ESTIMATED_CREDITS_RESERVE,
        note: `Reserva estimada para generar la unidad «${props.code}»`,
        aiGenerationId: unitBodyGenerationId,
      }),
    );

    const outcome: GenerationOutcome = {};
    let unit: ContentUnit | undefined;
    let exercises: Exercise[] = [];
    let failureReason: string | null = null;
    let failureCost: GenerationCost | null = null;

    try {
      // Paso 3: rúbricas primero — es la única comprobación local (sin
      // llamar a ningún modelo) que puede hacer fallar la generación, así
      // que se hace antes de gastar la llamada real.
      const rubricsByType = await this.resolveRubrics(props.exerciseTypes as ExerciseType[]);

      outcome.unitGen = await this.generator.generateUnit({
        language: props.language,
        level: props.level,
        topic: props.topic,
        skills: props.skills,
        locale: props.primaryLocale,
        sourceMaterial: props.sourceMaterial,
      });

      outcome.exercisesGen = await this.generator.generateExercises({
        unitBody: outcome.unitGen.body,
        language: props.language,
        level: props.level,
        types: props.exerciseTypes,
        count: props.exerciseTypes.length,
      });

      // Paso 4: audio e imágenes en paralelo — ver el comentario de cabecera
      // y el informe de la tarea. Hoy no hay nada que llamar aquí.

      unit = ContentUnit.draft({
        id: contentUnitId,
        schoolId,
        code: props.code,
        language: props.language,
        level: props.level as CefrLevel,
        topic: props.topic,
        skills: props.skills,
        source: props.source ?? "ai_generated",
        primaryLocale: props.primaryLocale,
        createdBy,
        now,
      });

      exercises = outcome.exercisesGen.exercises.map((raw) => {
        const parsed = raw as { type: ExerciseType; prompt: Record<string, unknown>; solution?: Record<string, unknown> };
        const rubric = RUBRIC_CODE_BY_TYPE[parsed.type] ? rubricsByType.get(parsed.type) : undefined;
        const exercise = Exercise.create({
          id: ExerciseId.of(this.ids.generate()),
          contentUnitId: unit!.id,
          type: parsed.type,
          prompt: parsed.prompt,
          solution: parsed.solution,
          rubricId: rubric?.id ?? null,
          requiresTeacherValidation: RUBRIC_EXERCISE_TYPES.has(parsed.type),
          skill: DEFAULT_SKILL_BY_TYPE[parsed.type] ?? null,
          maxScore: computeMaxScore(parsed.type, parsed.prompt, parsed.solution, rubric?.maxScore),
          srsEnabled: SRS_ELIGIBLE_TYPES.has(parsed.type),
        });
        unit!.addExercise(exercise.id);
        return exercise;
      });
    } catch (error) {
      failureReason = reasonOf(error);
      failureCost = extractCost(error);
    }

    if (failureReason !== null) {
      await this.recordFailureAndRefund({
        code: props.code,
        unitBodyGenerationId,
        exerciseSetGenerationId,
        createdBy,
        now,
        outcome,
        failureCost,
        failureReason,
      });
      throw new UnitGenerationFailedError(props.code, failureReason);
    }

    // Pasos 5-6: coste real y ajuste de créditos, ya con la unidad completa
    // en memoria y validada — nada de esto se persiste todavía.
    const unitCredits = costCentsToCredits(outcome.unitGen!.cost.costCents);
    const exerciseCredits = costCentsToCredits(outcome.exercisesGen!.cost.costCents);
    unit!.recordGenerationCost({
      costCents: outcome.unitGen!.cost.costCents + outcome.exercisesGen!.cost.costCents,
      credits: unitCredits + exerciseCredits,
    });

    // Paso 7: guardar la unidad en `in_review`, junto con sus ejercicios y el
    // registro real de las dos llamadas — todo en la misma transacción: o se
    // guarda todo, o no se guarda nada.
    await this.uow.execute(async () => {
      await this.contentUnits.save(unit!);
      await this.contentUnits.saveTranslation(unit!, {
        locale: props.primaryLocale,
        title: outcome.unitGen!.title,
        description: outcome.unitGen!.description,
        body: outcome.unitGen!.body,
      });
      await this.contentUnits.addExercises(unit!, exercises);
      await this.recordEntry({
        id: unitBodyGenerationId,
        kind: "unit_body",
        status: "succeeded",
        cost: outcome.unitGen!.cost,
        creditsCharged: unitCredits,
        contentUnitId: unit!.id.value,
        createdBy,
        now,
      });
      await this.recordEntry({
        id: exerciseSetGenerationId,
        kind: "exercise_set",
        status: "succeeded",
        cost: outcome.exercisesGen!.cost,
        creditsCharged: exerciseCredits,
        contentUnitId: unit!.id.value,
        createdBy,
        now,
      });
    });

    // El ajuste de créditos va DESPUÉS de confirmar la persistencia: si algo
    // fallara guardando, mejor una reserva que sobra un instante más (se
    // corrige a mano) que devolver crédito por una unidad que sí se guardó.
    await this.settleCredits({
      actualCredits: unitCredits + exerciseCredits,
      unitBodyGenerationId,
      code: props.code,
    });

    await this.events.publish(unit!.pullDomainEvents());

    return { contentUnitId: unit!.id.value, status: unit!.status };
  }

  /** Solo consulta (y solo exige) las rúbricas de los tipos con rúbrica que de verdad se pidieron. */
  private async resolveRubrics(types: ExerciseType[]): Promise<Map<ExerciseType, { id: string; maxScore: number }>> {
    const result = new Map<ExerciseType, { id: string; maxScore: number }>();
    const needed = new Set(types.filter((type) => RUBRIC_CODE_BY_TYPE[type]));
    if (needed.size === 0) return result;

    await this.uow.read(async () => {
      for (const type of needed) {
        const code = RUBRIC_CODE_BY_TYPE[type]!;
        const rubric = await this.contentUnits.findRubricIdByCode(code);
        if (!rubric) {
          throw new Error(
            `No existe la rúbrica «${code}» en esta escuela: créala antes de generar un ejercicio de tipo «${type}».`,
          );
        }
        result.set(type, rubric);
      }
    });
    return result;
  }

  /**
   * Registra en `ai_generations` lo que de verdad se llegó a llamar y
   * devuelve la reserva ENTERA. Tres casos, según dónde ocurrió el fallo:
   *
   *   · Antes de la primera llamada (p. ej. falta una rúbrica): ninguna fila
   *     — no hubo llamada real que registrar, y sin coste no hay margen que
   *     vigilar porque no se gastó nada.
   *   · `generateUnit()` falló (tras su propio reintento interno, tarea 3):
   *     una fila `unit_body` en `failed`, con el coste de `error.cost` — el
   *     proveedor cobró igual.
   *   · `generateUnit()` valió pero `generateExercises()` o la construcción
   *     del ejercicio fallaron: una fila `unit_body` en `succeeded` (sí
   *     produjo contenido válido) y otra `exercise_set` en `failed` si la
   *     llamada llegó a ejecutarse.
   */
  private async recordFailureAndRefund(params: {
    code: string;
    unitBodyGenerationId: string;
    exerciseSetGenerationId: string;
    createdBy: MembershipId;
    now: Date;
    outcome: GenerationOutcome;
    failureCost: GenerationCost | null;
    failureReason: string;
  }): Promise<void> {
    await this.uow.execute(async () => {
      if (params.outcome.unitGen) {
        await this.recordEntry({
          id: params.unitBodyGenerationId,
          kind: "unit_body",
          status: "succeeded",
          cost: params.outcome.unitGen.cost,
          creditsCharged: 0,
          contentUnitId: null,
          createdBy: params.createdBy,
          now: params.now,
        });
      } else if (params.failureCost) {
        await this.recordEntry({
          id: params.unitBodyGenerationId,
          kind: "unit_body",
          status: "failed",
          cost: params.failureCost,
          creditsCharged: 0,
          contentUnitId: null,
          createdBy: params.createdBy,
          now: params.now,
          errorMessage: params.failureReason,
        });
      }

      if (params.outcome.exercisesGen) {
        await this.recordEntry({
          id: params.exerciseSetGenerationId,
          kind: "exercise_set",
          status: "succeeded",
          cost: params.outcome.exercisesGen.cost,
          creditsCharged: 0,
          contentUnitId: null,
          createdBy: params.createdBy,
          now: params.now,
        });
      } else if (params.outcome.unitGen && params.failureCost) {
        // `unitGen` ya tenía éxito cuando falló, así que el fallo (y su
        // coste) es de la llamada de ejercicios.
        await this.recordEntry({
          id: params.exerciseSetGenerationId,
          kind: "exercise_set",
          status: "failed",
          cost: params.failureCost,
          creditsCharged: 0,
          contentUnitId: null,
          createdBy: params.createdBy,
          now: params.now,
          errorMessage: params.failureReason,
        });
      }
    });

    await this.uow.execute(() =>
      this.creditLedger.refund({
        credits: ESTIMATED_CREDITS_RESERVE,
        note: `Generación fallida de la unidad «${params.code}»: ${params.failureReason}`,
        aiGenerationId: params.unitBodyGenerationId,
      }),
    );
  }

  /**
   * `creditsCharged` se pasa siempre explícito, nunca derivado del coste
   * aquí dentro: en el camino de éxito es el crédito real de esa llamada, y
   * en el de fallo es SIEMPRE 0 —la reserva entera se devuelve, así que a la
   * escuela no le queda cobrado nada de este intento, aunque la llamada en
   * sí valiera y costara de verdad—.
   */
  private async recordEntry(params: {
    id: string;
    kind: "unit_body" | "exercise_set";
    status: "succeeded" | "failed";
    cost: GenerationCost;
    creditsCharged: number;
    contentUnitId: string | null;
    createdBy: MembershipId;
    now: Date;
    errorMessage?: string;
  }): Promise<void> {
    await this.aiGenerations.record({
      id: params.id,
      schoolId: this.tenant.schoolId(),
      kind: params.kind,
      status: params.status,
      provider: "anthropic",
      model: params.cost.model,
      inputTokens: params.cost.inputTokens,
      outputTokens: params.cost.outputTokens,
      costCents: params.cost.costCents,
      creditsCharged: params.creditsCharged,
      contentUnitId: params.contentUnitId,
      requestedByMembershipId: params.createdBy.value,
      errorMessage: params.errorMessage ?? null,
      now: params.now,
    });
  }

  /** Paso 6: ajusta la reserva al coste real. Nunca deja sin registrar una diferencia a favor de la escuela. */
  private async settleCredits(params: {
    actualCredits: number;
    unitBodyGenerationId: string;
    code: string;
  }): Promise<void> {
    const diff = ESTIMATED_CREDITS_RESERVE - params.actualCredits;
    if (diff > 0) {
      await this.uow.execute(() =>
        this.creditLedger.refund({
          credits: diff,
          note: `Ajuste de la reserva de la unidad «${params.code}»: coste real ${params.actualCredits} créditos`,
          aiGenerationId: params.unitBodyGenerationId,
        }),
      );
      return;
    }
    if (diff < 0) {
      // El coste real superó la reserva: se intenta cobrar la diferencia,
      // pero un tope duro que lo impida no deshace una generación que ya
      // tuvo éxito y ya se guardó — «el vídeo... nunca bloquea la
      // publicación» es el mismo principio aplicado aquí: una vez generado
      // y persistido, no se destruye por un desajuste de céntimos.
      try {
        await this.uow.execute(() =>
          this.creditLedger.spend({
            credits: -diff,
            note: `Ajuste de la reserva de la unidad «${params.code}»: coste real ${params.actualCredits} créditos`,
            aiGenerationId: params.unitBodyGenerationId,
          }),
        );
      } catch (error) {
        this.logger.warn(
          { err: error instanceof Error ? error : new Error(String(error)) },
          `No se pudo cobrar el exceso de ${-diff} créditos de la unidad «${params.code}» sobre lo reservado: ` +
            `la unidad ya se generó y se guarda igual.`,
        );
      }
    }
  }
}
