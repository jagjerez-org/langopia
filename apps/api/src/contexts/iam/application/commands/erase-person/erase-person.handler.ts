import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  PersonAlreadyErasedError,
  PersonHasOtherSchoolMembershipsError,
} from "../../../domain/errors/personal-data.errors.js";
import {
  ERASED_EMAIL_DOMAIN,
  ERASED_NAME_MARKER,
  PERSON_ERASURE_REPOSITORY,
  type PersonErasureRepository,
} from "../../../domain/ports/person-erasure.port.js";
import {
  IAM_RECORDING_STORAGE,
  type RecordingStoragePort,
} from "../../../domain/ports/recording-storage.port.js";
import { ErasePersonCommand } from "./erase-person.command.js";

/**
 * Borrado a petición (Tarea 15, RGPD).
 *
 * Seudonimiza, no borra filas: un `DELETE` en cascada se llevaría por delante
 * la contabilidad, que hay que conservar por ley fiscal (brief, verbatim).
 * Por eso este manejador nunca toca `invoices` — ni falta que hace: el
 * nombre y el correo de la factura se leen siempre por `JOIN` contra
 * `users`, así que pseudonimizar esa única fila basta para que cualquier
 * factura pasada se muestre ya sin datos personales, con el importe intacto.
 *
 * Irreversible por diseño, y con rol `owner` (lo exige el guardia de la
 * ruta, `PersonalDataController`). Tres redes de seguridad antes de escribir
 * nada:
 *   1. `isAlreadyErased`: repetir el borrado no tiene nada que hacer.
 *   2. `hasOtherActiveSchoolMemberships`: `users` es GLOBAL — la misma
 *      persona puede dar clase en dos escuelas (caso real del seed). Borrar
 *      su nombre aquí se lo borraría también a la otra escuela, que no lo ha
 *      pedido. Se rechaza el borrado ENTERO antes que hacerlo a medias.
 *   3. Las grabaciones solo se borran de verdad cuando esta persona fue la
 *      ÚNICA alumna de la sesión (clase 1 a 1): una clase de grupo no pierde
 *      su grabación porque uno de varios alumnos se vaya. Para esas
 *      sesiones compartidas, se anonimiza el ENLACE de identidad en
 *      `transcript_segments` (`speakerMembershipId`, `speakerLabel`), pero
 *      se conserva `text`: es la conversación de la clase entera, no solo la
 *      suya.
 */
@CommandHandler(ErasePersonCommand)
export class ErasePersonHandler implements ICommandHandler<ErasePersonCommand> {
  constructor(
    @Inject(PERSON_ERASURE_REPOSITORY) private readonly erasure: PersonErasureRepository,
    @Inject(IAM_RECORDING_STORAGE) private readonly storage: RecordingStoragePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: ErasePersonCommand) {
    const { membershipId } = command.props;

    return this.uow.execute(async () => {
      const target = await this.erasure.findTarget(membershipId);
      if (!target) throw new NotFoundError("la persona", membershipId);

      if (await this.erasure.isAlreadyErased(target.userId)) {
        throw new PersonAlreadyErasedError(membershipId);
      }
      if (await this.erasure.hasOtherActiveSchoolMemberships(target.userId)) {
        throw new PersonHasOtherSchoolMembershipsError(membershipId);
      }

      let recordingsDeleted = 0;
      if (target.studentProfileId) {
        const privateRecordings = await this.erasure.privateRecordingsOf(target.studentProfileId);
        for (const recording of privateRecordings) {
          await this.storage.delete(recording.recordingStorageKey);
          await this.erasure.clearRecording(recording.transcriptId);
          recordingsDeleted++;
        }
      }

      const segmentsAnonymized = await this.erasure.anonymizeSpeakerSegments(membershipId);

      const emailMarker = `erased-${this.ids.generate()}@${ERASED_EMAIL_DOMAIN}`;
      await this.erasure.pseudonymizeIdentity({
        userId: target.userId,
        nameMarker: ERASED_NAME_MARKER,
        emailMarker,
      });

      const erasedAt = this.clock.now();
      // `before`/`after` nunca llevan el nombre ni el correo reales: son
      // justo los datos que este borrado existe para hacer desaparecer, y
      // dejarlos aquí los resucitaría en un registro append-only.
      await this.auditLog.record({
        schoolId: this.tenant.schoolId(),
        actorKind: "user",
        actorMembershipId: this.tenant.membershipId(),
        action: "iam.person.erased",
        entityType: "membership",
        entityId: membershipId,
        before: { role: target.role },
        after: { recordingsDeleted, segmentsAnonymized },
      });

      return {
        membershipId,
        erasedAt: erasedAt.toISOString(),
        recordingsDeleted,
        segmentsAnonymized,
      };
    });
  }
}
