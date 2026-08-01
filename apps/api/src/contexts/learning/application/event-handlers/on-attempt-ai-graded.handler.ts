import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { AttemptAiGraded } from "../../../assessment/domain/events/attempt.events.js";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../shared/domain/ports/id-generator.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { SrsCard } from "../../domain/model/srs-card.aggregate.js";
import { ExerciseId, SrsCardId } from "../../domain/model/identifiers.js";
import {
  CONTENT_UNIT_REPOSITORY,
  type ContentUnitRepository,
} from "../../domain/ports/content-unit.repository.port.js";
import {
  SCHOOL_CALENDAR_PORT,
  type SchoolCalendarPort,
} from "../../domain/ports/school-calendar.port.js";
import {
  SRS_CARD_REPOSITORY,
  type SrsCardRepository,
} from "../../domain/ports/srs-card.repository.port.js";

/** Escala 0-5 de SM-2. Un intento perfecto (`aiScore === maxScore`) es un 5. */
const MAX_QUALITY = 5;
/** Por debajo de esto (mismo umbral que `SrsCard.review()`) el repaso cuenta como fallo. */
const FAILING_QUALITY = 3;

/**
 * Abre (o repite) la tarjeta de repaso espaciado de un ejercicio que un
 * alumno acaba de fallar (tarea 9, paso 4 del brief).
 *
 * Escucha `AttemptAiGraded`, no `AttemptTeacherValidated`: la regla de la ola
 * («la IA propone, el profesor firma») protege el EXPEDIENTE del alumno, y
 * una tarjeta de repaso no es el expediente — es una ayuda de memoria de bajo
 * riesgo, igual que la corrección automática ya se enseña al alumno de
 * inmediato (tarea 12: «corrección inmediata en los tipos automáticos») sin
 * esperar la firma de nadie. Esperar a `teacher_validated` (que puede tardar
 * días, o no llegar nunca en un ejercicio sin rúbrica) rompería el propósito
 * de la repetición espaciada: repasar pronto lo que se acaba de fallar.
 *
 * La nota del intento (`aiScore` sobre `maxScore` del ejercicio) se traduce a
 * la calificación 0-5 que pide SM-2 (`Math.round((aiScore/maxScore) * 5)`):
 * ni el evento ni `SrsCard` conocen `maxScore`, así que esta es la única
 * pieza que sabe traducir «una nota» a «qué tan bien lo hizo, en la escala del
 * algoritmo». Con esa calificación decidida, un fallo (`quality < 3`, el
 * mismo umbral que usa el propio agregado) abre tarjeta si no había, o repite
 * la que ya existía — nunca se abre una tarjeta nueva para un acierto.
 */
@EventsHandler(AttemptAiGraded)
export class OnAttemptAiGraded implements IEventHandler<AttemptAiGraded> {
  constructor(
    @Inject(SRS_CARD_REPOSITORY) private readonly cards: SrsCardRepository,
    @Inject(CONTENT_UNIT_REPOSITORY) private readonly exercises: ContentUnitRepository,
    @Inject(SCHOOL_CALENDAR_PORT) private readonly calendar: SchoolCalendarPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @InjectPinoLogger(OnAttemptAiGraded.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: AttemptAiGraded): Promise<void> {
    const data = event.payload();
    const now = this.clock.now();
    const exerciseId = ExerciseId.of(data.exerciseId);

    const outcome = await this.uow.execute(async () => {
      const exercise = await this.exercises.findExerciseSrsInfo(exerciseId);
      if (!exercise || !exercise.srsEnabled) return "not_srs" as const;

      const quality = qualityFromScore(data.aiScore, exercise.maxScore);
      if (quality >= FAILING_QUALITY) return "passed" as const;

      const today = await this.calendar.today(now);
      const existing = await this.cards.findByStudentAndExercise(data.studentProfileId, exerciseId);

      if (existing) {
        existing.review({ quality, today, now });
        await this.cards.save(existing);
        return "reviewed" as const;
      }

      const card = SrsCard.create({
        id: SrsCardId.of(this.ids.generate()),
        schoolId: SchoolId.of(event.schoolId),
        studentProfileId: data.studentProfileId,
        exerciseId,
        quality,
        today,
        now,
      });
      await this.cards.save(card);
      return "created" as const;
    });

    if (outcome === "created" || outcome === "reviewed") {
      this.logger.info(
        `Ejercicio ${data.exerciseId} fallado por el alumno ${data.studentProfileId}: tarjeta de ` +
          `repaso ${outcome === "created" ? "creada" : "reforzada"}.`,
      );
    }
  }
}

/** Traduce una nota sobre `maxScore` a la calificación 0-5 que pide SM-2. */
function qualityFromScore(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, score / maxScore));
  return Math.round(ratio * MAX_QUALITY);
}
