import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Session, Transcription, ClassroomEnrollment } from "@/entities";
import { UserRole, Speaker } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const sessionEntity = await ds.getRepository(Session).findOne({
    where: { id },
    relations: ["classroom"],
  });

  if (!sessionEntity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auth: must be the classroom teacher, enrolled student, or admin
  const role = session.user.role as UserRole;
  const isTeacher = sessionEntity.classroom.teacherId === session.user.id;

  if (!isTeacher && role !== UserRole.ADMIN) {
    const enrollment = await ds.getRepository(ClassroomEnrollment).findOne({
      where: { classroomId: sessionEntity.classroomId, studentId: session.user.id },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Optional speaker filter
  const speakerParam = req.nextUrl.searchParams.get("speaker");
  const where: Record<string, unknown> = { sessionId: id };
  if (speakerParam === "teacher") {
    where.speaker = Speaker.TEACHER;
  } else if (speakerParam === "student") {
    where.speaker = Speaker.STUDENT;
  }

  const transcriptions = await ds.getRepository(Transcription).find({
    where,
    order: { timestampStart: "ASC" },
  });

  return NextResponse.json(transcriptions);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const sessionEntity = await ds.getRepository(Session).findOne({
    where: { id },
    relations: ["classroom"],
  });

  if (!sessionEntity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && sessionEntity.classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { speaker, text, timestampStart, timestampEnd, wordTimestamps, languageDetected } = body;

  if (!speaker || !text || timestampStart == null || timestampEnd == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const transcription = new Transcription();
  transcription.academyId = sessionEntity.academyId;
  transcription.sessionId = id;
  transcription.speaker = speaker;
  transcription.text = text;
  transcription.timestampStart = timestampStart;
  transcription.timestampEnd = timestampEnd;
  transcription.wordTimestamps = wordTimestamps ?? [];
  transcription.languageDetected = languageDetected ?? null;

  const saved = await ds.getRepository(Transcription).save(transcription);

  return NextResponse.json(saved, { status: 201 });
}
