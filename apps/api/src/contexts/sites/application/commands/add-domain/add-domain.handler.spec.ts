import { describe, expect, it, vi } from "vitest";
import { DuplicateSiteDomainError } from "../../../domain/errors/sites.errors.js";
import type { SiteDomainRepository } from "../../../domain/ports/site-domain.repository.port.js";
import { AddDomainCommand, AddDomainHandler } from "./add-domain.handler.js";

describe("AddDomainHandler", () => {
  it("genera token TXT y guarda el dominio normalizado dentro de una unidad de trabajo", async () => {
    const saved: unknown[] = [];
    const repository: SiteDomainRepository = {
      existsByHostname: vi.fn(async () => false),
      save: vi.fn(async (domain) => {
        saved.push(domain);
      }),
      pendingBefore: vi.fn(),
      findById: vi.fn(),
      listForSchool: vi.fn(),
    };
    const handler = new AddDomainHandler(
      repository,
      { execute: (work) => work(), read: (work) => work() },
      {
        schoolId: () => "school-1",
        membershipId: () => "membership-1",
        roles: () => ["owner"],
        has: (role: string) => role === "owner",
      },
      { generate: vi.fn(() => "domain-1") },
      { generate: vi.fn(() => "token-raw-value") },
      { now: () => new Date("2026-07-28T10:00:00.000Z") },
    );

    const result = await handler.execute(new AddDomainCommand({ hostname: " Academia.TEST:443 " }));

    expect(repository.existsByHostname).toHaveBeenCalledWith("academia.test");
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: "domain-1",
      hostname: "academia.test",
      status: "pending",
      verification: {
        type: "TXT",
        name: "_langopia.academia.test",
        value: "langopia-domain-verification_token-raw-value",
      },
    });
    expect(result).not.toHaveProperty("verificationToken");
    expect(saved).toHaveLength(1);
  });

  it("rechaza un hostname duplicado tras normalizarlo", async () => {
    const repository: SiteDomainRepository = {
      existsByHostname: vi.fn(async () => true),
      save: vi.fn(),
      pendingBefore: vi.fn(),
      findById: vi.fn(),
      listForSchool: vi.fn(),
    };
    const handler = new AddDomainHandler(
      repository,
      { execute: (work) => work(), read: (work) => work() },
      {
        schoolId: () => "school-1",
        membershipId: () => "membership-1",
        roles: () => ["owner"],
        has: (role: string) => role === "owner",
      },
      { generate: vi.fn(() => "domain-1") },
      { generate: vi.fn(() => "token") },
      { now: () => new Date("2026-07-28T10:00:00.000Z") },
    );

    await expect(
      handler.execute(new AddDomainCommand({ hostname: "ACADEMIA.test" })),
    ).rejects.toBeInstanceOf(DuplicateSiteDomainError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
