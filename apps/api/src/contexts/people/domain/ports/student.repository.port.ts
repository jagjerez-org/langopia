import type { Student } from "../model/student.aggregate.js";
import type { StudentId } from "../model/identifiers.js";

export interface StudentRepository {
  find(id: StudentId): Promise<Student | null>;
  findOrFail(id: StudentId): Promise<Student>;
  save(student: Student): Promise<void>;
  /** Alumnos activos de la escuela. Para comprobar el límite del plan. */
  countActive(): Promise<number>;
}

export const STUDENT_REPOSITORY = Symbol("StudentRepository");
