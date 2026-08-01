import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { TeacherId } from "../../domain/model/identifiers.js";
import type { Teacher } from "../../domain/model/teacher.aggregate.js";
import type { TeacherRepository } from "../../domain/ports/teacher.repository.port.js";
import { TeacherMapper } from "./teacher.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Igual que `DrizzleStudentRepository`: ninguna consulta filtra por
 * `school_id` a mano, lo hace RLS con el tenant que ya fijó la transacción de
 * `uow.execute()`/`uow.read()`.
 */
@Injectable()
export class DrizzleTeacherRepository implements TeacherRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: TeacherId): Promise<Teacher | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.teacherProfiles)
      .where(eq(schema.teacherProfiles.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const availabilityRows = await this.drizzle.db
      .select()
      .from(schema.teacherAvailability)
      .where(eq(schema.teacherAvailability.teacherProfileId, row.id));

    return TeacherMapper.toDomain(row, availabilityRows);
  }

  async findOrFail(id: TeacherId): Promise<Teacher> {
    const teacher = await this.find(id);
    if (!teacher) throw new NotFoundError("el profesor", id.value);
    return teacher;
  }

  async save(teacher: Teacher): Promise<void> {
    const { teacher: row, availability } = TeacherMapper.toPersistence(teacher);

    await this.drizzle.db
      .insert(schema.teacherProfiles)
      .values(row)
      .onConflictDoUpdate({
        target: schema.teacherProfiles.id,
        set: {
          tier: row.tier,
          hourlyRateCents: row.hourlyRateCents,
          contractedHoursWeek: row.contractedHoursWeek,
          status: row.status,
          leftReason: row.leftReason ?? null,
        },
      });

    // `PUT /teachers/:id/availability` reemplaza la semana entera: se borra
    // lo que hubiera y se inserta el conjunto actual, en vez de intentar un
    // upsert franja a franja que tendría que decidir qué borrar igualmente.
    await this.drizzle.db
      .delete(schema.teacherAvailability)
      .where(eq(schema.teacherAvailability.teacherProfileId, teacher.id.value));

    if (availability.length > 0) {
      await this.drizzle.db.insert(schema.teacherAvailability).values(availability);
    }
  }
}
