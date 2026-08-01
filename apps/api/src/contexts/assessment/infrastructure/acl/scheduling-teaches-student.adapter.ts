import { Injectable } from "@nestjs/common";
import type { StudentId, TeacherId } from "../../domain/model/identifiers.js";
import type { TeachesStudentPort } from "../../domain/ports/teaches-student.port.js";
import { DrizzleTeachesStudentRepository } from "../persistence/drizzle-teaches-student.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Programación de clases.
 *
 * Assessment necesita un único dato de `scheduling` —si un profesor dio
 * clase a un alumno en un periodo— y no debe saber nada más: ni de
 * `ClassSession`, ni de `AttendanceSheet`. El acceso a datos vive en
 * `DrizzleTeachesStudentRepository` (`infrastructure/persistence/`): este
 * adaptador delega, no escribe SQL.
 */
@Injectable()
export class SchedulingTeachesStudentAdapter implements TeachesStudentPort {
  constructor(private readonly repository: DrizzleTeachesStudentRepository) {}

  taught(params: {
    teacherId: TeacherId;
    studentId: StudentId;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<boolean> {
    return this.repository.taught(params);
  }

  teachesStudent(params: { membershipId: string; studentId: StudentId }): Promise<boolean> {
    return this.repository.teachesStudent(params);
  }
}
