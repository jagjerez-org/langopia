import { Body, Controller, Param, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { AnswerPlacementTestCommand } from "../../application/commands/answer-placement-test/answer-placement-test.command.js";
import { StartPlacementTestCommand } from "../../application/commands/start-placement-test/start-placement-test.command.js";
import type { PlacementTestSnapshot } from "../../domain/model/placement-test.aggregate.js";
import { AnswerPlacementTestDto, StartPlacementTestDto } from "./dto/assessment.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP (Tarea 8 de la ola 2).
 *
 * Sin lógica de negocio: traduce la petición a un comando y lo pone en el
 * bus. `owner`/`admin`/`teacher`, igual que `AttemptsController`:
 * administrar la prueba aquí es el equipo digitalizándola con el alumno
 * delante (en persona, o por teléfono con un candidato), no el autoservicio
 * del alumno — el portal (ola futura) resolverá `studentProfileId` de su
 * propia sesión.
 *
 * Ruta `assessment/placement`, en singular, tal como la fija el encargo de
 * la tarea (el resto del contexto usa `assessments`, en plural).
 */
@Roles("owner", "admin", "teacher")
@Controller("assessment/placement")
export class PlacementTestController {
  constructor(private readonly commands: CommandBus) {}

  @Post("start")
  async start(@Body() dto: StartPlacementTestDto) {
    return this.commands.execute(
      new StartPlacementTestCommand({
        studentProfileId: dto.studentProfileId,
        language: dto.language,
      }),
    );
  }

  @Post(":id/answer")
  async answer(@Param("id") id: string, @Body() dto: AnswerPlacementTestDto) {
    return this.commands.execute(
      new AnswerPlacementTestCommand({
        testId: id,
        // El snapshot es opaco para el DTO (ver `assessment.dto.ts`):
        // `PlacementTest.rehydrate()` es quien de verdad interpreta su forma.
        snapshot: dto.snapshot as unknown as PlacementTestSnapshot,
        itemId: dto.itemId,
        response: dto.response,
      }),
    );
  }
}
