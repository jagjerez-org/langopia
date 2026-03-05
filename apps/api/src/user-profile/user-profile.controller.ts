import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto.js";
import { UnregisterPushTokenDto } from "./dto/unregister-push-token.dto.js";

@ApiTags("User Profile")
@ApiBearerAuth()
@Controller("user")
@UseGuards(JwtAuthGuard)
export class UserProfileController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get("profile")
  @ApiOperation({ summary: "Get current user profile" })
  async getProfile(@CurrentUser() currentUser: User) {
    const user = await this.userRepo.findOne({
      where: { id: currentUser.id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    };
  }

  @Patch("profile")
  @ApiOperation({ summary: "Update user profile (name)" })
  async updateProfile(
    @CurrentUser() currentUser: User,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: currentUser.id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    user.name = dto.name.trim();
    await this.userRepo.save(user);

    return { name: user.name };
  }

  @Post("push-tokens")
  @ApiOperation({ summary: "Register FCM push token" })
  async registerPushToken(
    @CurrentUser() currentUser: User,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: currentUser.id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Remove existing entry for this token (upsert)
    user.fcmTokens = (user.fcmTokens ?? []).filter(
      (t) => t.token !== dto.token,
    );
    user.fcmTokens.push({
      token: dto.token,
      platform: dto.platform,
      createdAt: new Date().toISOString(),
    });

    await this.userRepo.save(user);

    return { success: true };
  }

  @Delete("push-tokens")
  @ApiOperation({ summary: "Unregister FCM push token" })
  async unregisterPushToken(
    @CurrentUser() currentUser: User,
    @Body() dto: UnregisterPushTokenDto,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: currentUser.id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    user.fcmTokens = (user.fcmTokens ?? []).filter(
      (t) => t.token !== dto.token,
    );

    await this.userRepo.save(user);

    return { success: true };
  }
}
