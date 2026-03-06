import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OnboardingProgress } from "../database/entities/onboarding-progress.entity.js";

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(OnboardingProgress)
    private readonly progressRepo: Repository<OnboardingProgress>,
  ) {}

  async getProgress(
    userId: string,
    academyId: string,
  ): Promise<OnboardingProgress[]> {
    return this.progressRepo.find({
      where: { userId, academyId },
    });
  }

  async completeStep(
    userId: string,
    academyId: string,
    step: string,
  ): Promise<OnboardingProgress> {
    let progress = await this.progressRepo.findOne({
      where: { userId, academyId, step },
    });

    if (progress) {
      progress.completed = true;
      return this.progressRepo.save(progress);
    }

    progress = this.progressRepo.create({
      userId,
      academyId,
      step,
      completed: true,
    });
    return this.progressRepo.save(progress);
  }
}
