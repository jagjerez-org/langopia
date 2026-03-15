import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { UserProfileController } from "./user-profile.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
  ],
  controllers: [UserProfileController],
})
export class UserProfileModule {}
