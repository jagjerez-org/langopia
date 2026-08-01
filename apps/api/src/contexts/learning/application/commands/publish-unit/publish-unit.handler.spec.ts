import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { describe, expect, it, vi } from "vitest";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { ContentUnit } from "../../../domain/model/content-unit.aggregate.js";
import { ContentUnitId, ExerciseId } from "../../../domain/model/identifiers.js";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { UnitGroupsMultipleCoursesError } from "../../../domain/errors/learning.errors.js";
import type { ContentUnitRepository } from "../../../domain/ports/content-unit.repository.port.js";
import type { GroupCourse, GroupCoursePort } from "../../../domain/ports/group-course.port.js";
import { PublishUnitCommand } from "./publish-unit.command.js";
import { PublishUnitHandler } from "./publish-unit.handler.js";

const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const AUTOR = MembershipId.of("22222222-2222-4222-8222-222222222222");
const REVISOR = "33333333-3333-4333-8333-333333333333";
const UNIT_ID = ContentUnitId.of("44444444-4444-4444-8444-444444444444");
const NOW = new Date("2026-07-27T10:00:00Z");

function unidadEnRevision(withExercise = true): ContentUnit {
  const unit = ContentUnit.draft({
    id: UNIT_ID,
    schoolId: ESCUELA,
    code: "ES-B1-U07",
    language: "es",
    level: "B1",
    topic: "En la consulta del médico",
    skills: ["listening"],
    source: "ai_generated",
    primaryLocale: "es-ES",
    createdBy: AUTOR,
    now: NOW,
  });
  if (withExercise) unit.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
  return unit;
}

function fakeRepository(initial: ContentUnit | null) {
  const state = { unit: initial };
  const repository: ContentUnitRepository = {
    save: async (unit) => {
      state.unit = unit;
    },
    saveTranslation: async () => undefined,
    addExercises: async () => undefined,
    findById: async (id) => (state.unit && state.unit.id.value === id.value ? state.unit : null),
    findRubricIdByCode: async () => null,
    // Tarea 9 (repetición espaciada), ajena a este manejador: no se ejercita aquí.
    findExerciseSrsInfo: async () => null,
  };
  return { repository, state };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}
function fakeTenant(membershipId: string | null = REVISOR): TenantContext {
  return { schoolId: () => ESCUELA.value, membershipId: () => membershipId, roles: () => ["teacher"], has: () => true };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}
function fakeLogger() {
  return { warn: vi.fn() };
}
function fakeVideoGenerator(overrides?: { fail?: boolean }) {
  return {
    generateBetaVideoForPublishedUnit: vi.fn(async () => {
      if (overrides?.fail) throw new Error("El proveedor de vídeo no está disponible.");
    }),
  };
}
/** Sin grupos pedidos no se llama nunca: por eso el doble por defecto no devuelve ninguno. */
function fakeGroupCourses(groups: GroupCourse[] = []): GroupCoursePort {
  return {
    coursesOfGroups: async (ids) => groups.filter((group) => ids.includes(group.groupId)),
  };
}

const GRUPO_A = "66666666-6666-4666-8666-666666666666";
const GRUPO_B = "77777777-7777-4777-8777-777777777777";
const CURSO_B1 = "88888888-8888-4888-8888-888888888888";
const CURSO_A2 = "99999999-9999-4999-8999-999999999999";

