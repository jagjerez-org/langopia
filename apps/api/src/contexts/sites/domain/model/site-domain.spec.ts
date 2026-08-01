import { describe, expect, it } from "vitest";
import { InvalidSiteDomainError } from "../errors/sites.errors.js";
import { SiteDomain } from "./site-domain.entity.js";

const NOW = new Date("2026-07-28T10:00:00.000Z");
const TOKEN = "langopia-domain-verification_abc123";

describe("SiteDomain", () => {
  it("normaliza el hostname y expone una instrucción TXT, no un secreto", () => {
    const domain = SiteDomain.request({
      id: "domain-1",
      schoolId: "school-1",
      hostname: "  WWW.Academia-Ejemplo.COM:443 ",
      verificationToken: TOKEN,
      now: NOW,
    });

    expect(domain.hostname).toBe("www.academia-ejemplo.com");
    expect(domain.status).toBe("pending");
    expect(domain.expiresAt.toISOString()).toBe("2026-07-30T10:00:00.000Z");
    expect(domain.verificationInstruction).toEqual({
      type: "TXT",
      name: "_langopia.www.academia-ejemplo.com",
      value: TOKEN,
    });
    expect(domain.toView()).not.toHaveProperty("verificationToken");
    expect(domain.toView().verification).toEqual(domain.verificationInstruction);
  });

  it("rechaza hostnames inválidos", () => {
    expect(() =>
      SiteDomain.request({
        id: "domain-1",
        schoolId: "school-1",
        hostname: "https://academia.test/path",
        verificationToken: TOKEN,
        now: NOW,
      }),
    ).toThrow(InvalidSiteDomainError);
  });

  it("solo se verifica cuando DNS contiene el token", () => {
    const domain = SiteDomain.request({
      id: "domain-1",
      schoolId: "school-1",
      hostname: "academia.test",
      verificationToken: TOKEN,
      now: NOW,
    });

    expect(domain.verifyDns(["otro-token"], new Date("2026-07-28T10:15:00.000Z"))).toBe(false);
    expect(domain.status).toBe("pending");

    expect(domain.verifyDns([`v=spf1 ${TOKEN}`], new Date("2026-07-28T10:30:00.000Z"))).toBe(true);
    expect(domain.status).toBe("verified");
    expect(domain.verifiedAt?.toISOString()).toBe("2026-07-28T10:30:00.000Z");
  });

  it("falla pasado el plazo de 48 horas", () => {
    const domain = SiteDomain.request({
      id: "domain-1",
      schoolId: "school-1",
      hostname: "academia.test",
      verificationToken: TOKEN,
      now: NOW,
    });

    domain.markFailedIfExpired(new Date("2026-07-30T10:00:01.000Z"));

    expect(domain.status).toBe("failed");
    expect(domain.failureReason).toBe("No se encontró el registro TXT de verificación en 48 horas.");
  });
});
