import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademyLanding } from "../database/entities/academy-landing.entity.js";
import { Academy } from "../database/entities/academy.entity.js";
import { UpdateAcademyLandingDto } from "./dto/update-academy-landing.dto.js";

@Injectable()
export class AcademyLandingService {
  constructor(
    @InjectRepository(AcademyLanding)
    private readonly landingRepo: Repository<AcademyLanding>,
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
  ) {}

  async getLanding(academyId: string): Promise<AcademyLanding> {
    let landing = await this.landingRepo.findOne({
      where: { academyId },
    });

    if (!landing) {
      landing = this.landingRepo.create({ academyId });
      landing = await this.landingRepo.save(landing);
    }

    return landing;
  }

  async updateLanding(
    academyId: string,
    dto: UpdateAcademyLandingDto,
  ): Promise<AcademyLanding> {
    let landing = await this.landingRepo.findOne({
      where: { academyId },
    });

    if (!landing) {
      landing = this.landingRepo.create({ academyId });
    }

    Object.assign(landing, dto);
    return this.landingRepo.save(landing);
  }

  async getPublicLanding(slug: string): Promise<AcademyLanding> {
    const academy = await this.academyRepo.findOne({
      where: { slug },
    });
    if (!academy) {
      throw new NotFoundException("Academy not found");
    }

    const landing = await this.landingRepo.findOne({
      where: { academyId: academy.id, isPublished: true },
    });
    if (!landing) {
      throw new NotFoundException("Landing page not found or not published");
    }

    return landing;
  }
}
