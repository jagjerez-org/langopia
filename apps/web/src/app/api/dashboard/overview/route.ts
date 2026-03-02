import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { AcademyMember, Room, ClassReport, UsageRecord } from "@/entities";
import { UsageMetric } from "@langopia/shared/types";
import { getCurrentPeriod } from "@/lib/api-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const ds = await getDataSource();
  const period = getCurrentPeriod();

  // Count academies
  const totalAcademies = await ds.getRepository(AcademyMember).count({
    where: { userId },
  });

  // Get academy IDs for this user
  const memberships = await ds.getRepository(AcademyMember).find({
    where: { userId },
    select: ["academyId"],
  });
  const academyIds = memberships.map((m) => m.academyId);

  let totalRooms = 0;
  let totalReports = 0;
  let totalClassHours = 0;
  let totalTokens = 0;

  if (academyIds.length > 0) {
    // Count rooms across all academies
    totalRooms = await ds.getRepository(Room)
      .createQueryBuilder("room")
      .where("room.academyId IN (:...ids)", { ids: academyIds })
      .getCount();

    // Count reports
    totalReports = await ds.getRepository(ClassReport)
      .createQueryBuilder("report")
      .innerJoin("report.room", "room")
      .where("room.academyId IN (:...ids)", { ids: academyIds })
      .getCount();

    // Sum class minutes from usage records
    const minutesResult = await ds.getRepository(UsageRecord)
      .createQueryBuilder("u")
      .select("COALESCE(SUM(u.value), 0)", "total")
      .where("u.userId = :userId", { userId })
      .andWhere("u.metric = :metric", { metric: UsageMetric.CLASS_MINUTES })
      .getRawOne();
    totalClassHours = Math.round(Number(minutesResult?.total ?? 0) / 60);

    // Sum AI tokens from usage records
    const tokensResult = await ds.getRepository(UsageRecord)
      .createQueryBuilder("u")
      .select("COALESCE(SUM(u.value), 0)", "total")
      .where("u.userId = :userId", { userId })
      .andWhere("u.metric = :metric", { metric: UsageMetric.AI_TOKENS })
      .getRawOne();
    totalTokens = Number(tokensResult?.total ?? 0);
  }

  return NextResponse.json({
    totalAcademies,
    totalRooms,
    totalReports,
    totalClassHours,
    totalTokens,
  });
}
