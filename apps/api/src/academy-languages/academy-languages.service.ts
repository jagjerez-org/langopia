import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademyLanguage } from "../database/entities/academy-language.entity.js";
import { CreateAcademyLanguageDto } from "./dto/create-academy-language.dto.js";
import { UpdateAcademyLanguageDto } from "./dto/update-academy-language.dto.js";

@Injectable()
export class AcademyLanguagesService {
  constructor(
    @InjectRepository(AcademyLanguage)
    private readonly languageRepo: Repository<AcademyLanguage>,
  ) {}

  async list(academyId: string): Promise<AcademyLanguage[]> {
    return this.languageRepo.find({
      where: { academyId },
      order: { sortOrder: "ASC" },
    });
  }

  async create(
    academyId: string,
    dto: CreateAcademyLanguageDto,
  ): Promise<AcademyLanguage> {
    const language = this.languageRepo.create({
      ...dto,
      academyId,
    });
    return this.languageRepo.save(language);
  }

  async update(
    academyId: string,
    id: string,
    dto: UpdateAcademyLanguageDto,
  ): Promise<AcademyLanguage> {
    const language = await this.languageRepo.findOne({
      where: { id, academyId },
    });
    if (!language) {
      throw new NotFoundException("Academy language not found");
    }
    Object.assign(language, dto);
    return this.languageRepo.save(language);
  }

  async remove(academyId: string, id: string): Promise<void> {
    const language = await this.languageRepo.findOne({
      where: { id, academyId },
    });
    if (!language) {
      throw new NotFoundException("Academy language not found");
    }
    await this.languageRepo.remove(language);
  }
}
