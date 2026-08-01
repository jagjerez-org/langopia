import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { SrsCard } from "../../../domain/model/srs-card.aggregate.js";
import {
  SCHOOL_CALENDAR_PORT,
  type SchoolCalendarPort,
} from "../../../domain/ports/school-calendar.port.js";
import {
  SRS_CARD_REPOSITORY,
  type SrsCardRepository,
} from "../../../domain/ports/srs-card.repository.port.js";

/**
 * Tope de tarjetas por sesión de repaso.
 *
 * El alumno que desaparece un mes y vuelve se encuentra con un atraso real,
 * pero no ve TODO el atraso de golpe: una lista de trescientas tarjetas
 * vencidas desanima más de lo que ayuda. `findDueForStudent` ya devuelve las
 * más vencidas primero, así que un tope fijo hace que el repaso de hoy sea
 * siempre abarcable y el resto drene en los días siguientes, según el alumno
 * siga entrando — no hace falta ninguna otra regla para eso, basta con no
 * enseñarlo todo de una vez.
 */
export const MAX_DUE_CARDS_PER_SESSION = 20;

/** Forma de salida: los datos de la tarjeta, sin el objeto de dominio. */
export type DueCard = {
  id: string;
  exerciseId: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueOn: string;
  lastReviewedAt: Date | null;
};

export class GetDueCardsQuery extends Query<DueCard[]> {
  constructor(readonly props: { studentProfileId: string }) {
    super();
  }
}

/**
 * Tarjetas de repaso pendientes de hoy para un alumno (tarea 9, paso 5).
 *
 * «Hoy» lo resuelve `SchoolCalendarPort` en la zona horaria de la ESCUELA, no
 * la del servidor: la misma razón por la que `OnAttemptAiGraded` usa el mismo
 * puerto al crear la tarjeta. Sin este paso, un alumno de una escuela en otro
 * huso horario vería su repaso de hoy aparecer o desaparecer según la hora
 * del servidor, no la suya.
 */
@QueryHandler(GetDueCardsQuery)
export class GetDueCardsHandler implements IQueryHandler<GetDueCardsQuery> {
  constructor(
    @Inject(SRS_CARD_REPOSITORY) private readonly cards: SrsCardRepository,
    @Inject(SCHOOL_CALENDAR_PORT) private readonly calendar: SchoolCalendarPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: GetDueCardsQuery): Promise<DueCard[]> {
    const now = this.clock.now();
    return this.uow.read(async () => {
      const today = await this.calendar.today(now);
      const due = await this.cards.findDueForStudent({
        studentProfileId: query.props.studentProfileId,
        onOrBefore: today,
        limit: MAX_DUE_CARDS_PER_SESSION,
      });
      return due.map(toDueCard);
    });
  }
}

function toDueCard(card: SrsCard): DueCard {
  if (!card.exerciseId) {
    throw new Error("Una tarjeta de vocabulario no puede salir por el listado de ejercicios pendientes.");
  }
  return {
    id: card.id.value,
    exerciseId: card.exerciseId.value,
    ease: card.ease,
    intervalDays: card.intervalDays,
    repetitions: card.repetitions,
    lapses: card.lapses,
    dueOn: card.dueOn,
    lastReviewedAt: card.lastReviewedAt,
  };
}
