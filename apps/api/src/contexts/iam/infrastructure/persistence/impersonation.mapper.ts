import type * as schema from "@langopia/db/schema";
import { Impersonation, ImpersonationId } from "../../domain/model/impersonation.aggregate.js";

type ImpersonationRow = typeof schema.impersonations.$inferSelect;

export const ImpersonationMapper = {
  toDomain(row: ImpersonationRow): Impersonation {
    return Impersonation.reconstruct({
      id: ImpersonationId.of(row.id),
      schoolId: row.schoolId,
      targetMembershipId: row.targetMembershipId,
      impersonatorUserId: row.impersonatorUserId,
      impersonatorMembershipId: row.impersonatorMembershipId,
      impersonatorName: row.impersonatorName,
      impersonatorEmail: row.impersonatorEmail,
      reason: row.reason,
      involvesMinor: row.involvesMinor,
      startedAt: row.startedAt,
      expiresAt: row.expiresAt,
      endedAt: row.endedAt,
    });
  },

  toPersistence(impersonation: Impersonation): typeof schema.impersonations.$inferInsert {
    return {
      id: impersonation.id.value,
      schoolId: impersonation.schoolId,
      targetMembershipId: impersonation.targetMembershipId,
      impersonatorUserId: impersonation.impersonatorUserId,
      impersonatorMembershipId: impersonation.impersonatorMembershipId,
      impersonatorName: impersonation.impersonatorName,
      impersonatorEmail: impersonation.impersonatorEmail,
      reason: impersonation.reason,
      involvesMinor: impersonation.involvesMinor,
      startedAt: impersonation.startedAt,
      expiresAt: impersonation.expiresAt,
      endedAt: impersonation.endedAt,
    };
  },
};
