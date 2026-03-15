import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StudentSubscription, Student, AcademyPlan, Academy } from "../database/entities/index.js";
import { StudentSubscriptionsController, StudentSubscriptionsPublicController } from "./student-subscriptions.controller.js";
import { StudentSubscriptionsService } from "./student-subscriptions.service.js";
import { StripeClientModule } from "../stripe-client/stripe-client.module.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([StudentSubscription, Student, AcademyPlan, Academy]),
    StripeClientModule,
  ],
  controllers: [StudentSubscriptionsController, StudentSubscriptionsPublicController],
  providers: [StudentSubscriptionsService],
  exports: [StudentSubscriptionsService],
})
export class StudentSubscriptionsModule {}
