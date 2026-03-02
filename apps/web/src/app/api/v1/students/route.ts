import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Student } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/students - List students for the academy
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");
  const search = req.nextUrl.searchParams.get("search");

  const qb = ds.getRepository(Student)
    .createQueryBuilder("student")
    .where("student.academyId = :academyId", { academyId: academy.id })
    .orderBy("student.lastSeenAt", "DESC")
    .take(limit)
    .skip(offset);

  if (search) {
    qb.andWhere("(student.name ILIKE :search OR student.email ILIKE :search)", {
      search: `%${search}%`,
    });
  }

  const [students, total] = await qb.getManyAndCount();

  return NextResponse.json({
    data: students.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      totalRooms: s.totalRooms,
      totalMinutes: s.totalMinutes,
      cefrEstimate: s.cefrEstimate,
      firstSeenAt: s.firstSeenAt,
      lastSeenAt: s.lastSeenAt,
    })),
    total,
    limit,
    offset,
  });
}
