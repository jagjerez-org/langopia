import { describe, expect, it, vi } from "vitest";
import { SiteDomain } from "../../domain/model/site-domain.entity.js";
import type { SiteDomainRepository } from "../../domain/ports/site-domain.repository.port.js";
import type { DnsVerifierPort } from "../../domain/ports/dns-verifier.port.js";
import type { TlsIssuerPort } from "../../domain/ports/tls-issuer.port.js";
import { VerifySiteDomainsJob } from "./verify-site-domains.job.js";

describe("VerifySiteDomainsJob", () => {
  it("verifica con DNS y pide TLS cuando encuentra el token", async () => {
    const domain = SiteDomain.request({
      id: "domain-1",
      schoolId: "school-1",
      hostname: "academia.test",
      verificationToken: "langopia-domain-verification_token",
      now: new Date("2026-07-28T10:00:00.000Z"),
    });
    const repository = repositoryWith([domain]);
    const tls: TlsIssuerPort = { issueCertificate: vi.fn(async () => ({ issued: false, reason: "noop" })) };
    const job = new VerifySiteDomainsJob(
      repository,
      { resolveTxt: vi.fn(async () => ["langopia-domain-verification_token"]) } satisfies DnsVerifierPort,
      tls,
      { execute: (work) => work(), read: (work) => work() },
      { runWithSchool: (_schoolId, work) => work() },
      { now: () => new Date("2026-07-28T10:15:00.000Z") },
      logger() as never,
    );

    const result = await job.verifyPendingDomains();

    expect(result).toEqual({ checked: 1, verified: 1, failed: 0 });
    expect(tls.issueCertificate).toHaveBeenCalledWith("academia.test");
    expect(domain.status).toBe("verified");
  });

  it("marca fallido un dominio que supera 48 horas sin TXT", async () => {
    const domain = SiteDomain.request({
      id: "domain-1",
      schoolId: "school-1",
      hostname: "academia.test",
      verificationToken: "langopia-domain-verification_token",
      now: new Date("2026-07-28T10:00:00.000Z"),
    });
    const repository = repositoryWith([domain]);
    const job = new VerifySiteDomainsJob(
      repository,
      { resolveTxt: vi.fn(async () => []) },
      { issueCertificate: vi.fn() },
      { execute: (work) => work(), read: (work) => work() },
      { runWithSchool: (_schoolId, work) => work() },
      { now: () => new Date("2026-07-30T10:00:01.000Z") },
      logger() as never,
    );

    const result = await job.verifyPendingDomains();

    expect(result).toEqual({ checked: 1, verified: 0, failed: 1 });
    expect(domain.status).toBe("failed");
  });
});

function repositoryWith(domains: SiteDomain[]): SiteDomainRepository {
  return {
    existsByHostname: vi.fn(),
    save: vi.fn(async () => undefined),
    pendingBefore: vi.fn(async () => domains),
    findById: vi.fn(),
    listForSchool: vi.fn(),
  };
}

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
