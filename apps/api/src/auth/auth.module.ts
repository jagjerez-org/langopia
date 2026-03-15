import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User, Academy, AcademyMember } from "../database/entities/index.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Academy, AcademyMember]),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get("JWT_EXPIRATION", "6h") },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ApiKeyGuard, RolesGuard],
  exports: [AuthService, JwtStrategy, ApiKeyGuard, RolesGuard, TypeOrmModule],
})
export class AuthModule {}
