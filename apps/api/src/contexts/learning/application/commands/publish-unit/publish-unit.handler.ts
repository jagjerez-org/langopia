import { Inject, Optional } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import {
  MissingReviewerError,
  UnitGroupsMultipleCoursesError,
} from "../../../domain/errors/learning.errors.js";
import type { ContentUnit } from "../../../domain/model/content-unit.aggregate.js";
import type { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { ContentUnitId, CourseId } from "../../../domain/model/identifiers.js";
import {
  CONTENT_UNIT_REPOSITORY,
  type ContentUnitRepository,
} from "../../../domain/ports/content-unit.repository.port.js";
import {
  GROUP_COURSE_PORT,
  type GroupCoursePort,
} from "../../../domain/ports/group-course.port.js";
import {
  VIDEO_GENERATOR_PORT,
  type VideoGeneratorPort,
} from "../../../domain/ports/video-generator.port.js";
import { PublishUnitCommand } from "./publish-unit.command.js";

/**
 * Manejador del comando.
 *
 * Carga la unidad (con la identidad de sus ejercicios ya reconstruida —
 * `ContentUnitRepository.findById()`, tarea 6), le pide que se publique
 * (`ContentUnit.publish()`, tarea 1: rechaza sin ejercicios, dos veces, o
 * archivada) y guarda. El revisor es quien llama, nunca un parámetro del
 * cuerpo de la petición: la firma es de la sesión autenticada, no de un dato
 * que cualquiera podría rellenar con el id de otra persona.
 *
 * Si vienen `groupIds` (tarea 11 del panel, Paso 4), la unidad se asocia
 * ANTES de publicarla al curso de esos grupos: todos tienen que ser del mismo
 * curso, y `ContentUnit.assignToCourse()` comprueba además que el nivel del
 * curso es el de la unidad. Un grupo que no existe en esta escuela no
 * aparece en la respuesta de `GroupCoursePort` (RLS) y se trata como lo que
 * es: un grupo que no está. Todo dentro de la misma transacción que la
 * publicación — o se asocia y se publica, o no pasa nada.
 */
@CommandHandler(PublishUnitCommand)
export class PublishUnitHandler implements ICommandHandler<PublishUnitCommand> {
  constructor(
    @Inject(CONTENT_UNIT_REPOSITORY) private readonly contentUnits: ContentUnitRepository,
    @Inject(GROUP_COURSE_PORT) private readonly groupCourses: GroupCoursePort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Optional() @Inject(VIDEO_GENERATOR_PORT) private readonly video?: VideoGeneratorPort,
    @Optional() @InjectPinoLogger(PublishUnitHandler.name) private readonly logger?: Pick<PinoLogger, "warn">,
  ) {}

  async execute(command: PublishUnitCommand): Promise<{
    contentUnitId: string;
    status: string;
    courseId: string | null;
    groupIds: string[];
  }> {
    const actor = this.tenant.membershipId();
    if (!actor) throw new MissingReviewerError();
    const reviewedBy = MembershipId.of(actor);
    const now = this.clock.now();
    const id = ContentUnitId.of(command.props.contentUnitId);
    const requestedGroupIds = command.props.groupIds ?? [];

    const { unit, groupIds } = await this.uow.execute(async () => {
      const found = await this.contentUnits.findById(id);
      if (!found) throw new NotFoundError("la unidad didáctica", id.value);

      const targets = await this.resolveCourse(requestedGroupIds);
      if (targets) found.assignToCourse(targets.course);

      found.publish({ reviewedBy, now });
      await this.contentUnits.save(found);
      return { unit: found, groupIds: targets?.groupIds ?? [] };
    });

    await this.events.publish(unit.pullDomainEvents());
    await this.tryGenerateBetaVideo(unit);

    return {
      contentUnitId: unit.id.value,
      status: unit.status,
      courseId: unit.courseId?.value ?? null,
      groupIds,
    };
  }

  private async tryGenerateBetaVideo(unit: ContentUnit): Promise<void> {
    if (!this.video) return;

    try {
      await this.video.generateBetaVideoForPublishedUnit({
        contentUnitId: unit.id.value,
        code: unit.code,
        language: unit.language,
        level: unit.level,
        topic: unit.topic,
        primaryLocale: unit.primaryLocale,
      });
    } catch (err) {
      this.logger?.warn(
        { err, contentUnitId: unit.id.value },
        "La generación de vídeo beta falló, pero la unidad ya está publicada.",
      );
    }
  }

  /**
   * El curso común de los grupos pedidos, o `null` si no se pidió ninguno.
   *
   * Un grupo que no existe (o que RLS oculta porque es de otra escuela) no
   * vuelve de `GroupCoursePort`: `NotFoundError` con el id, en vez de
   * publicar a los que sí existían y callarse los demás.
   */
  private async resolveCourse(
    groupIds: readonly string[],
  ): Promise<{ course: { id: CourseId; level: CefrLevel }; groupIds: string[] } | null> {
    if (groupIds.length === 0) return null;

    const found = await this.groupCourses.coursesOfGroups(groupIds);
    const encontrados = new Set(found.map((group) => group.groupId));
    const faltante = groupIds.find((groupId) => !encontrados.has(groupId));
    if (faltante) throw new NotFoundError("el grupo", faltante);

    const courses = new Map(found.map((group) => [group.courseId, group.level]));
    if (courses.size > 1) throw new UnitGroupsMultipleCoursesError(courses.size);

    const [courseId, level] = [...courses.entries()][0]!;
    return {
      course: { id: CourseId.of(courseId), level: level as CefrLevel },
      groupIds: found.map((group) => group.groupId),
    };
  }
}
