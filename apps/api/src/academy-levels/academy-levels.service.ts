import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademyLevel } from "../database/entities/academy-level.entity.js";
import { CreateAcademyLevelDto } from "./dto/create-academy-level.dto.js";
import { UpdateAcademyLevelDto } from "./dto/update-academy-level.dto.js";

@Injectable()
export class AcademyLevelsService {
  constructor(
    @InjectRepository(AcademyLevel)
    private readonly levelRepo: Repository<AcademyLevel>,
  ) {}

  async list(academyId: string): Promise<AcademyLevel[]> {
    return this.levelRepo.find({
      where: { academyId },
      order: { sortOrder: "ASC" },
    });
  }

  async create(
    academyId: string,
    dto: CreateAcademyLevelDto,
  ): Promise<AcademyLevel> {
    const level = this.levelRepo.create({
      ...dto,
      academyId,
    });
    return this.levelRepo.save(level);
  }

  async update(
    academyId: string,
    id: string,
    dto: UpdateAcademyLevelDto,
  ): Promise<AcademyLevel> {
    const level = await this.levelRepo.findOne({
      where: { id, academyId },
    });
    if (!level) {
      throw new NotFoundException("Academy level not found");
    }
    Object.assign(level, dto);
    return this.levelRepo.save(level);
  }

  async remove(academyId: string, id: string): Promise<void> {
    const level = await this.levelRepo.findOne({
      where: { id, academyId },
    });
    if (!level) {
      throw new NotFoundException("Academy level not found");
    }
    await this.levelRepo.remove(level);
  }
}
