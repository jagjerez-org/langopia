import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
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
  type StudentProgress,
  type StudentProgressReadModel,
} from "../../ports/student-progress-read-model.port.js";

export class GetStudentProgressQuery extends Query<StudentProgress> {
  constructor(readonly props: { studentId: string }) {
    super();
  }
}

/**
 * Progreso del alumno (tarea 16 de la ola 2): porcentaje completado, nota
 * media (solo lo firmado), desglose por destreza, tendencia y racha de
 * repaso.
 *
 * Un único punto de entrada (`StudentProgressController`,
 * `assessments/students/:studentId/progress`) sirve a la vez la ficha del
 * alumno (dirección y profesorado) y al portal (el propio alumno y su tutor
 * legal, que llegan al MISMO endpoint desde `apps/web`): `architecture.
 * spec.ts` («un contexto solo importa los eventos de otro») impide que el
 * controlador de `portal` despache esta consulta directamente, así que quién
 * puede ver A ESTE alumno concreto se decide aquí, con los mismos hechos que
 * ya usan otras piezas de esta ola — nunca recalculando la regla de negocio
 * de otro contexto, solo preguntándosela con SQL propio, igual que
 * `EvaluateStudentHandler` ya hace con estos mismos dos puertos:
 *
 *   · Dirección (`owner`/`admin`): ve cualquiera.
 *   · Profesorado: solo el de quien de verdad enseña (`TeachesStudentPort`).
 *   · Alumno o tutor: solo el propio o el tutelado (`StudentMinorPort.
 *     isSelfOrGuardian`, el mismo criterio que ya aplica
 *     `PortalReadModel.studentAccess` en `portal`, vuelto a preguntar aquí
 *     porque un contexto no importa el modelo de lectura de otro).
 *
 * Antes de cualquiera de esos tres: `StudentMinorPort.exists` comprueba que
 * la ficha existe EN LA ESCUELA ACTIVA. Sin este paso, dirección pidiendo el
 * `studentId` de otra escuela no veía un 404 — RLS oculta la fila igual, así
 * que ningún dato real cruza, pero la respuesta era un progreso vacío con
 * 200 en vez de «esa ficha no existe aquí», el mismo criterio que
 * `resolvePortalStudentId` ya aplica en `portal`.
 */
@QueryHandler(GetStudentProgressQuery)
export class GetStudentProgressHandler implements IQueryHandler<GetStudentProgressQuery> {
  constructor(
    @Inject(STUDENT_PROGRESS_READ_MODEL) private readonly readModel: StudentProgressReadModel,
    @Inject(TEACHES_STUDENT_PORT) private readonly teaches: TeachesStudentPort,
    @Inject(STUDENT_MINOR_PORT) private readonly minors: StudentMinorPort,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: GetStudentProgressQuery): Promise<StudentProgress> {
    const { studentId } = query.props;
    const roles = this.tenant.roles();
    const membershipId = this.tenant.membershipId();
    const now = this.clock.now();

    return this.uow.read(async () => {
      const id = StudentId.of(studentId);
      if (!(await this.minors.exists(id))) throw new NotFoundError("el alumno", studentId);

      await this.assertCanView({ roles, membershipId, studentId, id });
      return this.readModel.getProgress({ studentId, now });
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
