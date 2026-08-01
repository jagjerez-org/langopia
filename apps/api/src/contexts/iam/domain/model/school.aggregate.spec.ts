import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { School } from "./school.aggregate.js";
import { SchoolSlug } from "./school-slug.vo.js";

const ID = "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
const OWNER_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const NOW = new Date("2026-07-27T10:00:00Z");

describe("School.register", () => {
  it("nace en prueba, con 14 días y el dueño que la registró", () => {
    const school = School.register({
      id: SchoolId.of(ID),
      slug: SchoolSlug.of("atlantico-idiomas"),
      name: "Atlántico Idiomas",
      ownerUserId: OWNER_ID,
      now: NOW,
    });

    expect(school.status).toBe("trial");
    expect(school.trialEndsAt.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    expect(school.ownerUserId).toBe(OWNER_ID);
    expect(school.slug.value).toBe("atlantico-idiomas");
    expect(school.name).toBe("Atlántico Idiomas");
  });

  it("no admite un slug inválido", () => {
    expect(() => SchoolSlug.of("Admin")).toThrow();
  });
});
