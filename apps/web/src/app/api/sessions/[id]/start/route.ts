import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Session } from "@/entities";
import { UserRole, SessionStatus } from "@langopia/shared/types";
import { getRoomService } from "@/lib/livekit";
import { startRecording } from "@/lib/recording";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
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
  const sessionRepo = ds.getRepository(Session);
  const sessionEntity = await sessionRepo.findOne({
    where: { id },
    relations: ["classroom"],
  });

  if (!sessionEntity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && sessionEntity.classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (sessionEntity.status === SessionStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "Session already started" }, { status: 409 });
  }

  if (sessionEntity.status === SessionStatus.COMPLETED || sessionEntity.status === SessionStatus.CANCELLED) {
    return NextResponse.json({ error: "Session is already ended" }, { status: 409 });
  }

  const roomName = `session-${id}`;

  try {
    await getRoomService().createRoom({ name: roomName, emptyTimeout: 600 });
  } catch {
    // Room may already exist, continue
  }

  // Start recording via LiveKit Egress
  let egressId: string | null = null;
  try {
    egressId = await startRecording(roomName);
  } catch (err) {
    console.error("Failed to start recording:", err);
  }

  sessionEntity.livekitRoomId = roomName;
  sessionEntity.status = SessionStatus.IN_PROGRESS;
  sessionEntity.startedAt = new Date();
  sessionEntity.egressId = egressId;
  await sessionRepo.save(sessionEntity);

  return NextResponse.json(sessionEntity);
}
