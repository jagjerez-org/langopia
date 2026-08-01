import * as schema from "@langopia/db/schema";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CourseModality } from "../../domain/model/course-modality.js";
import { Course, type CourseTranslation } from "../../domain/model/course.aggregate.js";
import { CourseId } from "../../domain/model/identifiers.js";

type CourseRow = typeof schema.courses.$inferSelect;
type CourseInsert = typeof schema.courses.$inferInsert;
type TranslationRow = typeof schema.courseTranslations.$inferSelect;
type TranslationInsert = typeof schema.courseTranslations.$inferInsert;

/**
 * Traductor entre el agregado `Course` y dos tablas: `courses` y
 * `course_translations`. Sigue el patrón de `ClassSessionMapper`: `toDomain`
 * usa `rehydrate`, que no valida ni emite eventos.
 */
export class CourseMapper {
  static toDomain(row: CourseRow, translationRows: TranslationRow[]): Course {
    const translations: CourseTranslation[] = translationRows.map((t) => ({
      locale: t.locale,
      name: t.name,
      description: t.description,
    }));

    return Course.rehydrate({
      id: CourseId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      code: row.code,
      language: row.language,
      level: row.level as CefrLevel,
      modality: row.modality as CourseModality,
      totalSessions: row.totalSessions,
      sessionMinutes: row.sessionMinutes,
      maxStudents: row.maxStudents,
      priceCents: row.priceCents,
      currency: row.currency,
      isActive: row.isActive,
      translations,
    });
  }

  static toPersistence(course: Course): { course: CourseInsert; translations: TranslationInsert[] } {
    return {
      course: {
        id: course.id.value,
        schoolId: course.schoolId.value,
        code: course.code,
        language: course.language,
        level: course.level,
        modality: course.modality,
        totalSessions: course.totalSessions,
        sessionMinutes: course.sessionMinutes,
        maxStudents: course.maxStudents,
        priceCents: course.priceCents,
        currency: course.currency,
        isActive: course.isActive,
      },
      translations: course.translations.map((t) => ({
        schoolId: course.schoolId.value,
        courseId: course.id.value,
        locale: t.locale,
        name: t.name,
        description: t.description,
      })),
    };
  }
}
