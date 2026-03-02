import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room, ClassReport } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({
    where: { id, academyId: academy.id },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const report = await ds.getRepository(ClassReport).findOne({
    where: { roomId: id },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not yet available" }, { status: 404 });
  }

  return NextResponse.json({
    id: report.id,
    roomId: report.roomId,
    status: report.status,
    summary: report.summary,
    classDuration: report.classDuration,
    tokensUsed: report.tokensUsed,
    teacher: report.teacher,
    students: report.studentReports,
    createdAt: report.createdAt,
  });
}
