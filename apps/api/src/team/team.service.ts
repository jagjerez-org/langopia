import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import { TeamMember, User, InviteLink, Academy } from "../database/entities/index.js";
import { ROLE_TEMPLATES, TeamRole } from "@langopia/shared/types";
import { InviteTeamMemberDto } from "./dto/invite-team-member.dto.js";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto.js";
import { CreateInviteLinkDto } from "./dto/create-invite-link.dto.js";
import { JoinViaInviteDto } from "./dto/join-via-invite.dto.js";

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(InviteLink)
    private readonly inviteLinkRepo: Repository<InviteLink>,
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
  ) {}

  async list(academyId: string) {
    const members = await this.teamMemberRepo.find({
      where: { academyId },
      relations: ["user"],
      order: { joinedAt: "ASC" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      permissions: m.permissions,
      isActive: m.isActive,
      joinedAt: m.joinedAt,
      user: m.user
        ? {
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
            profileImageUrl: m.user.profileImageUrl,
          }
        : null,
    }));
  }

  async invite(academyId: string, dto: InviteTeamMemberDto) {
    // Find or create user by email
    let user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      user = this.userRepo.create({
        email: dto.email,
        name: dto.name,
      });
      user = await this.userRepo.save(user);
    }

    // Check if already a member
    const existing = await this.teamMemberRepo.findOne({
      where: { userId: user.id, academyId },
    });

    if (existing) {
      throw new ConflictException("User is already a team member of this academy");
    }

    // Determine permissions
    const permissions =
      dto.permissions ??
      (ROLE_TEMPLATES[dto.role as TeamRole] ?? []).map((p) => p as string);

    const member = this.teamMemberRepo.create({
      userId: user.id,
      academyId,
      role: dto.role,
      permissions,
    });

    const saved = await this.teamMemberRepo.save(member);

    return {
      id: saved.id,
      userId: saved.userId,
      role: saved.role,
      permissions: saved.permissions,
      isActive: saved.isActive,
      joinedAt: saved.joinedAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async findOne(academyId: string, id: string) {
    const member = await this.teamMemberRepo.findOne({
      where: { id, academyId },
      relations: ["user"],
    });

    if (!member) {
      throw new NotFoundException("Team member not found");
    }

    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      permissions: member.permissions,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            profileImageUrl: member.user.profileImageUrl,
          }
        : null,
    };
  }

  async update(academyId: string, id: string, dto: UpdateTeamMemberDto) {
    const member = await this.teamMemberRepo.findOne({
      where: { id, academyId },
    });

    if (!member) {
      throw new NotFoundException("Team member not found");
    }

    if (dto.role !== undefined) {
      member.role = dto.role;
      // If role changes and no custom permissions provided, reset to template
      if (dto.permissions === undefined) {
        member.permissions = (
          ROLE_TEMPLATES[dto.role as TeamRole] ?? []
        ).map((p) => p as string);
      }
    }

    if (dto.permissions !== undefined) {
      member.permissions = dto.permissions;
    }

    if (dto.isActive !== undefined) {
      member.isActive = dto.isActive;
    }

    const saved = await this.teamMemberRepo.save(member);

    return {
      id: saved.id,
      userId: saved.userId,
      role: saved.role,
      permissions: saved.permissions,
      isActive: saved.isActive,
      joinedAt: saved.joinedAt,
    };
  }

  async remove(academyId: string, id: string) {
    const member = await this.teamMemberRepo.findOne({
      where: { id, academyId },
    });

    if (!member) {
      throw new NotFoundException("Team member not found");
    }

    await this.teamMemberRepo.remove(member);
  }

  async createInviteLink(academyId: string, dto: CreateInviteLinkDto) {
    const token = randomBytes(32).toString("hex");

    const link = this.inviteLinkRepo.create({
      academyId,
      token,
      targetRole: dto.targetRole,
      maxUses: dto.maxUses ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const saved = await this.inviteLinkRepo.save(link);

    return {
      id: saved.id,
      token: saved.token,
      targetRole: saved.targetRole,
      maxUses: saved.maxUses,
      usedCount: saved.usedCount,
      expiresAt: saved.expiresAt,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  async listInviteLinks(academyId: string) {
    const links = await this.inviteLinkRepo.find({
      where: { academyId, isActive: true },
      order: { createdAt: "DESC" },
    });

    return links.map((l) => ({
      id: l.id,
      token: l.token,
      targetRole: l.targetRole,
      maxUses: l.maxUses,
      usedCount: l.usedCount,
      expiresAt: l.expiresAt,
      isActive: l.isActive,
      createdAt: l.createdAt,
    }));
  }

  async deactivateInviteLink(academyId: string, id: string) {
    const link = await this.inviteLinkRepo.findOne({
      where: { id, academyId },
    });

    if (!link) {
      throw new NotFoundException("Invite link not found");
    }

    link.isActive = false;
    await this.inviteLinkRepo.save(link);
  }

  async joinViaInvite(token: string, dto: JoinViaInviteDto) {
    const link = await this.inviteLinkRepo.findOne({
      where: { token, isActive: true },
    });

    if (!link) {
      throw new NotFoundException("Invite link not found or inactive");
    }

    // Check expiration
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      throw new BadRequestException("Invite link has expired");
    }

    // Check max uses
    if (link.maxUses !== null && link.usedCount >= link.maxUses) {
      throw new BadRequestException("Invite link has reached maximum uses");
    }

    // Find or create user
    let user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      user = this.userRepo.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
      user = await this.userRepo.save(user);
    }

    // Check if already a member
    const existing = await this.teamMemberRepo.findOne({
      where: { userId: user.id, academyId: link.academyId },
    });

    if (existing) {
      throw new ConflictException("User is already a team member of this academy");
    }

    // Create team member with role template permissions
    const permissions = (
      ROLE_TEMPLATES[link.targetRole as TeamRole] ?? []
    ).map((p) => p as string);

    const member = this.teamMemberRepo.create({
      userId: user.id,
      academyId: link.academyId,
      role: link.targetRole,
      permissions,
    });

    await this.teamMemberRepo.save(member);

    // Increment used count
    link.usedCount += 1;
    await this.inviteLinkRepo.save(link);

    return {
      id: member.id,
      userId: user.id,
      academyId: link.academyId,
      role: member.role,
      permissions: member.permissions,
    };
  }
}
