import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Course } from "../../domain/model/course.aggregate.js";
import type { CourseId } from "../../domain/model/identifiers.js";
import type { CourseRepository } from "../../domain/ports/course.repository.port.js";
import { CourseMapper } from "./course.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que RLS lo filtra
 * todo por debajo.
 */
@Injectable()
export class DrizzleCourseRepository implements CourseRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: CourseId): Promise<Course | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const translations = await this.drizzle.db
      .select()
      .from(schema.courseTranslations)
      .where(eq(schema.courseTranslations.courseId, row.id));

    return CourseMapper.toDomain(row, translations);
  }

  async findOrFail(id: CourseId): Promise<Course> {
    const course = await this.find(id);
    if (!course) throw new NotFoundError("el curso", id.value);
    return course;
  }

  async save(course: Course): Promise<void> {
    const { course: row, translations } = CourseMapper.toPersistence(course);

    await this.drizzle.db
      .insert(schema.courses)
      .values(row)
      .onConflictDoUpdate({
        target: schema.courses.id,
        set: {
          priceCents: row.priceCents,
          currency: row.currency,
          isActive: row.isActive,
        },
      });

    // En serie y dentro de la transacción del `uow`: o se guarda todo el
    // curso o nada. Un curso tiene, como mucho, un puñado de idiomas.
    for (const translation of translations) {
      await this.drizzle.db
        .insert(schema.courseTranslations)
        .values(translation)
        .onConflictDoUpdate({
          target: [schema.courseTranslations.courseId, schema.courseTranslations.locale],
          set: { name: translation.name, description: translation.description ?? null },
        });
    }
  }
}
