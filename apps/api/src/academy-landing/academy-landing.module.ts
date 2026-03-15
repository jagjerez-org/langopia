import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademyLanding, Academy } from "../database/entities/index.js";
import { AcademyLandingController } from "./academy-landing.controller.js";
import { AcademyLandingPublicController } from "./academy-landing-public.controller.js";
import { AcademyLandingService } from "./academy-landing.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AcademyLanding, Academy])],
  controllers: [AcademyLandingController, AcademyLandingPublicController],
  providers: [AcademyLandingService],
  exports: [AcademyLandingService],
})
export class AcademyLandingModule {}
