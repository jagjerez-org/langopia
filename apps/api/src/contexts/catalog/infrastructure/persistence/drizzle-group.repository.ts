import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Group } from "../../domain/model/group.aggregate.js";
import type { GroupId } from "../../domain/model/identifiers.js";
import type { GroupRepository } from "../../domain/ports/group.repository.port.js";
import { GroupMapper } from "./group.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que RLS lo filtra
 * todo por debajo.
 */
@Injectable()
export class DrizzleGroupRepository implements GroupRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: GroupId): Promise<Group | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const enrollments = await this.drizzle.db
      .select()
      .from(schema.enrollments)
      .where(eq(schema.enrollments.groupId, row.id));

    return GroupMapper.toDomain(row, enrollments);
  }

  async findOrFail(id: GroupId): Promise<Group> {
    const group = await this.find(id);
    if (!group) throw new NotFoundError("el grupo", id.value);
    return group;
  }

  async save(group: Group): Promise<void> {
    const { group: row, enrollments } = GroupMapper.toPersistence(group);

    await this.drizzle.db
      .insert(schema.groups)
      .values(row)
      .onConflictDoUpdate({
        target: schema.groups.id,
        set: {
          teacherProfileId: row.teacherProfileId ?? null,
          name: row.name,
          endsOn: row.endsOn ?? null,
          status: row.status,
        },
      });

    // En serie y dentro de la transacción del `uow`: la capacidad de un
    // grupo depende de ver TODAS sus matrículas a la vez, y su cardinalidad
    // es baja (unos pocos alumnos por grupo).
    for (const enrollment of enrollments) {
      await this.drizzle.db
        .insert(schema.enrollments)
        .values(enrollment)
        .onConflictDoUpdate({
          target: schema.enrollments.id,
          set: {
            status: enrollment.status,
            agreedPriceCents: enrollment.agreedPriceCents ?? null,
            endedAt: enrollment.endedAt ?? null,
            endedReason: enrollment.endedReason ?? null,
          },
        });
    }
  }
}
