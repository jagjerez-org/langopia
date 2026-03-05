import { Module } from "@nestjs/common";
import { StripeClientService } from "./stripe-client.service.js";

@Module({
  providers: [StripeClientService],
  exports: [StripeClientService],
})
export class StripeClientModule {}
