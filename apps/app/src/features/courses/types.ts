/**
 * Tipos del cliente para la Tarea 8 (Cursos y grupos), sobre los endpoints de
 * `catalog` — ninguno existía antes de esta tarea salvo las tres altas
 * (`POST /courses`, `POST /groups`, `POST /groups/:id/enrolments`, ola 1
 * backend); `GET /courses`, `GET /courses/locales` y `GET /groups/:id` los
 * añade esta misma tarea (ver el informe).
 */

export type CourseModality =
  | "private"
  | "group"
  | "intensive"
  | "exam_prep"
  | "business"
  | "conversation";

export type GroupStatus = "planned" | "running" | "finished" | "canceled";

export type CourseTranslation = { locale: string; name: string; description: string | null };

export type CourseGroupSummary = {
  groupId: string;
  name: string;
  teacherId: string | null;
  teacherName: string | null;
  capacity: number;
  startsOn: string;
  endsOn: string | null;
  status: GroupStatus;
};

/** Fila de `GET /courses`. */
export type CourseListItem = {
  courseId: string;
  code: string;
  language: string;
  level: string;
  modality: CourseModality;
  totalSessions: number;
  sessionMinutes: number;
  maxStudents: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  translations: CourseTranslation[];
  groups: CourseGroupSummary[];
};

/** Respuesta de `GET /courses/locales`. */
export type SchoolLocales = { defaultLocale: string; supportedLocales: string[] };

/** Cuerpo de `POST /courses`. */
export type CreateCourseInput = {
  code: string;
  language: string;
  level: string;
  modality: CourseModality;
  totalSessions?: number;
  sessionMinutes?: number;
  maxStudents?: number;
  priceCents: number;
  currency?: string;
  translations: CourseTranslation[];
};

export type CreateCourseResult = { courseId: string };

/** Cuerpo de `POST /groups`. */
export type CreateGroupInput = {
  courseId: string;
  teacherId?: string | null;
  name: string;
  startsOn: string;
  endsOn?: string | null;
};

export type CreateGroupResult = { groupId: string };

/** Ficha de `GET /groups/:id`. */
export type GroupDetail = {
  groupId: string;
  courseId: string;
  courseCode: string;
  courseLanguage: string;
  courseLevel: string;
  courseTranslations: CourseTranslation[];
  teacherId: string | null;
  teacherName: string | null;
  name: string;
  capacity: number;
  startsOn: string;
  endsOn: string | null;
  status: GroupStatus;
};

/** Cuerpo de `POST /groups/:id/enrolments`. */
export type EnrolStudentInGroupInput = { studentId: string; agreedPriceCents?: number | null };
export type EnrolStudentInGroupResult = { enrollmentId: string };
