import { Controller, Get, Param } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { GetExercisesToDoQuery } from "../../application/queries/get-exercises-to-do/get-exercises-to-do.handler.js";
import { GetStudentProgressQuery } from "../../application/queries/get-student-progress/get-student-progress.handler.js";

/**
 * Adaptador de ENTRADA sobre HTTP: progreso del alumno (tarea 16 de la ola
 * 2). Un único endpoint para las dos pantallas que lo enseñan —la ficha del
 * alumno (dirección y profesorado) y el portal (el propio alumno y su tutor
 * legal)—: `architecture.spec.ts` («un contexto solo importa los eventos de
 * otro») impide que el controlador de `portal` despache la consulta de
 * `assessment`, así que el panel llama aquí directamente para las dos
 * pantallas, con el `studentId` que cada una ya conoce (el de la ficha, o el
 * que resuelve `GET /portal/me/students`).
 *
 * Sin lógica de negocio en el controlador: quién de estos cinco roles puede
 * de verdad ver a ESTE alumno lo decide `GetStudentProgressHandler`
 * (dirección ve cualquiera; un profesor, solo el suyo; el alumno o su tutor,
 * solo lo propio o lo tutelado) — nunca lo que llegue en la ruta.
 */
@Roles("owner", "admin", "teacher", "student", "guardian")
@Controller("assessments/students")
export class StudentProgressController {
  constructor(private readonly queries: QueryBus) {}

  @Get(":studentId/progress")
  async progress(@Param("studentId") studentId: string) {
    return this.queries.execute(new GetStudentProgressQuery({ studentId }));
  }

  /**
   * «Hacer ejercicios» (tarea 12 de la ola 2): los ejercicios publicados a
   * los grupos activos de este alumno, con su último intento si lo hay.
   * Mismo criterio de acceso que `progress` (arriba), reutilizado tal cual
   * por `GetExercisesToDoHandler` — ver su comentario.
   */
  @Get(":studentId/exercises")
  async exercises(@Param("studentId") studentId: string) {
    return this.queries.execute(new GetExercisesToDoQuery({ studentId }));
  }
}
