import type { LangopiaClient } from "../client";
import type {
  InviteTeamMemberRequest,
  UpdateTeamMemberRequest,
  CreateInviteLinkRequest,
  TeamMemberResponse,
  InviteLinkResponse,
} from "../types";

export class TeamResource {
  constructor(private client: LangopiaClient) {}

  list(academyId: string): Promise<TeamMemberResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/team`,
      auth: "jwt",
    });
  }

  invite(academyId: string, data: InviteTeamMemberRequest): Promise<TeamMemberResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/team/invite`,
      auth: "jwt",
      body: data,
    });
  }

  get(academyId: string, id: string): Promise<TeamMemberResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/team/${id}`,
      auth: "jwt",
    });
  }

  update(academyId: string, id: string, data: UpdateTeamMemberRequest): Promise<TeamMemberResponse> {
    return this.client.request({
      method: "PATCH",
      path: `/academies/${academyId}/team/${id}`,
      auth: "jwt",
      body: data,
    });
  }

  remove(academyId: string, id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/academies/${academyId}/team/${id}`,
      auth: "jwt",
    });
  }

  createInviteLink(academyId: string, data: CreateInviteLinkRequest): Promise<InviteLinkResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/${academyId}/team/invite-links`,
      auth: "jwt",
      body: data,
    });
  }

  listInviteLinks(academyId: string): Promise<InviteLinkResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/team/invite-links`,
      auth: "jwt",
    });
  }

  deleteInviteLink(academyId: string, id: string): Promise<void> {
    return this.client.request({
      method: "DELETE",
      path: `/academies/${academyId}/team/invite-links/${id}`,
      auth: "jwt",
    });
  }

  joinViaInvite(token: string): Promise<TeamMemberResponse> {
    return this.client.request({
      method: "POST",
      path: `/academies/public/invite/${token}`,
      auth: "jwt",
    });
  }
}
