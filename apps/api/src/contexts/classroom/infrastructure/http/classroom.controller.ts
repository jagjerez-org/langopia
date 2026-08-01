import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { JoinClassroomSessionCommand } from "../../application/commands/join-session/join-session.command.js";
import { ListTranscriptsQuery } from "../../application/queries/list-transcripts/list-transcripts.handler.js";

/**
 * Adaptador de ENTRADA sobre HTTP. Sin lógica propia: traduce la petición a
 * un comando, lo pone en el bus y devuelve el resultado — igual que
 * `SchedulingController`, la plantilla de este monorepo.
 *
 * Cualquier membresía activa de la escuela puede pedir el token: alumno,
 * profesor, tutor, administración o dueña. Quién puede entrar a QUÉ clase lo
 * decide `JoinClassroomSessionHandler`, no este adaptador: desde el
 * saneamiento de cierre de la ola 1, a quien entra como alumno o tutor se le
 * exige estar matriculado en el grupo de esa clase. El rol solo dice de qué
 * puerta se trata; la matrícula, si esta clase es suya.
 */
@Roles("owner", "admin", "teacher", "student", "guardian")
@Controller("classroom")
export class ClassroomController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post("sessions/:id/join")
  @HttpCode(200)
  async join(@Param("id", ParseUUIDPipe) id: string) {
    return this.commands.execute(new JoinClassroomSessionCommand({ sessionId: id }));
  }

  @Roles("owner", "admin")
  @Get("transcripts")
  async transcripts() {
    return this.queries.execute(new ListTranscriptsQuery());
  }
}
