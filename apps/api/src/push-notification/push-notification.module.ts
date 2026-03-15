import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../database/entities/user.entity.js";
import { Notification } from "../database/entities/notification.entity.js";
import { PushNotificationService } from "./push-notification.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([User, Notification])],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
