import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OnboardingProgress } from "../database/entities/index.js";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingService } from "./onboarding.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([OnboardingProgress])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
