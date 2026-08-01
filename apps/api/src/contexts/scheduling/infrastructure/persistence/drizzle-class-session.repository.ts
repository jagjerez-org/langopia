import { Injectable } from "@nestjs/common";
import { and, eq, gt, gte, lt, lte, ne } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { ClassSession } from "../../domain/model/class-session.aggregate.js";
import type { GroupId, SessionId, TeacherId } from "../../domain/model/identifiers.js";
import type { TimeSlot } from "../../domain/model/time-slot.vo.js";
import type { ClassSessionRepository } from "../../domain/ports/class-session.repository.port.js";
import { ClassSessionMapper } from "./class-session.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano, y no es un descuido: la
 * conexión lleva el rol `langopia_app` y la transacción fija
 * `app.school_id`, así que las políticas RLS lo filtran todo por debajo.
 * Añadir el filtro aquí daría una falsa sensación de seguridad —parecería
 * que la protección está en el código, cuando está en la base de datos.
 */
@Injectable()
export class DrizzleClassSessionRepository implements ClassSessionRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: SessionId): Promise<ClassSession | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id.value))
      .limit(1);
    return rows[0] ? ClassSessionMapper.toDomain(rows[0]) : null;
  }

  async findOrFail(id: SessionId): Promise<ClassSession> {
    const session = await this.find(id);
    if (!session) throw new NotFoundError("la clase", id.value);
    return session;
  }

  async save(session: ClassSession): Promise<void> {
    const row = ClassSessionMapper.toPersistence(session);
    await this.drizzle.db
      .insert(schema.sessions)
      .values(row)
      .onConflictDoUpdate({
        target: schema.sessions.id,
        set: {
          teacherProfileId: row.teacherProfileId ?? null,
          scheduledStart: row.scheduledStart,
          scheduledEnd: row.scheduledEnd,
          actualStart: row.actualStart ?? null,
          actualEnd: row.actualEnd ?? null,
          status: row.status,
          topic: row.topic ?? null,
          contentUnitId: row.contentUnitId ?? null,
          roomProvider: row.roomProvider,
          roomUrl: row.roomUrl ?? null,
          roomExternalId: row.roomExternalId ?? null,
          canceledAt: row.canceledAt ?? null,
          canceledByMembershipId: row.canceledByMembershipId ?? null,
          cancelReason: row.cancelReason ?? null,
          cancelNoticeHours: row.cancelNoticeHours ?? null,
          cancelRefundDue: row.cancelRefundDue ?? null,
          rescheduledFromSessionId: row.rescheduledFromSessionId ?? null,
        },
      });
  }

  async saveMany(sessions: ClassSession[]): Promise<void> {
    // En serie y dentro de la transacción que abrió la unidad de trabajo:
    // o se guardan todas o ninguna.
    for (const session of sessions) await this.save(session);
  }

  async findOverlappingForTeacher(params: {
    teacherId: TeacherId;
    slot: TimeSlot;
    excluding?: SessionId;
  }): Promise<ClassSession[]> {
    // Dos franjas se solapan si cada una empieza antes de que acabe la otra.
    // Tocarse no cuenta: una clase que acaba a las 18:00 y otra que empieza a
    // las 18:00 son compatibles.
    const conditions = [
      eq(schema.sessions.teacherProfileId, params.teacherId.value),
      lt(schema.sessions.scheduledStart, params.slot.end),
      gt(schema.sessions.scheduledEnd, params.slot.start),
    ];
    if (params.excluding) {
      conditions.push(ne(schema.sessions.id, params.excluding.value));
    }

    const rows = await this.drizzle.db
      .select()
      .from(schema.sessions)
      .where(and(...conditions));
    return rows.map(ClassSessionMapper.toDomain);
  }

  async findByGroupBetween(params: {
    groupId: GroupId;
    from: Date;
    to: Date;
  }): Promise<ClassSession[]> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.groupId, params.groupId.value),
          gte(schema.sessions.scheduledStart, params.from),
          lte(schema.sessions.scheduledStart, params.to),
        ),
      )
      .orderBy(schema.sessions.scheduledStart);
    return rows.map(ClassSessionMapper.toDomain);
  }
}
