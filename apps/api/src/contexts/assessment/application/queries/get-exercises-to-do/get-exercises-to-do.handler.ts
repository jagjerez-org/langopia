import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  StudentProgressAccessDeniedError,
  TeacherCannotViewStudentProgressError,
} from "../../../domain/errors/assessment.errors.js";
import { StudentId } from "../../../domain/model/identifiers.js";
import {
  STUDENT_MINOR_PORT,
  type StudentMinorPort,
} from "../../../domain/ports/student-minor.port.js";
import {
  TEACHES_STUDENT_PORT,
  type TeachesStudentPort,
} from "../../../domain/ports/teaches-student.port.js";
import {
  STUDENT_PROGRESS_READ_MODEL,
  type ExerciseToDo,
  type StudentProgressReadModel,
} from "../../ports/student-progress-read-model.port.js";

export class GetExercisesToDoQuery extends Query<ExerciseToDo[]> {
  constructor(readonly props: { studentId: string }) {
    super();
  }
}

/**
 * «Hacer ejercicios» (tarea 12 de la ola 2): los ejercicios publicados a los
 * grupos activos del alumno, con su último intento si lo hay — lo que
 * alimenta la pantalla del portal donde el alumno resuelve ejercicios.
 *
 * Mismo criterio de acceso, verbatim, que `GetStudentProgressHandler`
 * (tarea 16): dirección ve cualquiera; un profesor, solo el suyo
 * (`TeachesStudentPort`); el alumno o su tutor legal, solo lo propio o lo
 * tutelado (`StudentMinorPort.isSelfOrGuardian`). Reutiliza los MISMOS dos
 * errores de esa tarea (`TeacherCannotViewStudentProgressError`/
 * `StudentProgressAccessDeniedError`) en vez de acuñar dos nuevos con el
 * mismo significado exacto («¿puede esta membresía ver los datos académicos
 * de este alumno?») — decisión anotada en el informe de esta tarea.
 *
 * `StudentMinorPort.exists` primero, antes que cualquier rol: un alumno de
 * OTRA escuela da 404, no una lista vacía con 200 (mismo motivo que la
 * tarea 16 documentó).
 */
@QueryHandler(GetExercisesToDoQuery)
export class GetExercisesToDoHandler implements IQueryHandler<GetExercisesToDoQuery> {
  constructor(
    @Inject(STUDENT_PROGRESS_READ_MODEL) private readonly readModel: StudentProgressReadModel,
    @Inject(TEACHES_STUDENT_PORT) private readonly teaches: TeachesStudentPort,
    @Inject(STUDENT_MINOR_PORT) private readonly minors: StudentMinorPort,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(query: GetExercisesToDoQuery): Promise<ExerciseToDo[]> {
    const { studentId } = query.props;
    const roles = this.tenant.roles();
    const membershipId = this.tenant.membershipId();

    return this.uow.read(async () => {
      const id = StudentId.of(studentId);
      if (!(await this.minors.exists(id))) throw new NotFoundError("el alumno", studentId);

      await this.assertCanView({ roles, membershipId, studentId, id });
      return this.readModel.exercisesForStudent(studentId);
    });
  }

  private async assertCanView(params: {
    roles: readonly string[];
    membershipId: string | null;
    studentId: string;
    id: StudentId;
  }): Promise<void> {
    const { roles, membershipId, studentId, id } = params;
    if (roles.includes("owner") || roles.includes("admin")) return;

    if (roles.includes("teacher") && membershipId) {
      const allowed = await this.teaches.teachesStudent({ membershipId, studentId: id });
      if (allowed) return;
    }

    if ((roles.includes("student") || roles.includes("guardian")) && membershipId) {
      const allowed = await this.minors.isSelfOrGuardian({ membershipId, studentId: id });
      if (allowed) return;
    }

    if (roles.includes("teacher")) throw new TeacherCannotViewStudentProgressError(studentId);
    throw new StudentProgressAccessDeniedError(studentId);
  }
}
