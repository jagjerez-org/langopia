import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademyLanguage } from "../database/entities/index.js";
import { AcademyLanguagesController } from "./academy-languages.controller.js";
import { AcademyLanguagesService } from "./academy-languages.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AcademyLanguage])],
  controllers: [AcademyLanguagesController],
  providers: [AcademyLanguagesService],
  exports: [AcademyLanguagesService],
})
export class AcademyLanguagesModule {}
