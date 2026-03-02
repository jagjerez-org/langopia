import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { UsageRecord, User } from "@/entities";
import { authenticateApiKey, getCurrentPeriod } from "@/lib/api-auth";
import { UsageMetric, PLAN_LIMITS, UserPlan } from "@langopia/shared/types";

// GET /api/v1/usage - Get usage stats for the academy owner
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;
  const ds = await getDataSource();

  const period = req.nextUrl.searchParams.get("period") ?? getCurrentPeriod();

  // Get all usage records for this user in the given period
  const records = await ds.getRepository(UsageRecord).find({
    where: { userId: ownerId, academyId: academy.id, period },
  });

  const usage: Record<string, number> = {};
  for (const metric of Object.values(UsageMetric)) {
    const record = records.find((r) => r.metric === metric);
    usage[metric] = Number(record?.value ?? 0);
  }

  // Get user plan for limits
  const user = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  const plan = user?.plan ?? UserPlan.FREE;
  const limits = PLAN_LIMITS[plan];

  return NextResponse.json({
    period,
    plan,
    usage,
    limits: {
      maxRoomsPerMonth: limits.maxRoomsPerMonth,
      maxClassHoursPerMonth: limits.maxClassHoursPerMonth,
      maxReportsPerMonth: limits.maxReportsPerMonth,
      maxStudentsPerRoom: limits.maxStudentsPerRoom,
      maxStorageBytes: limits.maxStorageBytes,
      maxAiTokensPerMonth: limits.maxAiTokensPerMonth,
    },
  });
}
