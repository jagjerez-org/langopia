import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { LearningPath, LearningPathLesson, Lesson } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/learning-paths/:id/lessons - List lessons in this learning path
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lp = await ds.getRepository(LearningPath).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lp) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }

  const links = await ds.getRepository(LearningPathLesson)
    .createQueryBuilder("lpl")
    .leftJoinAndSelect("lpl.lesson", "lesson")
    .loadRelationCountAndMap("lesson.exerciseCount", "lesson.lessonExercises")
    .where("lpl.learningPathId = :lpId", { lpId: id })
    .orderBy("lpl.sortOrder", "ASC")
    .getMany();

  return NextResponse.json({
    data: links.map((lpl) => ({
      id: lpl.lesson.id,
      title: lpl.lesson.title,
      description: lpl.lesson.description,
      language: lpl.lesson.language,
      cefrLevel: lpl.lesson.cefrLevel,
      status: lpl.lesson.status,
      exerciseCount: (lpl.lesson as unknown as { exerciseCount?: number }).exerciseCount ?? 0,
      sortOrder: lpl.sortOrder,
    })),
  });
}

// POST /api/v1/learning-paths/:id/lessons - Add lesson(s) to learning path
export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lp = await ds.getRepository(LearningPath).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lp) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }

  const body = await req.json();
  const lessonIds: string[] = body.lessonIds ?? (body.lessonId ? [body.lessonId] : []);

  if (lessonIds.length === 0) {
    return NextResponse.json({ error: "lessonId or lessonIds is required" }, { status: 400 });
  }

  // Validate all lessons belong to the same academy
  const lessons = await ds.getRepository(Lesson).find({
    where: lessonIds.map((lid) => ({ id: lid, academyId: academy.id })),
  });
  const validIds = new Set(lessons.map((l) => l.id));
  const invalid = lessonIds.filter((lid) => !validIds.has(lid));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Lessons not found: ${invalid.join(", ")}` }, { status: 400 });
  }

  // Get current max sortOrder
  const maxSort = await ds.getRepository(LearningPathLesson)
    .createQueryBuilder("lpl")
    .select("COALESCE(MAX(lpl.sortOrder), -1)", "maxSort")
    .where("lpl.learningPathId = :lpId", { lpId: id })
    .getRawOne();
  let nextSort = (maxSort?.maxSort ?? -1) + 1;

  const created: LearningPathLesson[] = [];
  for (const lessonId of lessonIds) {
    // Skip duplicates
    const existing = await ds.getRepository(LearningPathLesson).findOne({
      where: { learningPathId: id, lessonId },
    });
    if (existing) continue;

    const link = new LearningPathLesson();
    link.learningPathId = id;
    link.lessonId = lessonId;
    link.sortOrder = nextSort++;
    const saved = await ds.getRepository(LearningPathLesson).save(link);
    created.push(saved);
  }

  return NextResponse.json(
    { added: created.length },
    { status: 201 }
  );
}

// PATCH /api/v1/learning-paths/:id/lessons - Reorder lessons
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lp = await ds.getRepository(LearningPath).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lp) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }

  const body = await req.json();
  const { lessonIds } = body as { lessonIds: string[] };

  if (!Array.isArray(lessonIds)) {
    return NextResponse.json({ error: "lessonIds array is required" }, { status: 400 });
  }

  // Fetch all links for this path
  const links = await ds.getRepository(LearningPathLesson).find({
    where: { learningPathId: id },
  });
  const linkMap = new Map(links.map((l) => [l.lessonId, l]));

  // Update sort orders
  for (let i = 0; i < lessonIds.length; i++) {
    const link = linkMap.get(lessonIds[i]);
    if (link) {
      link.sortOrder = i;
      await ds.getRepository(LearningPathLesson).save(link);
    }
  }

  return NextResponse.json({ reordered: true });
}

// DELETE /api/v1/learning-paths/:id/lessons - Remove lesson from learning path
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lp = await ds.getRepository(LearningPath).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lp) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }

  const lessonId = req.nextUrl.searchParams.get("lessonId");
  if (!lessonId) {
    return NextResponse.json({ error: "lessonId query param is required" }, { status: 400 });
  }

  const link = await ds.getRepository(LearningPathLesson).findOne({
    where: { learningPathId: id, lessonId },
  });

  if (!link) {
    return NextResponse.json({ error: "Lesson not linked to this learning path" }, { status: 404 });
  }

  await ds.getRepository(LearningPathLesson).remove(link);

  return new NextResponse(null, { status: 204 });
}
