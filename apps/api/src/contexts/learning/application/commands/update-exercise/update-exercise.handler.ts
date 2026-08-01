import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { ContentStatus } from "../../../domain/model/content-unit.aggregate.js";
import { validateExercise } from "../../../domain/model/exercise-schemas.js";
import { ContentUnitId, ExerciseId } from "../../../domain/model/identifiers.js";
import { ContentUnitArchivedError } from "../../../domain/errors/learning.errors.js";
import {
  CONTENT_UNIT_REPOSITORY,
  type ContentUnitRepository,
} from "../../../domain/ports/content-unit.repository.port.js";
import {
  EXERCISE_REPOSITORY,
  type ExerciseRepositoryPort,
} from "../../../domain/ports/exercise.repository.port.js";
import { UpdateExerciseCommand } from "./update-exercise.command.js";

/**
 * Manejador del comando.
 *
 * «La IA propone, el profesor firma» no es solo el paso de publicar: un
 * ejercicio editado a mano sigue teniendo que respetar la forma que su tipo
 * exige, así que revalida con la MISMA `validateExercise()` que usa
 * `Exercise.create()` (tarea 2) — un ejercicio que no valida no llega nunca
 * al alumno, tampoco tras una edición manual.
 *
 * Sin agregado propio para esto: no hay ninguna regla de negocio que
 * decidir más allá de "sigue siendo válido para su tipo" y "la unidad no
 * está archivada" — mismo criterio que `PATCH /schools/me` (Tarea 12 del
 * panel web), que tampoco pasa por un agregado.
 */
@CommandHandler(UpdateExerciseCommand)
export class UpdateExerciseHandler implements ICommandHandler<UpdateExerciseCommand> {
  constructor(
    @Inject(CONTENT_UNIT_REPOSITORY) private readonly contentUnits: ContentUnitRepository,
    @Inject(EXERCISE_REPOSITORY) private readonly exercises: ExerciseRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(command: UpdateExerciseCommand): Promise<{ exerciseId: string }> {
    const { props } = command;
    const unitId = ContentUnitId.of(props.contentUnitId);
    const exerciseId = ExerciseId.of(props.exerciseId);

    await this.uow.execute(async () => {
      const unit = await this.contentUnits.findById(unitId);
      if (!unit) throw new NotFoundError("la unidad didáctica", props.contentUnitId);
      if (unit.status === ContentStatus.Archived) {
        throw new ContentUnitArchivedError(unit.id.value, "editar un ejercicio de");
      }

      const exercise = await this.exercises.findById(exerciseId);
      if (!exercise || exercise.contentUnitId !== unitId.value) {
        throw new NotFoundError("el ejercicio", props.exerciseId);
      }

      validateExercise(exercise.type, props.prompt, props.solution);

      await this.exercises.updateContent(exerciseId, {
        prompt: props.prompt,
        solution: props.solution,
      });
    });

    return { exerciseId: exerciseId.value };
  }
}
