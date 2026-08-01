import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { CancellationPreview } from "@langopia/contracts";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { CancellingParty } from "../../../domain/model/cancellation.vo.js";
import { SessionId } from "../../../domain/model/identifiers.js";
import {
  CLASS_SESSION_REPOSITORY,
  type ClassSessionRepository,
} from "../../../domain/ports/class-session.repository.port.js";
import {
  SCHOOL_SCHEDULING_POLICY_PORT,
  type SchoolSchedulingPolicyPort,
} from "../../../domain/ports/school-scheduling-policy.port.js";

export class GetCancellationPreviewQuery extends Query<CancellationPreview> {
  constructor(readonly props: { sessionId: string; party: CancellingParty }) {
    super();
  }
}

/**
 * Adelanto de lo que decidiría `CancelClassSessionHandler`, sin cancelar nada.
 *
 * El brief de la Tarea 9 del panel exige mostrar, ANTES de confirmar, si una
 * cancelación generará devolución — y `OLA-1-WEB.md` prohíbe que el panel
 * calcule ese plazo por su cuenta («cero lógica de negocio en el
 * frontend»). No hay forma de cumplir las dos cosas a la vez sin una
 * consulta como esta: invoca la MISMA `CancellationPolicy` que usaría la
 * cancelación real, en modo lectura (`uow.read`, no `uow.execute`) — no
 * cancela la clase, no guarda nada, no emite ningún evento. Si mañana la
 * política deja de ser un valor por defecto fijo, este adelanto sigue
 * siendo exacto porque es literalmente la misma regla, no una copia.
 */
@QueryHandler(GetCancellationPreviewQuery)
export class GetCancellationPreviewHandler
  implements IQueryHandler<GetCancellationPreviewQuery>
{
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY) private readonly sessions: ClassSessionRepository,
    @Inject(SCHOOL_SCHEDULING_POLICY_PORT) private readonly policy: SchoolSchedulingPolicyPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: GetCancellationPreviewQuery): Promise<CancellationPreview> {
    const now = this.clock.now();
    return this.uow.read(async () => {
      const session = await this.sessions.findOrFail(SessionId.of(query.props.sessionId));
      const cancellationPolicy = await this.policy.cancellationPolicy();
      const refundDue = cancellationPolicy.refundDueFor({
        party: query.props.party,
        slot: session.slot,
        canceledAt: now,
      });
      return {
        refundDue,
        noticeHours: Math.round(session.slot.hoursOfNoticeFrom(now) * 100) / 100,
      };
    });
  }
}
