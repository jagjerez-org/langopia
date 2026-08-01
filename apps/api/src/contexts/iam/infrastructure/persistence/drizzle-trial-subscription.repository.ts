import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { TrialSubscriptionPort } from "../../domain/ports/trial-subscription.port.js";

/**
 * `plans` es de lectura libre para cualquiera (`plans_readable USING (true)`,
 * ver `packages/db/src/policies.sql`): no hace falta tenant ni función
 * `SECURITY DEFINER` para preguntarle su id a un código de plan.
 */
@Injectable()
export class DrizzleTrialSubscriptionRepository implements TrialSubscriptionPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async start(props: {
    id: string;
    schoolId: string;
    planCode: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<void> {
    const [plan] = await this.drizzle.db
      .select({ id: schema.plans.id })
      .from(schema.plans)
      .where(eq(schema.plans.code, props.planCode))
      .limit(1);
    if (!plan) throw new NotFoundError("Plan", props.planCode);

    await this.drizzle.db.insert(schema.subscriptions).values({
      id: props.id,
      schoolId: props.schoolId,
      planId: plan.id,
      status: "active",
      currentPeriodStart: props.startsAt,
      currentPeriodEnd: props.endsAt,
    });
  }
}
