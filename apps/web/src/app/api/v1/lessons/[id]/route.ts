import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Lesson, LessonExercise } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { LessonStatus } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/lessons/:id - Get lesson details
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const exerciseCount = await ds.getRepository(LessonExercise).count({
    where: { lessonId: id },
  });

  return NextResponse.json({
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    language: lesson.language,
    cefrLevel: lesson.cefrLevel,
    status: lesson.status,
    exerciseCount,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  });
}

// PATCH /api/v1/lessons/:id - Update lesson
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.title !== undefined) lesson.title = body.title;
  if (body.description !== undefined) lesson.description = body.description;
  if (body.status !== undefined) {
    if (!Object.values(LessonStatus).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    lesson.status = body.status;
  }

  const saved = await ds.getRepository(Lesson).save(lesson);

  return NextResponse.json({
    id: saved.id,
    title: saved.title,
    description: saved.description,
    language: saved.language,
    cefrLevel: saved.cefrLevel,
    status: saved.status,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  });
}

// DELETE /api/v1/lessons/:id - Delete lesson (unlinks exercises, doesn't delete them)
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // LessonExercise has CASCADE on delete, so links are removed automatically
  await ds.getRepository(Lesson).remove(lesson);

  return new NextResponse(null, { status: 204 });
}
