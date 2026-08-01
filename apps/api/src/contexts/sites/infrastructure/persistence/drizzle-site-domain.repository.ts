import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import {
  SiteDomain,
  type SiteDomainStatus,
  type SiteDomainTlsStatus,
} from "../../domain/model/site-domain.entity.js";
import type { SiteDomainRepository } from "../../domain/ports/site-domain.repository.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

type SchoolDomainRow = typeof schema.schoolDomains.$inferSelect;

@Injectable()
export class DrizzleSiteDomainRepository implements SiteDomainRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async existsByHostname(hostname: string): Promise<boolean> {
    const [row] = await this.drizzle.connection.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM school_domains WHERE lower(hostname) = lower(${hostname})
      ) AS "exists"
    `);
    return row?.exists ?? false;
  }

  async save(domain: SiteDomain): Promise<void> {
    await this.drizzle.db
      .insert(schema.schoolDomains)
      .values({
        id: domain.id,
        schoolId: domain.schoolId,
        hostname: domain.hostname,
        isPrimary: domain.isPrimary,
        verifiedAt: domain.verifiedAt,
        createdAt: domain.createdAt,
        verificationToken: domain.verificationToken,
        verificationExpiresAt: domain.expiresAt,
        verificationFailedAt: domain.failedAt,
        verificationFailureReason: domain.failureReason,
        status: domain.status,
        tlsIssuedAt: domain.tlsIssuedAt,
        tlsStatus: domain.tlsStatus,
      })
      .onConflictDoUpdate({
        target: schema.schoolDomains.id,
        set: {
          hostname: domain.hostname,
          isPrimary: domain.isPrimary,
          verifiedAt: domain.verifiedAt,
          verificationToken: domain.verificationToken,
          verificationExpiresAt: domain.expiresAt,
          verificationFailedAt: domain.failedAt,
          verificationFailureReason: domain.failureReason,
          status: domain.status,
          tlsIssuedAt: domain.tlsIssuedAt,
          tlsStatus: domain.tlsStatus,
        },
      });
  }

  async findById(id: string): Promise<SiteDomain | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(schema.schoolDomains)
      .where(eq(schema.schoolDomains.id, id))
      .limit(1);
    return row ? mapDomain(row) : null;
  }

  async pendingBefore(now: Date): Promise<SiteDomain[]> {
    const rows = await this.drizzle.connection.execute<SchoolDomainRow>(sql`
      SELECT *
      FROM school_domains
      WHERE status = 'pending'
        AND created_at <= ${now}
      ORDER BY created_at
    `);
    return rows.map(mapDomain);
  }

  async listForSchool(): Promise<SiteDomain[]> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.schoolDomains)
      .orderBy(schema.schoolDomains.createdAt);
    return rows.map(mapDomain);
  }
}

function mapDomain(row: SchoolDomainRow): SiteDomain {
  return SiteDomain.rehydrate({
    id: row.id,
    schoolId: row.schoolId,
    hostname: row.hostname,
    verificationToken: row.verificationToken,
    createdAt: row.createdAt,
    expiresAt: row.verificationExpiresAt,
    status: row.status as SiteDomainStatus,
    isPrimary: row.isPrimary,
    verifiedAt: row.verifiedAt,
    failedAt: row.verificationFailedAt,
    failureReason: row.verificationFailureReason,
    tlsIssuedAt: row.tlsIssuedAt,
    tlsStatus: row.tlsStatus as SiteDomainTlsStatus,
  });
}
