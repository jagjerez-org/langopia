import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Lead } from "./lead.aggregate.js";

const AHORA = new Date("2026-07-28T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");

function lead() {
  return Lead.capture({
    id: "22222222-2222-4222-8222-222222222222",
    schoolId: ESCUELA,
    name: "Ana García",
    email: "ANA@Example.COM",
    phone: "+34 600 000 000",
    locale: "es-ES",
    message: "Quiero clases de inglés",
    interestedLanguage: "en",
    declaredLevel: "A2",
    sourcePage: "/contacto",
    sourceCampaign: "google-ads-verano",
    referrer: "https://www.google.com/",
    now: AHORA,
  });
}

describe("Lead", () => {
  it("captura un candidato nuevo normalizando el correo y emite LeadCaptured", () => {
    const captured = lead();

    expect(captured.status).toBe("new");
    expect(captured.email).toBe("ana@example.com");
    expect(captured.sourcePage).toBe("/contacto");

    const events = captured.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventName).toBe("people.lead.captured");
    expect(events[0]!.payload()).toMatchObject({
      leadId: captured.id,
      email: "ana@example.com",
      interestedLanguage: "en",
    });
  });

  it("asigna resultado de nivelación sin convertir todavía", () => {
    const captured = lead();

    captured.assignPlacement({
      level: "B1",
      score: 72,
      suggestedCourseId: "33333333-3333-4333-8333-333333333333",
    });

    expect(captured.status).toBe("placement_done");
    expect(captured.placementLevel).toBe("B1");
    expect(captured.suggestedCourseId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("convierte una sola vez y emite LeadConverted", () => {
    const captured = lead();

    captured.convert({
      studentProfileId: "44444444-4444-4444-8444-444444444444",
      now: AHORA,
    });

    expect(captured.status).toBe("converted");
    expect(captured.convertedStudentProfileId).toBe("44444444-4444-4444-8444-444444444444");
    expect(captured.convertedAt).toEqual(AHORA);
    expect(captured.pullDomainEvents().map((event) => event.eventName)).toContain(
      "people.lead.converted",
    );
    expect(() =>
      captured.convert({ studentProfileId: "55555555-5555-4555-8555-555555555555", now: AHORA }),
    ).toThrow(/ya se ha convertido/);
  });

  it("descarta y enfría candidatos inactivos de más de 30 días", () => {
    const captured = lead();
    captured.discard({ reason: "Buscaba clases presenciales" });
    expect(captured.status).toBe("discarded");
    expect(captured.discardedReason).toBe("Buscaba clases presenciales");

    const stale = Lead.rehydrate({
      ...captured.toSnapshot(),
      status: "new",
      discardedReason: null,
      createdAt: "2026-06-20T10:00:00.000Z",
      lastContactedAt: null,
      convertedAt: null,
      convertedStudentProfileId: null,
    });
    stale.markColdIfInactive(new Date("2026-07-28T10:00:00Z"));
    expect(stale.status).toBe("cold");
  });
});
