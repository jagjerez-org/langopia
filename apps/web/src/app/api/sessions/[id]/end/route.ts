import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Session } from "@/entities";
import { UserRole, SessionStatus } from "@langopia/shared/types";
import { getRoomService } from "@/lib/livekit";
import { stopRecording } from "@/lib/recording";
import { runBatchTranscription } from "@/lib/batch-transcription";

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

  if (sessionEntity.status !== SessionStatus.IN_PROGRESS) {
    return NextResponse.json({ error: "Session is not in progress" }, { status: 409 });
  }

  // Stop recording and get the recording URL
  let recordingUrl: string | null = null;
  if (sessionEntity.egressId && sessionEntity.livekitRoomId) {
    try {
      recordingUrl = await stopRecording(
        sessionEntity.egressId,
        sessionEntity.livekitRoomId
      );
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
  }

  // Destroy the LiveKit room
  if (sessionEntity.livekitRoomId) {
    try {
      await getRoomService().deleteRoom(sessionEntity.livekitRoomId);
    } catch {
      // Room may already be gone
    }
  }

  sessionEntity.status = SessionStatus.COMPLETED;
  sessionEntity.endedAt = new Date();
  sessionEntity.recordingUrl = recordingUrl;
  await sessionRepo.save(sessionEntity);

  // Fire-and-forget batch transcription
  if (recordingUrl) {
    runBatchTranscription(sessionEntity.id).catch((err) =>
      console.error("Batch transcription failed:", err)
    );
  }

  return NextResponse.json(sessionEntity);
}
