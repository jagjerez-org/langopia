import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Lesson } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { LessonStatus } from "@langopia/shared/types";

// GET /api/v1/lessons - List lessons for the academy
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");
  const language = req.nextUrl.searchParams.get("language");
  const cefrLevel = req.nextUrl.searchParams.get("cefrLevel");
  const status = req.nextUrl.searchParams.get("status") as LessonStatus | null;

  const qb = ds.getRepository(Lesson)
    .createQueryBuilder("lesson")
    .loadRelationCountAndMap("lesson.exerciseCount", "lesson.lessonExercises")
    .where("lesson.academyId = :academyId", { academyId: academy.id })
    .orderBy("lesson.createdAt", "DESC")
    .take(limit)
    .skip(offset);

  if (language) qb.andWhere("lesson.language = :language", { language });
  if (cefrLevel) qb.andWhere("lesson.cefrLevel = :cefrLevel", { cefrLevel });
  if (status) qb.andWhere("lesson.status = :status", { status });

  const [lessons, total] = await qb.getManyAndCount();

  return NextResponse.json({
    data: lessons.map((l: Lesson & { exerciseCount?: number }) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      language: l.language,
      cefrLevel: l.cefrLevel,
      status: l.status,
      exerciseCount: l.exerciseCount ?? 0,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    total,
    limit,
    offset,
  });
}

// POST /api/v1/lessons - Create a new lesson
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const body = await req.json();
  const { title, language, cefrLevel, description } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!cefrLevel) {
    return NextResponse.json({ error: "cefrLevel is required" }, { status: 400 });
  }

  const lesson = new Lesson();
  lesson.academyId = academy.id;
  lesson.title = title;
  lesson.language = language || "en";
  lesson.cefrLevel = cefrLevel;
  lesson.description = description ?? null;
  lesson.status = LessonStatus.DRAFT;

  const saved = await ds.getRepository(Lesson).save(lesson);

  return NextResponse.json(
    {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      language: saved.language,
      cefrLevel: saved.cefrLevel,
      status: saved.status,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    },
    { status: 201 }
  );
}
