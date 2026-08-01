import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { LeadId } from "../../domain/model/identifiers.js";
import type { Lead } from "../../domain/model/lead.aggregate.js";
import type { LeadRepository } from "../../domain/ports/lead.repository.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { LeadMapper } from "./lead.mapper.js";

@Injectable()
export class DrizzleLeadRepository implements LeadRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(id: LeadId): Promise<Lead | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.id, id.value))
      .limit(1);
    return rows[0] ? LeadMapper.toDomain(rows[0]) : null;
  }

  async save(lead: Lead): Promise<void> {
    const row = LeadMapper.toPersistence(lead);
    await this.drizzle.db
      .insert(schema.leads)
      .values(row)
      .onConflictDoUpdate({
        target: schema.leads.id,
        set: {
          name: row.name,
          email: row.email,
          phone: row.phone,
          locale: row.locale,
          message: row.message,
          interestedLanguage: row.interestedLanguage,
          declaredLevel: row.declaredLevel,
          placementLevel: row.placementLevel,
          placementScore: row.placementScore,
          suggestedCourseId: row.suggestedCourseId,
          status: row.status,
          sourcePage: row.sourcePage,
          sourceCampaign: row.sourceCampaign,
          referrer: row.referrer,
          convertedStudentProfileId: row.convertedStudentProfileId,
          convertedAt: row.convertedAt,
          assignedToMembershipId: row.assignedToMembershipId,
          lastContactedAt: row.lastContactedAt,
          discardedReason: row.discardedReason,
        },
      });
  }

  async markColdCandidates(cutoff: Date): Promise<number> {
    const rows = await this.drizzle.db
      .update(schema.leads)
      .set({ status: "cold" })
      .where(
        and(
          inArray(schema.leads.status, ["new", "placement_sent", "contacted"]),
          or(
            and(isNull(schema.leads.lastContactedAt), lt(schema.leads.createdAt, cutoff)),
            lt(schema.leads.lastContactedAt, cutoff),
          ),
        ),
      )
      .returning({ id: schema.leads.id });
    return rows.length;
  }
}
