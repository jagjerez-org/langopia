import { IsOptional, IsBoolean } from "class-validator";

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}
