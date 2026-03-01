import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Session, ClassroomEnrollment } from "@/entities";
import { UserRole, SessionStatus } from "@langopia/shared/types";
import { createParticipantToken } from "@/lib/livekit";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
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

  if (sessionEntity.status !== SessionStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "Session is not in progress" }, { status: 409 });
  }

  const role = session.user.role as UserRole;
  const isTeacher = sessionEntity.classroom.teacherId === session.user.id;

  if (!isTeacher && role !== UserRole.ADMIN) {
    // Must be enrolled student
    const enrollment = await ds.getRepository(ClassroomEnrollment).findOne({
      where: { classroomId: sessionEntity.classroomId, studentId: session.user.id },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const token = await createParticipantToken(
    sessionEntity.livekitRoomId!,
    session.user.id,
    session.user.name,
    {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    }
  );

  return NextResponse.json({ token });
}
