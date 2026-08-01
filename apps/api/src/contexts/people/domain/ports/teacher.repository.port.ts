import type { TeacherId } from "../model/identifiers.js";
import type { Teacher } from "../model/teacher.aggregate.js";

export interface TeacherRepository {
  find(id: TeacherId): Promise<Teacher | null>;
  findOrFail(id: TeacherId): Promise<Teacher>;
  save(teacher: Teacher): Promise<void>;
}

export const TEACHER_REPOSITORY = Symbol("TeacherRepository");
