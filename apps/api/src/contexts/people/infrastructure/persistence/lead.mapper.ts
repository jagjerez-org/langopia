import * as schema from "@langopia/db/schema";
import type { LeadSnapshot } from "../../domain/model/lead.aggregate.js";
import { Lead } from "../../domain/model/lead.aggregate.js";

type LeadRow = typeof schema.leads.$inferSelect;
type LeadInsert = typeof schema.leads.$inferInsert;

export class LeadMapper {
  static toDomain(row: LeadRow): Lead {
    return Lead.rehydrate({
      id: row.id,
      schoolId: row.schoolId,
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
      convertedAt: row.convertedAt?.toISOString() ?? null,
      assignedToMembershipId: row.assignedToMembershipId,
      createdAt: row.createdAt.toISOString(),
      lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
      discardedReason: row.discardedReason,
    });
  }

  static toPersistence(lead: Lead): LeadInsert {
    const snapshot: LeadSnapshot = lead.toSnapshot();
    return {
      id: snapshot.id,
      schoolId: snapshot.schoolId,
      name: snapshot.name,
      email: snapshot.email,
      phone: snapshot.phone,
      locale: snapshot.locale,
      message: snapshot.message,
      interestedLanguage: snapshot.interestedLanguage,
      declaredLevel: snapshot.declaredLevel,
      placementLevel: snapshot.placementLevel,
      placementScore: snapshot.placementScore,
      suggestedCourseId: snapshot.suggestedCourseId,
      status: snapshot.status,
      sourcePage: snapshot.sourcePage,
      sourceCampaign: snapshot.sourceCampaign,
      referrer: snapshot.referrer,
      convertedStudentProfileId: snapshot.convertedStudentProfileId,
      convertedAt: snapshot.convertedAt ? new Date(snapshot.convertedAt) : null,
      assignedToMembershipId: snapshot.assignedToMembershipId,
      createdAt: new Date(snapshot.createdAt),
      lastContactedAt: snapshot.lastContactedAt ? new Date(snapshot.lastContactedAt) : null,
      discardedReason: snapshot.discardedReason,
    };
  }
}
