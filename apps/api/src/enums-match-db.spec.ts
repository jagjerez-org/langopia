// Los estados, roles y tipos se declaran en el dominio (que no puede importar
// `@langopia/db`) y como `pgEnum` en el esquema. Esta prueba es lo único que
// impide que se separen: vive fuera de `contexts/`, así que puede importar
// los dos lados.
//
// `@langopia/db` solo expone `.` y `./schema` en su campo `exports` (no un
// subcamino `./schema/enums`), así que se importa por `./schema`, que ya
// reexporta todos los enums.
import * as pg from "@langopia/db/schema";
import { describe, expect, it } from "vitest";
import { AttemptStatus } from "./contexts/assessment/domain/model/attempt.aggregate.js";
import { ExamStatus } from "./contexts/assessment/domain/model/exam.aggregate.js";
import { CreditReason } from "./contexts/billing/domain/model/credit-balance.aggregate.js";
import { InvoiceDirection } from "./contexts/billing/domain/model/invoice-direction.js";
import { InvoiceStatus } from "./contexts/billing/domain/model/invoice-status.js";
import { CourseModality } from "./contexts/catalog/domain/model/course-modality.js";
import { EnrollmentStatus } from "./contexts/catalog/domain/model/enrollment-status.js";
import { GroupStatus } from "./contexts/catalog/domain/model/group-status.js";
import {
  ContentSource,
  ContentStatus,
} from "./contexts/learning/domain/model/content-unit.aggregate.js";
import { ExerciseType } from "./contexts/learning/domain/model/exercise-schemas.js";
import { MaterialFormat } from "./contexts/learning/domain/model/uploaded-material.vo.js";
import { ConsentKind } from "./contexts/people/domain/model/consent.vo.js";
import { TeacherTier } from "./contexts/people/domain/model/hourly-rate.vo.js";
import { StudentStatus } from "./contexts/people/domain/model/student.aggregate.js";
import { TeacherStatus } from "./contexts/people/domain/model/teacher.aggregate.js";
import { AttendanceSource, AttendanceStatus } from "./contexts/scheduling/domain/model/attendance-status.js";
import { RoomProvider } from "./contexts/scheduling/domain/model/room.vo.js";
import { SessionStatus } from "./contexts/scheduling/domain/model/session-status.js";
import { CefrLevel } from "./contexts/shared/domain/model/cefr-level.js";

// Cada pareja: el conjunto del dominio y su columna en Postgres.
//
// Al añadir un contexto se añade su pareja aquí. Un valor nuevo en un lado y
// no en el otro deja de ser un fallo que aparece en producción con un
// `invalid input value for enum`.
const PAIRS: Array<[string, Record<string, string>, { enumValues: readonly string[] }]> = [
  ["AttemptStatus", AttemptStatus, pg.attemptStatus],
  ["ExamStatus", ExamStatus, pg.assessmentStatus],
  ["SessionStatus", SessionStatus, pg.sessionStatus],
  ["RoomProvider", RoomProvider, pg.roomProvider],
  ["AttendanceStatus", AttendanceStatus, pg.attendanceStatus],
  ["AttendanceSource", AttendanceSource, pg.attendanceSource],
  ["StudentStatus", StudentStatus, pg.studentStatus],
  ["ConsentKind", ConsentKind, pg.consentKind],
  ["TeacherStatus", TeacherStatus, pg.teacherStatus],
  ["TeacherTier", TeacherTier, pg.teacherTier],
  ["CourseModality", CourseModality, pg.courseModality],
  ["GroupStatus", GroupStatus, pg.groupStatus],
  ["EnrollmentStatus", EnrollmentStatus, pg.enrollmentStatus],
  ["ContentStatus", ContentStatus, pg.contentStatus],
  ["ContentSource", ContentSource, pg.contentSource],
  ["ExerciseType", ExerciseType, pg.exerciseType],
  ["MaterialFormat", MaterialFormat, pg.materialFormat],
  ["CefrLevel", CefrLevel, pg.cefrLevel],
  ["InvoiceDirection", InvoiceDirection, pg.invoiceDirection],
  ["InvoiceStatus", InvoiceStatus, pg.invoiceStatus],
  ["CreditReason", CreditReason, pg.creditReason],
];

describe("los conjuntos del dominio coinciden con los de la base de datos", () => {
  it.each(PAIRS)("%s", (_name, domain, column) => {
    expect(Object.values(domain).sort()).toEqual([...column.enumValues].sort());
  });
});
