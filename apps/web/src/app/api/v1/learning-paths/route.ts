import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { LearningPath } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { LearningPathStatus } from "@langopia/shared/types";

// GET /api/v1/learning-paths - List learning paths for academy
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");
  const language = req.nextUrl.searchParams.get("language");
  const cefrLevel = req.nextUrl.searchParams.get("cefrLevel");
  const status = req.nextUrl.searchParams.get("status") as LearningPathStatus | null;

  const qb = ds.getRepository(LearningPath)
    .createQueryBuilder("lp")
    .loadRelationCountAndMap("lp.lessonCount", "lp.learningPathLessons")
    .where("lp.academyId = :academyId", { academyId: academy.id })
    .orderBy("lp.createdAt", "DESC")
    .take(limit)
    .skip(offset);

  if (language) qb.andWhere("lp.language = :language", { language });
  if (cefrLevel) qb.andWhere("lp.cefrLevel = :cefrLevel", { cefrLevel });
  if (status) qb.andWhere("lp.status = :status", { status });

  const [paths, total] = await qb.getManyAndCount();

  return NextResponse.json({
    data: paths.map((lp: LearningPath & { lessonCount?: number }) => ({
      id: lp.id,
      title: lp.title,
      description: lp.description,
      language: lp.language,
      cefrLevel: lp.cefrLevel,
      status: lp.status,
      thumbnailUrl: lp.thumbnailUrl,
      estimatedHours: lp.estimatedHours,
      lessonCount: lp.lessonCount ?? 0,
      createdAt: lp.createdAt,
      updatedAt: lp.updatedAt,
    })),
    total,
    limit,
    offset,
  });
}

// POST /api/v1/learning-paths - Create a new learning path
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const body = await req.json();
  const { title, language, cefrLevel, description, thumbnailUrl, estimatedHours } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!cefrLevel) {
    return NextResponse.json({ error: "cefrLevel is required" }, { status: 400 });
  }

  const lp = new LearningPath();
  lp.academyId = academy.id;
  lp.title = title;
  lp.language = language || "en";
  lp.cefrLevel = cefrLevel;
  lp.description = description ?? null;
  lp.thumbnailUrl = thumbnailUrl ?? null;
  lp.estimatedHours = estimatedHours ?? null;
  lp.status = LearningPathStatus.DRAFT;

  const saved = await ds.getRepository(LearningPath).save(lp);

  return NextResponse.json(
    {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      language: saved.language,
      cefrLevel: saved.cefrLevel,
      status: saved.status,
      thumbnailUrl: saved.thumbnailUrl,
      estimatedHours: saved.estimatedHours,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    },
    { status: 201 }
  );
}
