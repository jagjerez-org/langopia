import { describe, expect, it } from "vitest";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { MissingDefaultTranslationError } from "../errors/catalog.errors.js";
import { CourseModality } from "./course-modality.js";
import { Course } from "./course.aggregate.js";
import { CourseId } from "./identifiers.js";

const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");

function baseParams() {
  return {
    id: CourseId.of("22222222-2222-4222-8222-222222222222"),
    schoolId: SCHOOL,
    code: "ES-B1-GRP",
    language: "es",
    level: CefrLevel.B1,
    modality: CourseModality.Group,
    totalSessions: 50,
    sessionMinutes: 60,
    maxStudents: 5,
    priceCents: 69_000,
    currency: "EUR",
    schoolDefaultLocale: "es-ES",
    translations: [{ locale: "es-ES", name: "Español B1", description: null }],
  };
}

describe("Course.create()", () => {
  it("exige el nombre al menos en el idioma por defecto de la escuela", () => {
    const params = baseParams();
    params.translations = [{ locale: "en-GB", name: "Spanish B1", description: null }];
    expect(() => Course.create(params)).toThrow(MissingDefaultTranslationError);
  });

  it("un curso privado tiene capacidad 1, aunque se pida otra", () => {
    const course = Course.create({
      ...baseParams(),
      modality: CourseModality.Private,
      maxStudents: 5,
    });
    expect(course.maxStudents).toBe(1);
  });

  it("da de alta un curso con su nombre en el idioma por defecto", () => {
    const course = Course.create(baseParams());
    expect(course.translations).toEqual([{ locale: "es-ES", name: "Español B1", description: null }]);
  });
});
