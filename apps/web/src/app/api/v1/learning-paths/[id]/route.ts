import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { LearningPath, LearningPathLesson } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { LearningPathStatus } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/learning-paths/:id - Get learning path detail
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

  // Fetch lessons with exercise counts
  const links = await ds.getRepository(LearningPathLesson)
    .createQueryBuilder("lpl")
    .leftJoinAndSelect("lpl.lesson", "lesson")
    .loadRelationCountAndMap("lesson.exerciseCount", "lesson.lessonExercises")
    .where("lpl.learningPathId = :lpId", { lpId: id })
    .orderBy("lpl.sortOrder", "ASC")
    .getMany();

  return NextResponse.json({
    id: lp.id,
    title: lp.title,
    description: lp.description,
    language: lp.language,
    cefrLevel: lp.cefrLevel,
    status: lp.status,
    thumbnailUrl: lp.thumbnailUrl,
    estimatedHours: lp.estimatedHours,
    createdAt: lp.createdAt,
    updatedAt: lp.updatedAt,
    lessons: links.map((lpl) => ({
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

// PATCH /api/v1/learning-paths/:id - Update learning path
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

  if (body.title !== undefined) lp.title = body.title;
  if (body.description !== undefined) lp.description = body.description;
  if (body.language !== undefined) lp.language = body.language;
  if (body.cefrLevel !== undefined) lp.cefrLevel = body.cefrLevel;
  if (body.thumbnailUrl !== undefined) lp.thumbnailUrl = body.thumbnailUrl;
  if (body.estimatedHours !== undefined) lp.estimatedHours = body.estimatedHours;
  if (body.status !== undefined) {
    if (!Object.values(LearningPathStatus).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    lp.status = body.status;
  }

  const saved = await ds.getRepository(LearningPath).save(lp);

  return NextResponse.json({
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
  });
}

// DELETE /api/v1/learning-paths/:id - Delete learning path
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

  // LearningPathLesson records cascade-delete; lessons themselves are preserved
  await ds.getRepository(LearningPath).remove(lp);

  return new NextResponse(null, { status: 204 });
}
