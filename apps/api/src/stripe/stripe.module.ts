import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { StripeClientModule } from "../stripe-client/stripe-client.module.js";
import { StripeController } from "./stripe.controller.js";
import { StripeService } from "./stripe.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
    StripeClientModule,
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
