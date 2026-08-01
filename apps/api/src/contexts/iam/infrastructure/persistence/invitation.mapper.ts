import type * as schema from "@langopia/db/schema";
import { Invitation, InvitationId, type MembershipRoleName } from "../../domain/model/invitation.aggregate.js";

type InvitationRow = typeof schema.invitations.$inferSelect;

export const InvitationMapper = {
  toDomain(row: InvitationRow): Invitation {
    return Invitation.reconstruct({
      id: InvitationId.of(row.id),
      schoolId: row.schoolId,
      email: row.email,
      role: row.role as MembershipRoleName,
      token: row.token,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
    });
  },

  toPersistence(invitation: Invitation): typeof schema.invitations.$inferInsert {
    return {
      id: invitation.id.value,
      schoolId: invitation.schoolId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
    };
  },
};
