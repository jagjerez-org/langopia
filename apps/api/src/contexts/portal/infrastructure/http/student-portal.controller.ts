import { Controller, Get, Query } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { GetMyAttendanceQuery } from "../../application/queries/get-my-attendance/get-my-attendance.handler.js";
import { GetMyInvoicesQuery } from "../../application/queries/get-my-invoices/get-my-invoices.handler.js";
import { GetMySessionsQuery } from "../../application/queries/get-my-sessions/get-my-sessions.handler.js";
import { GetMyStudentsQuery } from "../../application/queries/get-my-students/get-my-students.handler.js";
import { PortalStudentQueryDto } from "./dto/portal.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP: el portal del alumno.
 *
 * `student` y `guardian`, nunca dirección ni profesorado: es el propio
 * interesado viendo lo suyo. Cada consulta se filtra por la membresía de la
 * sesión (`resolvePortalStudentId`), no por nada que llegue en la ruta; el
 * único parámetro que acepta el cliente es opcional y solo existe para que
 * un tutor con varios hijos elija cuál — pedir el de alguien que no es tuyo
 * ni tutelas, aunque sea de tu misma escuela, no filtra en silencio: 403.
 *
 * El progreso del alumno (tarea 16 de la ola 2) NO se sirve aquí: aunque es
 * el mismo dato que ve el propio alumno o su tutor, `GetStudentProgressQuery`
 * es de `assessment`, y `architecture.spec.ts` («un contexto solo importa
 * los eventos de otro») impide que este controlador la despache — los
 * adaptadores de entrada viven DENTRO de su contexto en este código base, no
 * en un directorio aparte que cruce fronteras libremente. El panel llama
 * directamente a `GET /assessments/students/:studentId/progress`
 * (`StudentProgressController`), abierto también a `student`/`guardian`, con
 * el `studentId` que esta misma pantalla ya resuelve con `GET
 * /portal/me/students` (Paso 2, más abajo) — sin volver a preguntar de quién
 * es: `TeacherCannotViewStudentProgressError`/`StudentOwnershipPort` en
 * `assessment` deciden si esa membresía puede verlo.
 */
@Roles("student", "guardian")
@Controller("portal/me")
export class StudentPortalController {
  constructor(private readonly queries: QueryBus) {}

  /**
   * Paso 2 de esta tarea: la lista completa de alumnos que esta membresía
   * puede elegir — ella misma, o TODOS sus tutelados, no solo el primero.
   * Arma el selector de "cambiar de hijo" del portal; sin parámetro porque
   * es la propia pregunta de qué opciones hay, previa a pedir "mis clases"
   * de una en concreto con `studentId`.
   */
  @Get("students")
  async students() {
    return this.queries.execute(new GetMyStudentsQuery());
  }

  @Get("sessions")
  async sessions(@Query() query: PortalStudentQueryDto) {
    return this.queries.execute(new GetMySessionsQuery({ studentId: query.studentId }));
  }

  @Get("invoices")
  async invoices(@Query() query: PortalStudentQueryDto) {
    return this.queries.execute(new GetMyInvoicesQuery({ studentId: query.studentId }));
  }

  @Get("attendance")
  async attendance(@Query() query: PortalStudentQueryDto) {
    return this.queries.execute(new GetMyAttendanceQuery({ studentId: query.studentId }));
  }
}