describe("PublishUnitHandler", () => {
  it("publica una unidad en revisión con ejercicios, firmada por quien la publica", async () => {
    const { repository, state } = fakeRepository(unidadEnRevision());
    const handler = new PublishUnitHandler(repository, fakeGroupCourses(), fakeUow(), fakeEvents(), fakeTenant(), fakeClock());

    const result = await handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value }));

    expect(result.status).toBe("published");
    expect(state.unit!.reviewedBy!.value).toBe(REVISOR);
  });

  it("un fallo del vídeo beta no impide publicar la unidad", async () => {
    const { repository, state } = fakeRepository(unidadEnRevision());
    const video = fakeVideoGenerator({ fail: true });
    const logger = fakeLogger();
    const handler = new PublishUnitHandler(
      repository,
      fakeGroupCourses(),
      fakeUow(),
      fakeEvents(),
      fakeTenant(),
      fakeClock(),
      video,
      logger,
    );

    const result = await handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value }));

    expect(result.status).toBe("published");
    expect(state.unit!.status).toBe("published");
    expect(video.generateBetaVideoForPublishedUnit).toHaveBeenCalledWith({
      contentUnitId: UNIT_ID.value,
      code: "ES-B1-U07",
      language: "es",
      level: "B1",
      topic: "En la consulta del médico",
      primaryLocale: "es-ES",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error), contentUnitId: UNIT_ID.value },
      "La generación de vídeo beta falló, pero la unidad ya está publicada.",
    );
  });

  it("no publica una unidad sin ejercicios", async () => {
    const { repository } = fakeRepository(unidadEnRevision(false));
    const handler = new PublishUnitHandler(repository, fakeGroupCourses(), fakeUow(), fakeEvents(), fakeTenant(), fakeClock());

    await expect(
      handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value })),
    ).rejects.toThrow(/sin ejercicios/i);
  });

  it("una unidad que no existe se rechaza", async () => {
    const { repository } = fakeRepository(null);
    const handler = new PublishUnitHandler(repository, fakeGroupCourses(), fakeUow(), fakeEvents(), fakeTenant(), fakeClock());

    await expect(
      handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value })),
    ).rejects.toThrow();
  });

  it("sin membresía efectiva no hay quien firme", async () => {
    const { repository } = fakeRepository(unidadEnRevision());
    const handler = new PublishUnitHandler(repository, fakeGroupCourses(), fakeUow(), fakeEvents(), fakeTenant(null), fakeClock());

    await expect(
      handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value })),
    ).rejects.toThrow(/revisa y firma/i);
  });

  describe("publicar a grupos (tarea 11 del panel, Paso 4)", () => {
    it("asocia la unidad al curso de los grupos elegidos y los devuelve", async () => {
      const { repository, state } = fakeRepository(unidadEnRevision());
      const handler = new PublishUnitHandler(
        repository,
        fakeGroupCourses([
          { groupId: GRUPO_A, courseId: CURSO_B1, level: "B1" },
          { groupId: GRUPO_B, courseId: CURSO_B1, level: "B1" },
        ]),
        fakeUow(),
        fakeEvents(),
        fakeTenant(),
        fakeClock(),
      );

      const result = await handler.execute(
        new PublishUnitCommand({ contentUnitId: UNIT_ID.value, groupIds: [GRUPO_A, GRUPO_B] }),
      );

      expect(result.status).toBe("published");
      expect(result.courseId).toBe(CURSO_B1);
      expect(result.groupIds).toEqual([GRUPO_A, GRUPO_B]);
      expect(state.unit!.courseId!.value).toBe(CURSO_B1);
    });

    it("sin grupos, publica igual y no asocia ningún curso", async () => {
      const { repository, state } = fakeRepository(unidadEnRevision());
      const handler = new PublishUnitHandler(
        repository,
        fakeGroupCourses(),
        fakeUow(),
        fakeEvents(),
        fakeTenant(),
        fakeClock(),
      );

      const result = await handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value }));

      expect(result.courseId).toBeNull();
      expect(result.groupIds).toEqual([]);
      expect(state.unit!.courseId).toBeNull();
    });

    it("grupos de dos cursos distintos se rechazan enteros, sin publicar a medias", async () => {
      const { repository, state } = fakeRepository(unidadEnRevision());
      const handler = new PublishUnitHandler(
        repository,
        fakeGroupCourses([
          { groupId: GRUPO_A, courseId: CURSO_B1, level: "B1" },
          { groupId: GRUPO_B, courseId: CURSO_A2, level: "A2" },
        ]),
        fakeUow(),
        fakeEvents(),
        fakeTenant(),
        fakeClock(),
      );

      await expect(
        handler.execute(
          new PublishUnitCommand({ contentUnitId: UNIT_ID.value, groupIds: [GRUPO_A, GRUPO_B] }),
        ),
      ).rejects.toBeInstanceOf(UnitGroupsMultipleCoursesError);
      expect(state.unit!.status).toBe("in_review");
    });

    it("un curso de otro nivel no acepta la unidad", async () => {
      const { repository, state } = fakeRepository(unidadEnRevision());
      const handler = new PublishUnitHandler(
        repository,
        fakeGroupCourses([{ groupId: GRUPO_A, courseId: CURSO_A2, level: "A2" }]),
        fakeUow(),
        fakeEvents(),
        fakeTenant(),
        fakeClock(),
      );

      await expect(
        handler.execute(new PublishUnitCommand({ contentUnitId: UNIT_ID.value, groupIds: [GRUPO_A] })),
      ).rejects.toThrow(/nivel/i);
      expect(state.unit!.status).toBe("in_review");
    });

    it("un grupo que no existe (o que RLS oculta) no se publica en silencio", async () => {
      const { repository } = fakeRepository(unidadEnRevision());
      const handler = new PublishUnitHandler(
        repository,
        fakeGroupCourses([{ groupId: GRUPO_A, courseId: CURSO_B1, level: "B1" }]),
        fakeUow(),
        fakeEvents(),
        fakeTenant(),
        fakeClock(),
      );

      await expect(
        handler.execute(
          new PublishUnitCommand({ contentUnitId: UNIT_ID.value, groupIds: [GRUPO_A, GRUPO_B] }),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
