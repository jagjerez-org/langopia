import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademyPlan, StudentSubscription, Academy } from "../database/entities/index.js";
import { AcademyPlanPeriodicity } from "@langopia/shared/types";
import { CreateAcademyPlanDto } from "./dto/create-academy-plan.dto.js";
import { UpdateAcademyPlanDto } from "./dto/update-academy-plan.dto.js";

@Injectable()
export class AcademyPlansService {
  constructor(
    @InjectRepository(AcademyPlan)
    private readonly planRepo: Repository<AcademyPlan>,
    @InjectRepository(StudentSubscription)
    private readonly subscriptionRepo: Repository<StudentSubscription>,
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
  ) {}

  async list(academyId: string) {
    return this.planRepo.find({
      where: { academyId },
      order: { price: "ASC" },
    });
  }

  async create(academyId: string, dto: CreateAcademyPlanDto) {
    const plan = new AcademyPlan();
    plan.academyId = academyId;
    plan.name = dto.name;
    plan.price = dto.price;
    plan.currency = dto.currency ?? "EUR";
    plan.periodicity = (dto.periodicity as AcademyPlanPeriodicity) ?? AcademyPlanPeriodicity.MONTHLY;
    plan.limits = (dto.limits ?? {}) as AcademyPlan["limits"];
    plan.isActive = true;

    return this.planRepo.save(plan);
  }

  async findOne(academyId: string, id: string) {
    const plan = await this.planRepo.findOne({
      where: { id, academyId },
    });

    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    const subscriptionCount = await this.subscriptionRepo.count({
      where: { academyPlanId: id },
    });

    return { ...plan, subscriptionCount };
  }

  async update(academyId: string, id: string, dto: UpdateAcademyPlanDto) {
    const plan = await this.planRepo.findOne({
      where: { id, academyId },
    });

    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.price !== undefined) plan.price = dto.price;
    if (dto.currency !== undefined) plan.currency = dto.currency;
    if (dto.periodicity !== undefined) plan.periodicity = dto.periodicity as AcademyPlanPeriodicity;
    if (dto.limits !== undefined) plan.limits = dto.limits as AcademyPlan["limits"];
    return this.planRepo.save(plan);
  }

  async setActive(academyId: string, id: string, isActive: boolean) {
    const plan = await this.planRepo.findOne({
      where: { id, academyId },
    });

    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    plan.isActive = isActive;
    return this.planRepo.save(plan);
  }

  async getPublicPlans(slug: string) {
    const academy = await this.academyRepo.findOne({
      where: { slug },
    });

    if (!academy) {
      throw new NotFoundException("Academy not found");
    }

    return this.planRepo.find({
      where: { academyId: academy.id, isActive: true },
      order: { price: "ASC" },
    });
  }
}
