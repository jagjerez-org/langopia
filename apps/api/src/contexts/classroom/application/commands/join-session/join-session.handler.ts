import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  NotEnrolledInSessionError,
  RoomNotReadyError,
} from "../../../domain/errors/classroom.errors.js";
import { RoomProvider } from "../../../domain/model/room-provider.js";
import {
  ROOM_PROVIDER_PORT,
  type JoinToken,
  type RoomProviderPort,
} from "../../../domain/ports/room-provider.port.js";
import {
  SESSION_PARTICIPATION_PORT,
  type SessionParticipationPort,
} from "../../../domain/ports/session-participation.port.js";
import {
  SESSION_ROOM_PORT,
  type SessionRoomPort,
} from "../../../domain/ports/session-room.port.js";
import {
  TRANSCRIPT_REPOSITORY,
  type RecordingConsentStatus,
  type TranscriptRepositoryPort,
} from "../../../domain/ports/transcript-repository.port.js";
import { JoinClassroomSessionCommand } from "./join-session.command.js";

/**
 * Lo que de verdad devuelve `POST /classroom/sessions/:id/join` (Tarea 11 del
 * panel: aula del profesor, Paso 4): el token de la sala, y el estado de
 * grabación que el servidor ya decidió para esta clase. El aula lo muestra
 * tal cual —nunca calcula ella misma si todos los participantes han dado su
 * consentimiento—, así que viaja en la MISMA respuesta que abre la puerta, no
 * en una consulta aparte que la pantalla podría olvidar pedir.
 */
export type ClassroomJoinResult = JoinToken & { recording: RecordingConsentStatus };

/**
 * Emite el token para entrar a la sala de una clase.
 *
 * No comprueba consentimiento: este endpoint solo abre la puerta, no empieza
 * a grabar ni a transcribir — eso es una decisión aparte (módulo 13) que
 * vuelve a preguntar antes de encender nada, tal y como exige el plan de la
 * ola. Unirse a la clase y grabarla no son la misma acción.
 *
 * Sí comprueba la matrícula, desde el saneamiento de cierre de la ola 1.
 * Antes bastaba con tener un rol de la escuela: RLS aísla escuelas, no
 * personas dentro de una escuela, así que cualquier alumno podía pedir el
 * token de CUALQUIER clase de su escuela y colarse en el grupo de otro. La
 * comprobación se le aplica a quien entra como alumno o tutor; al personal
 * de la escuela (`owner`, `admin`, `teacher`) no, porque entrar a un aula es
 * parte de su trabajo y `scheduling` tampoco les pide estar en el grupo para
 * cancelar o replanificar la clase.
 */
@CommandHandler(JoinClassroomSessionCommand)
export class JoinClassroomSessionHandler
  implements ICommandHandler<JoinClassroomSessionCommand>
{
  constructor(
    @Inject(SESSION_ROOM_PORT) private readonly sessionRooms: SessionRoomPort,
    @Inject(SESSION_PARTICIPATION_PORT)
    private readonly participation: SessionParticipationPort,
    @Inject(ROOM_PROVIDER_PORT) private readonly roomProviders: RoomProviderPort,
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(command: JoinClassroomSessionCommand): Promise<ClassroomJoinResult> {
    const { sessionId } = command.props;

    // Solo lectura, pero dentro de la unidad de trabajo igualmente: sin
    // contexto de escuela, RLS no dejaría ver la fila y parecería que la
    // clase no existe.
    const snapshot = await this.uow.read(() => this.sessionRooms.find(sessionId));
    if (!snapshot) throw new NotFoundError("la clase", sessionId);

    if (snapshot.provider === RoomProvider.InPerson) {
      throw new RoomNotReadyError(sessionId, "in_person");
    }
    if (!snapshot.url) {
      throw new RoomNotReadyError(sessionId, "pending_oauth");
    }

    const participantId = this.tenant.membershipId();
    if (!participantId) {
      // Un guardia de rol ya exige una membresía activa para llegar hasta
      // aquí: si esto se lanza, el fallo está en la guardia, no en la
      // petición. No es un error de negocio traducible; sale como 500 con
      // registro completo, que es lo correcto para un estado que no debería
      // alcanzarse nunca.
      throw new Error(`No se pudo determinar quién entra a la clase ${sessionId}.`);
    }

    if (!this.esPersonalDeLaEscuela()) {
      const matriculado = await this.uow.read(() =>
        this.participation.isEnrolledInSessionGroup(sessionId, participantId),
      );
      if (!matriculado) throw new NotEnrolledInSessionError(sessionId);
    }

    const token = await this.roomProviders.issueJoinToken({
      sessionId,
      provider: snapshot.provider,
      url: snapshot.url,
      externalId: snapshot.externalId,
      participantId,
    });

    const recording = await this.uow.read(() =>
      this.transcripts.recordingStatusForSession(sessionId),
    );

    return { ...token, recording: recording ?? { blocked: false, blockedReason: null } };
  }

  /**
   * `owner`, `admin` y `teacher` entran sin estar matriculados: es su
   * trabajo. Se pregunta por los roles del personal y no por «¿es alumno?»
   * a propósito — quien tiene los dos (una profesora que además estudia otro
   * idioma en la misma escuela) sigue entrando como personal, y un rol nuevo
   * que no sea de dirección nace teniendo que estar matriculado, que es el
   * lado seguro.
   */
  private esPersonalDeLaEscuela(): boolean {
    return ["owner", "admin", "teacher"].some((rol) => this.tenant.has(rol));
  }
}
