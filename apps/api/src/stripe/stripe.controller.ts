import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { StripeService } from "./stripe.service.js";
import type { Request } from "express";

@ApiTags("Stripe")
@Controller("stripe")
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post("checkout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create Stripe checkout session" })
  async createCheckout(
    @CurrentUser() user: User,
    @Body() body: { plan: string },
  ) {
    return this.stripeService.createCheckoutSession(user.id, body.plan);
  }

  @Post("portal")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create Stripe billing portal session" })
  async createPortal(@CurrentUser() user: User) {
    return this.stripeService.createPortalSession(user.id);
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Stripe webhook handler" })
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("stripe-signature") signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from("");
    return this.stripeService.handleWebhook(rawBody, signature);
  }
}
