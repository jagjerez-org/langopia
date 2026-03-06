import type { Permission } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface InviteTeamMemberRequest {
  email: string;
  role: string;
  permissions?: Permission[];
}

export interface UpdateTeamMemberRequest {
  role?: string;
  permissions?: Permission[];
}

export interface CreateInviteLinkRequest {
  targetRole: string;
  maxUses?: number;
  expiresInDays?: number;
}

// ─── Responses ──────────────────────────────────────

export interface TeamMemberResponse {
  id: string;
  userId: string;
  academyId: string;
  role: string;
  permissions: Permission[];
  user?: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface InviteLinkResponse {
  id: string;
  token: string;
  targetRole: string;
  academyId: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}
