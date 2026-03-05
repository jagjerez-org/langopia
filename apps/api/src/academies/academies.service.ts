import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import crypto from "crypto";
import { Academy } from "../database/entities/academy.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { User } from "../database/entities/user.entity.js";
import { PLAN_LIMITS, UserPlan } from "@langopia/shared/types";
import { PermissionsService, Permission } from "../permissions/permissions.service.js";
import { CreateAcademyDto } from "./dto/create-academy.dto.js";
import { UpdateAcademyDto } from "./dto/update-academy.dto.js";

@Injectable()
export class AcademiesService {
  constructor(
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
    @InjectRepository(AcademyMember)
    private readonly memberRepo: Repository<AcademyMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly permissionsService: PermissionsService,
  ) {}

  async listAcademies(userId: string) {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ["academy"],
      order: { joinedAt: "ASC" },
    });

    return memberships.map((m) => ({
      id: m.academy.id,
      name: m.academy.name,
      slug: m.academy.slug,
      role: m.roles.includes("owner") ? "owner" : m.roles[0],
      roles: m.roles,
      academyType: m.academy.academyType,
      apiKey: m.roles.includes("owner") ? m.academy.apiKey : undefined,
      createdAt: m.academy.createdAt,
    }));
  }

  async createAcademy(userId: string, dto: CreateAcademyDto) {
    // Check plan limit for academies
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const plan = user?.plan ?? UserPlan.FREE;
    const limits = PLAN_LIMITS[plan];

    const currentCount = await this.memberRepo
      .createQueryBuilder("m")
      .where("m.userId = :userId", { userId })
      .andWhere("m.roles @> :roles", { roles: JSON.stringify(["owner"]) })
      .getCount();

    if (currentCount >= limits.maxAcademies) {
      throw new ForbiddenException(
        `Academy limit reached (${currentCount}/${limits.maxAcademies}). Upgrade your plan.`,
      );
    }

    if (!dto.name) {
      throw new BadRequestException("name is required");
    }

    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const apiKey = `lgo_${crypto.randomBytes(32).toString("hex")}`;

    const academy = new Academy();
    academy.name = dto.name;
    academy.slug = `${slug}-${crypto.randomBytes(4).toString("hex")}`;
    academy.apiKey = apiKey;
    academy.academyType = dto.academyType || "academy";

    const saved = await this.academyRepo.save(academy);

    // Create owner membership
    const member = new AcademyMember();
    member.userId = userId;
    member.academyId = saved.id;
    member.roles = ["owner"];
    await this.memberRepo.save(member);

    return {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      apiKey: saved.apiKey,
      role: "owner",
      roles: ["owner"],
      academyType: saved.academyType,
      createdAt: saved.createdAt,
    };
  }

  async getAcademy(userId: string, academyId: string) {
    const membership = await this.memberRepo.findOne({
      where: { userId, academyId },
      relations: ["academy"],
    });

    if (!membership) {
      throw new NotFoundException("Academy not found");
    }

    const memberCount = await this.memberRepo.count({
      where: { academyId },
    });

    return {
      id: membership.academy.id,
      name: membership.academy.name,
      slug: membership.academy.slug,
      role: membership.roles.includes("owner") ? "owner" : membership.roles[0],
      roles: membership.roles,
      academyType: membership.academy.academyType,
      apiKey: membership.roles.includes("owner") ? membership.academy.apiKey : undefined,
      settings: membership.academy.settings,
      memberCount,
      createdAt: membership.academy.createdAt,
    };
  }

  async updateAcademy(userId: string, academyId: string, dto: UpdateAcademyDto) {
    const membership = await this.memberRepo.findOne({
      where: { userId, academyId },
      relations: ["academy"],
    });

    if (!membership) {
      throw new NotFoundException("Academy not found");
    }

    if (!this.permissionsService.hasPermission(membership.roles, Permission.MANAGE_SETTINGS)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    if (dto.name) membership.academy.name = dto.name;
    if (dto.settings) {
      membership.academy.settings = { ...membership.academy.settings, ...dto.settings };
    }

    await this.academyRepo.save(membership.academy);

    return {
      id: membership.academy.id,
      name: membership.academy.name,
      slug: membership.academy.slug,
      settings: membership.academy.settings,
    };
  }

  async regenerateApiKey(userId: string, academyId: string) {
    const membership = await this.memberRepo.findOne({
      where: { userId, academyId },
      relations: ["academy"],
    });

    if (!membership || !membership.roles.includes("owner")) {
      throw new ForbiddenException("Only the owner can regenerate the API key");
    }

    membership.academy.apiKey = `lgo_${crypto.randomBytes(32).toString("hex")}`;
    await this.academyRepo.save(membership.academy);

    return {
      apiKey: membership.academy.apiKey,
    };
  }
}
