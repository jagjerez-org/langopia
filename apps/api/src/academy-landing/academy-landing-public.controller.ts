import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AcademyLandingService } from "./academy-landing.service.js";

@ApiTags("Academy Landing")
@Controller("public/academy/:slug/landing")
export class AcademyLandingPublicController {
  constructor(private readonly landingService: AcademyLandingService) {}

  @Get()
  @ApiOperation({ summary: "Get published landing page by academy slug" })
  async getPublicLanding(@Param("slug") slug: string) {
    return this.landingService.getPublicLanding(slug);
  }
}
