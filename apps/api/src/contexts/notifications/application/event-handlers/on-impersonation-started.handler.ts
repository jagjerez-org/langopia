import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ImpersonationStarted } from "../../../iam/domain/events/impersonation.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { resolveMembershipRecipient } from "../../domain/model/recipient-resolver.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";

/**
 * Notifica a quien ha sido impersonado y, si es menor, TAMBIÉN a su tutor —
 * siempre, sin excepción, aunque algún día la escuela pueda apagar otros
 * avisos: no existe hoy ningún interruptor de avisos en el código (se ha
 * comprobado), así que esta garantía se cumple porque no hay nada que la
 * pueda desactivar; si alguna vez se añade uno, este envío tiene que quedar
 * fuera.
 *
 * `iam` no sabe que `notifications` existe: publicó `ImpersonationStarted` y
 * siguió. Lo único que se importa de `iam` es la CLASE DEL EVENTO — su
 * contrato público — nunca su agregado ni sus repositorios.
 *
 * `guardianMembershipIds` ya viene resuelto por `iam` (vía su propia capa
 * anticorrupción hacia `people`, `MinorGuardianLookupPort`): este manejador
 * no vuelve a preguntar quién es el tutor, solo a quién escribirle — la
 * misma pregunta que ya resuelve `findMembershipRecipient` para cualquier
 * otra membresía, sea alumno, tutor, profesor o dueño.
 */
@EventsHandler(ImpersonationStarted)
export class OnImpersonationStarted implements IEventHandler<ImpersonationStarted> {
  constructor(
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnImpersonationStarted.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ImpersonationStarted): Promise<void> {
    const { targetMembershipId, impersonatorName, reason, involvesMinor, guardianMembershipIds } =
      event.payload();

    const recipientMembershipIds = involvesMinor
      ? [targetMembershipId, ...guardianMembershipIds]
      : [targetMembershipId];

    for (const membershipId of recipientMembershipIds) {
      const candidate = await this.uow.read(() => this.people.findMembershipRecipient(membershipId));
      if (!candidate) {
        this.logger.error(
          `Impersonación sobre ${targetMembershipId}: la membresía ${membershipId} no tiene ficha; no se le avisa.`,
        );
        continue;
      }

      const recipient = resolveMembershipRecipient(candidate);
      try {
        await this.mailer.send({
          to: recipient.email,
          locale: recipient.locale,
          template: "impersonation_started",
          data: { name: recipient.name, impersonatorName, reason },
        });
        this.logger.info(`Aviso de impersonación enviado a la membresía ${membershipId}.`);
      } catch (error) {
        this.logger.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          `No se pudo avisar de la impersonación a la membresía ${membershipId}: se reintentará.`,
        );
      }
    }
  }
}
