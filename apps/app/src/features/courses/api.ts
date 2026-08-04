import { api } from "../../lib/api-client.js";
import type {
  CourseListItem,
  CreateCourseInput,
  CreateCourseResult,
  CreateGroupInput,
  CreateGroupResult,
  EnrolStudentInGroupInput,
  EnrolStudentInGroupResult,
  GroupDetail,
  SchoolLocales,
} from "./types.js";

/**
 * Cliente HTTP de la Tarea 8 (Cursos y grupos), sobre el cliente compartido
 * (`apps/app/src/lib/api-client.ts`, Tarea 2): mismo manejo de errores
 * tipados, misma cabecera `Accept-Language`, misma redirección en
 * `missing_tenant`.
 */

export function listCourses(): Promise<CourseListItem[]> {
  return api.get<CourseListItem[]>("/courses");
}

export function getSchoolLocales(): Promise<SchoolLocales> {
  return api.get<SchoolLocales>("/courses/locales");
}

export function createCourse(input: CreateCourseInput): Promise<CreateCourseResult> {
  return api.post<CreateCourseResult>("/courses", input);
}

export function createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  return api.post<CreateGroupResult>("/groups", input);
}

export function getGroup(groupId: string): Promise<GroupDetail> {
  return api.get<GroupDetail>(`/groups/${groupId}`);
}

export function enrolStudentInGroup(
  groupId: string,
  input: EnrolStudentInGroupInput,
): Promise<EnrolStudentInGroupResult> {
  return api.post<EnrolStudentInGroupResult>(`/groups/${groupId}/enrolments`, input);
}
