import type { Course } from "../model/course.aggregate.js";
import type { CourseId } from "../model/identifiers.js";

export interface CourseRepository {
  find(id: CourseId): Promise<Course | null>;

  /** Como `find`, pero lanza `NotFoundError` si no existe. */
  findOrFail(id: CourseId): Promise<Course>;

  save(course: Course): Promise<void>;
}

export const COURSE_REPOSITORY = Symbol("CourseRepository");
