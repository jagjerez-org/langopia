import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { StudentSubscriptionsService } from "./student-subscriptions.service.js";
import { CreateStudentSubscriptionDto } from "./dto/create-student-subscription.dto.js";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto.js";
import { CreatePublicSubscriptionDto } from "./dto/create-public-subscription.dto.js";

@ApiTags("Student Subscriptions")
@Controller("academies/:academyId/subscriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class StudentSubscriptionsController {
  constructor(
    private readonly subscriptionsService: StudentSubscriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List subscriptions for academy" })
  async list(@Param("academyId") academyId: string) {
    return this.subscriptionsService.list(academyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a student subscription (triggers Stripe Checkout)" })
  async create(
    @Param("academyId") academyId: string,
    @Body() dto: CreateStudentSubscriptionDto,
  ) {
    return this.subscriptionsService.create(academyId, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get subscription detail" })
  async findOne(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.subscriptionsService.findOne(academyId, id);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a subscription" })
  async cancel(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionsService.cancel(academyId, id, dto);
  }
}

// Separate controller for public (no auth) endpoint
@ApiTags("Student Subscriptions")
@Controller("public/academy")
export class StudentSubscriptionsPublicController {
  constructor(
    private readonly subscriptionsService: StudentSubscriptionsService,
  ) {}

  @Post(":slug/subscribe")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Public student subscription (no auth required)" })
  async createPublic(
    @Param("slug") slug: string,
    @Body() dto: CreatePublicSubscriptionDto,
  ) {
    return this.subscriptionsService.createPublicSubscription(slug, dto);
  }
}
