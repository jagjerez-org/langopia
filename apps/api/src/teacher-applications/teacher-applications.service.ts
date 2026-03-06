import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TeacherApplication, ApplicationCustomField, Academy } from "../database/entities/index.js";
import { TeacherApplicationStatus } from "@langopia/shared/types";
import { SubmitApplicationDto } from "./dto/submit-application.dto.js";
import { ReviewApplicationDto } from "./dto/review-application.dto.js";
import { CreateCustomFieldDto } from "./dto/create-custom-field.dto.js";

@Injectable()
export class TeacherApplicationsService {
  constructor(
    @InjectRepository(TeacherApplication)
    private readonly applicationRepo: Repository<TeacherApplication>,
    @InjectRepository(ApplicationCustomField)
    private readonly customFieldRepo: Repository<ApplicationCustomField>,
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
  ) {}

  async list(academyId: string, status?: string) {
    const where: Record<string, unknown> = { academyId };
    if (status) {
      where.status = status;
    }

    return this.applicationRepo.find({
      where,
      order: { createdAt: "DESC" },
    });
  }

  async findOne(academyId: string, id: string) {
    const application = await this.applicationRepo.findOne({
      where: { id, academyId },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    return application;
  }

  async review(academyId: string, id: string, userId: string, dto: ReviewApplicationDto) {
    const application = await this.applicationRepo.findOne({
      where: { id, academyId },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    application.status = dto.status as TeacherApplicationStatus;
    application.reviewNotes = dto.reviewNotes ?? null;
    application.reviewedByUserId = userId;
    application.reviewedAt = new Date();

    return this.applicationRepo.save(application);
  }

  async submitPublic(slug: string, dto: SubmitApplicationDto) {
    const academy = await this.academyRepo.findOne({
      where: { slug },
    });

    if (!academy) {
      throw new NotFoundException("Academy not found");
    }

    const application = this.applicationRepo.create({
      academyId: academy.id,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
      languages: dto.languages ?? [],
      experience: dto.experience ?? null,
      cvUrl: dto.cvUrl ?? null,
      attachments: dto.attachments ?? [],
      customFields: dto.customFields ?? {},
      status: TeacherApplicationStatus.PENDING,
    });

    return this.applicationRepo.save(application);
  }

  async listCustomFields(academyId: string) {
    return this.customFieldRepo.find({
      where: { academyId },
      order: { sortOrder: "ASC" },
    });
  }

  async createCustomField(academyId: string, dto: CreateCustomFieldDto) {
    const field = this.customFieldRepo.create({
      academyId,
      label: dto.label,
      fieldType: dto.fieldType ?? "text",
      isRequired: dto.isRequired ?? false,
      options: dto.options ?? [],
      sortOrder: dto.sortOrder ?? 0,
    });

    return this.customFieldRepo.save(field);
  }

  async removeCustomField(academyId: string, id: string) {
    const field = await this.customFieldRepo.findOne({
      where: { id, academyId },
    });

    if (!field) {
      throw new NotFoundException("Custom field not found");
    }

    await this.customFieldRepo.remove(field);
  }

  async getPublicCustomFields(slug: string) {
    const academy = await this.academyRepo.findOne({
      where: { slug },
    });

    if (!academy) {
      throw new NotFoundException("Academy not found");
    }

    return this.customFieldRepo.find({
      where: { academyId: academy.id },
      order: { sortOrder: "ASC" },
    });
  }
}
