import { Body, Controller, Get, HttpCode, Param, Patch, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { GenerateUnitCommand } from "../../application/commands/generate-unit/generate-unit.command.js";
import { PublishUnitCommand } from "../../application/commands/publish-unit/publish-unit.command.js";
import { UpdateExerciseCommand } from "../../application/commands/update-exercise/update-exercise.command.js";
import { GetGenerationEstimateQuery } from "../../application/queries/get-generation-estimate/get-generation-estimate.handler.js";
import { GetPublishTargetsQuery } from "../../application/queries/get-publish-targets/get-publish-targets.handler.js";
import { GetUnitDetailQuery } from "../../application/queries/get-unit-detail/get-unit-detail.handler.js";
import { ListUnitsQuery } from "../../application/queries/list-units/list-units.handler.js";
import {
  GenerateUnitDto,
  ListUnitsQueryDto,
  PublishUnitDto,
  UpdateExerciseDto,
} from "./dto/units.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Sin lógica: traduce la petición a un comando y lo pone en el bus. Solo
 * `owner`, `admin` y `teacher` generan y publican contenido — es trabajo de
 * dirección/profesorado, nunca del alumnado ni de tutores.
 */
@Roles("owner", "admin", "teacher")
@Controller("learning")
export class UnitsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post("units/generate")
  async generate(@Body() dto: GenerateUnitDto) {
    return this.commands.execute(
      new GenerateUnitCommand({
        code: dto.code,
        language: dto.language,
        level: dto.level,
        topic: dto.topic,
        skills: dto.skills,
        primaryLocale: dto.primaryLocale,
        exerciseTypes: dto.exerciseTypes,
        sourceMaterial: dto.sourceMaterial,
      }),
    );
  }

  /** Listado de unidades (Tarea 11 del panel, Paso 3), opcionalmente filtrado por estado. */
  @Get("units")
  async list(@Query() query: ListUnitsQueryDto) {
    return this.queries.execute(new ListUnitsQuery({ status: query.status }));
  }

  /**
   * Coste estimado y saldo ANTES de generar (Tarea 11 del panel, Pasos 1 y
   * 5). Ruta estática antes que `units/:id`, igual que
   * `BillingController` con `invoices/summary`: si no, `:id` se comería
   * `generation-estimate` como si fuera un UUID.
   */
  @Get("units/generation-estimate")
  async generationEstimate() {
    return this.queries.execute(new GetGenerationEstimateQuery());
  }

  /** Ficha de una unidad con sus ejercicios (Tarea 11 del panel, Paso 3). */
  @Get("units/:id")
  async detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.queries.execute(new GetUnitDetailQuery({ contentUnitId: id }));
  }

  /** Grupos a los que se puede publicar la unidad, con la elegibilidad ya decidida (Paso 4). */
  @Get("units/:id/publish-targets")
  async publishTargets(@Param("id", ParseUUIDPipe) id: string) {
    return this.queries.execute(new GetPublishTargetsQuery({ contentUnitId: id }));
  }

  @Post("units/:id/publish")
  @HttpCode(200)
  async publish(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PublishUnitDto) {
    return this.commands.execute(
      new PublishUnitCommand({ contentUnitId: id, groupIds: dto.groupIds }),
    );
  }

  /** Edita el enunciado (y, si el tipo lo lleva, la clave) de un ejercicio (Tarea 11 del panel, Paso 3). */
  @Patch("units/:unitId/exercises/:exerciseId")
  @HttpCode(200)
  async updateExercise(
    @Param("unitId", ParseUUIDPipe) unitId: string,
    @Param("exerciseId", ParseUUIDPipe) exerciseId: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.commands.execute(
      new UpdateExerciseCommand({
        contentUnitId: unitId,
        exerciseId,
        prompt: dto.prompt,
        solution: dto.solution,
      }),
    );
  }
}
