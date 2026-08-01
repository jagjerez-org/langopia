import * as schema from "@langopia/db/schema";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Cancellation, type CancellingParty } from "../../domain/model/cancellation.vo.js";
import {
  ClassSession,
  type SessionStatus,
} from "../../domain/model/class-session.aggregate.js";
import { GroupId, SessionId, TeacherId } from "../../domain/model/identifiers.js";
import { Room, type RoomProvider } from "../../domain/model/room.vo.js";
import { TimeSlot } from "../../domain/model/time-slot.vo.js";

type SessionRow = typeof schema.sessions.$inferSelect;
type SessionInsert = typeof schema.sessions.$inferInsert;

/**
 * Traductor entre la fila y el agregado.
 *
 * Existe para que el modelo de dominio no tenga que parecerse a una tabla.
 * `toDomain` usa `rehydrate`, que no valida ni emite eventos: lo que está
 * guardado ya pasó, y volver a validarlo haría que un cambio de reglas
 * rompiera la lectura de datos históricos.
 */
export class ClassSessionMapper {
  static toDomain(row: SessionRow): ClassSession {
    const cancellation =
      row.canceledAt && row.canceledByMembershipId
        ? Cancellation.of({
            at: row.canceledAt,
            by: MembershipId.of(row.canceledByMembershipId),
            party: partyFromStatus(row.status),
            reason: row.cancelReason ?? "",
            noticeHours: row.cancelNoticeHours ?? 0,
            refundDue: row.cancelRefundDue ?? false,
          })
        : null;

    return ClassSession.rehydrate({
      id: SessionId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      groupId: GroupId.of(row.groupId),
      teacherId: row.teacherProfileId ? TeacherId.of(row.teacherProfileId) : null,
      slot: TimeSlot.of(row.scheduledStart, row.scheduledEnd),
      room: Room.of({
        provider: row.roomProvider as RoomProvider,
        url: row.roomUrl,
        externalId: row.roomExternalId,
      }),
      status: row.status as SessionStatus,
      topic: row.topic,
      contentUnitId: row.contentUnitId,
      cancellation,
      rescheduledFrom: row.rescheduledFromSessionId
        ? SessionId.of(row.rescheduledFromSessionId)
        : null,
      actualStart: row.actualStart,
      actualEnd: row.actualEnd,
    });
  }

  static toPersistence(session: ClassSession): SessionInsert {
    const cancellation = session.cancellation;
    return {
      id: session.id.value,
      schoolId: session.schoolId.value,
      groupId: session.groupId.value,
      teacherProfileId: session.teacherId?.value ?? null,
      scheduledStart: session.slot.start,
      scheduledEnd: session.slot.end,
      actualStart: session.actualStart,
      actualEnd: session.actualEnd,
      status: session.status,
      topic: session.topic,
      contentUnitId: session.contentUnitId,
      roomProvider: session.room.provider,
      roomUrl: session.room.url,
      roomExternalId: session.room.externalId,
      canceledAt: cancellation?.at ?? null,
      canceledByMembershipId: cancellation?.by.value ?? null,
      cancelReason: cancellation?.reason ?? null,
      cancelNoticeHours: cancellation ? Math.round(cancellation.noticeHours) : null,
      cancelRefundDue: cancellation?.refundDue ?? null,
      rescheduledFromSessionId: session.rescheduledFrom?.value ?? null,
    };
  }
}

/**
 * El estado ya codifica quién canceló, así que no se guarda por duplicado.
 * Para cualquier otro estado el valor no se usa.
 */
function partyFromStatus(status: string): CancellingParty {
  return status === "canceled_by_student" ? "student" : "school";
}
