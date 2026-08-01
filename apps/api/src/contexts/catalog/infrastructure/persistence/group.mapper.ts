import * as schema from "@langopia/db/schema";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Enrollment } from "../../domain/model/enrollment.entity.js";
import { EnrollmentStatus } from "../../domain/model/enrollment-status.js";
import { GroupStatus } from "../../domain/model/group-status.js";
import { Group } from "../../domain/model/group.aggregate.js";
import { CourseId, EnrollmentId, GroupId, StudentId, TeacherId } from "../../domain/model/identifiers.js";

type GroupRow = typeof schema.groups.$inferSelect;
type GroupInsert = typeof schema.groups.$inferInsert;
type EnrollmentRow = typeof schema.enrollments.$inferSelect;
type EnrollmentInsert = typeof schema.enrollments.$inferInsert;

/** Fecha `date` de Postgres a medianoche UTC, igual que en `StudentMapper`. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function utcToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Traductor entre el agregado `Group` (con sus matrículas) y dos tablas:
 * `groups` y `enrollments`. Sigue el patrón de `StudentMapper`: `toDomain`
 * usa `rehydrate`, que no valida ni emite eventos.
 */
export class GroupMapper {
  static toDomain(row: GroupRow, enrollmentRows: EnrollmentRow[]): Group {
    const enrollments = enrollmentRows.map((e) =>
      Enrollment.rehydrate({
        id: EnrollmentId.of(e.id),
        groupId: GroupId.of(row.id),
        studentId: StudentId.of(e.studentProfileId),
        status: e.status as EnrollmentStatus,
        agreedPriceCents: e.agreedPriceCents,
        enrolledAt: e.enrolledAt,
        endedAt: e.endedAt,
        endedReason: e.endedReason,
      }),
    );

    return Group.rehydrate({
      id: GroupId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      courseId: CourseId.of(row.courseId),
      teacherId: row.teacherProfileId ? TeacherId.of(row.teacherProfileId) : null,
      name: row.name,
      capacity: row.capacity,
      startsOn: dateOnlyToUtc(row.startsOn),
      endsOn: row.endsOn ? dateOnlyToUtc(row.endsOn) : null,
      status: row.status as GroupStatus,
      enrollments,
    });
  }

  static toPersistence(group: Group): { group: GroupInsert; enrollments: EnrollmentInsert[] } {
    return {
      group: {
        id: group.id.value,
        schoolId: group.schoolId.value,
        courseId: group.courseId.value,
        teacherProfileId: group.teacherId?.value ?? null,
        name: group.name,
        capacity: group.capacity,
        startsOn: utcToDateOnly(group.startsOn),
        endsOn: group.endsOn ? utcToDateOnly(group.endsOn) : null,
        status: group.status,
      },
      enrollments: group.enrollments.map((e) => ({
        id: e.id.value,
        schoolId: group.schoolId.value,
        groupId: group.id.value,
        studentProfileId: e.studentId.value,
        status: e.status,
        agreedPriceCents: e.agreedPriceCents,
        enrolledAt: e.enrolledAt,
        endedAt: e.endedAt,
        endedReason: e.endedReason,
      })),
    };
  }
}
