import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { Lead } from "../../../domain/model/lead.aggregate.js";
import type { LeadCaptureTenantRunner } from "../../ports/lead-capture-tenant-runner.port.js";
import type { LeadRepository } from "../../../domain/ports/lead.repository.port.js";
import type { PublishedSiteResolver } from "../../ports/published-site-resolver.port.js";
import { CaptureLeadCommand } from "./capture-lead.command.js";
import { CaptureLeadHandler } from "./capture-lead.handler.js";

const AHORA = new Date("2026-07-28T10:00:00Z");
const ESCUELA = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => null,
    roles: () => [],
    has: () => false,
  };
}

function build() {
  const saved: Lead[] = [];
  const published: unknown[] = [];
  const resolver: PublishedSiteResolver = { schoolIdForPublishedSite: async () => ESCUELA };
  const runner: LeadCaptureTenantRunner = { runWithSchool: (_schoolId, work) => work() };
  const handler = new CaptureLeadHandler(
    {
      save: async (lead) => {
        saved.push(lead);
      },
      find: async () => null,
      markColdCandidates: async () => 0,
    } satisfies LeadRepository,
    fakeUow(),
    { publish: async (events) => void published.push(...events) } satisfies EventPublisher,
    fakeTenant(),
    { now: () => AHORA } satisfies Clock,
    { generate: () => "33333333-3333-4333-8333-333333333333" } satisfies IdGenerator,
    resolver,
    runner,
  );
  return { handler, saved, published };
}

describe("CaptureLeadHandler", () => {
  it("captura desde un sitio publicado y publica LeadCaptured", async () => {
    const { handler, saved, published } = build();

    const result = await handler.execute(
      new CaptureLeadCommand({
        siteId: SITE,
        name: "Ana García",
        email: "ana@example.com",
        locale: "es-ES",
        interestedLanguage: "en",
        sourcePage: "/contacto",
      }),
    );

    expect(result).toEqual({ leadId: "33333333-3333-4333-8333-333333333333", status: "new" });
    expect(saved).toHaveLength(1);
    expect(published).toHaveLength(1);
    expect((published[0] as { eventName: string }).eventName).toBe("people.lead.captured");
  });
});
