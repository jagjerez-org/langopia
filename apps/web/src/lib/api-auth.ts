import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Academy, AcademyMember, UsageRecord } from "@/entities";
import { UsageMetric, PLAN_LIMITS, UserPlan } from "@langopia/shared/types";

/**
 * Authenticates an API request using the Academy API key.
 * Returns the academy if valid, or a NextResponse error.
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<{ academy: Academy; ownerId: string } | NextResponse> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);

  const ds = await getDataSource();
  const academy = await ds.getRepository(Academy).findOne({
    where: { apiKey },
  });

  if (!academy) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    );
  }

  // Find the owner of this academy for plan limit checks
  const ownerMember = await ds.getRepository(AcademyMember)
    .createQueryBuilder("m")
    .leftJoinAndSelect("m.user", "user")
    .where("m.academyId = :academyId", { academyId: academy.id })
    .andWhere("m.roles @> :roles", { roles: JSON.stringify(["owner"]) })
    .getOne();

  if (!ownerMember) {
    return NextResponse.json(
      { error: "Academy has no owner" },
      { status: 500 }
    );
  }

  return { academy, ownerId: ownerMember.userId };
}

/**
 * Get current period string (YYYY-MM)
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Increment a usage metric for a user+academy in the current period.
 */
export async function incrementUsage(
  userId: string,
  academyId: string,
  metric: UsageMetric,
  amount = 1
): Promise<void> {
  const ds = await getDataSource();
  const period = getCurrentPeriod();

  // Upsert: increment if exists, create if not
  await ds.getRepository(UsageRecord)
    .createQueryBuilder()
    .insert()
    .values({
      userId,
      academyId,
      period,
      metric,
      value: amount,
    })
    .orUpdate(["value"], ["userId", "academyId", "period", "metric"])
    .setParameter("value", amount)
    .execute()
    .catch(async () => {
      // Fallback: find and update
      const existing = await ds.getRepository(UsageRecord).findOne({
        where: { userId, academyId, period, metric },
      });
      if (existing) {
        existing.value = Number(existing.value) + amount;
        await ds.getRepository(UsageRecord).save(existing);
      } else {
        const record = new UsageRecord();
        record.userId = userId;
        record.academyId = academyId;
        record.period = period;
        record.metric = metric;
        record.value = amount;
        await ds.getRepository(UsageRecord).save(record);
      }
    });
}

/**
 * Check if a user has exceeded a plan limit for a given metric.
 */
export async function checkPlanLimit(
  userId: string,
  plan: UserPlan,
  metric: UsageMetric
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const ds = await getDataSource();
  const period = getCurrentPeriod();

  // Sum all usage across all academies for this user
  const result = await ds.getRepository(UsageRecord)
    .createQueryBuilder("u")
    .select("COALESCE(SUM(u.value), 0)", "total")
    .where("u.userId = :userId", { userId })
    .andWhere("u.period = :period", { period })
    .andWhere("u.metric = :metric", { metric })
    .getRawOne();

  const current = Number(result?.total ?? 0);
  const limits = PLAN_LIMITS[plan];

  let limit = 0;
  switch (metric) {
    case UsageMetric.ROOMS_CREATED:
      limit = limits.maxClassesPerMonth;
      break;
    case UsageMetric.CLASS_MINUTES:
      limit = limits.maxClassHoursPerMonth * 60;
      break;
    case UsageMetric.AI_REPORTS:
      limit = limits.maxReportsPerMonth;
      break;
    case UsageMetric.AI_TOKENS:
      limit = limits.maxAiTokensPerMonth;
      break;
    case UsageMetric.TTS_CHARACTERS:
      limit = limits.maxTtsCharactersPerMonth;
      break;
    case UsageMetric.STORAGE_BYTES:
      limit = limits.maxStorageBytes;
      break;
    default:
      limit = 999999;
  }

  return { allowed: current < limit, current, limit };
}
