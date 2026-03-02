import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room } from "@/entities";
import { RoomStatus } from "@langopia/shared/types";
import { authenticateApiKey } from "@/lib/api-auth";
import { getRoomService } from "@/lib/livekit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/rooms/:id - Get room details
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({
    where: { id, academyId: academy.id },
    relations: ["participants", "participants.student"],
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: room.id,
    title: room.title,
    language: room.language,
    maxStudents: room.maxStudents,
    teacherUrl: `${APP_URL}/room/${room.id}?token=${room.teacherToken}`,
    studentUrl: `${APP_URL}/room/${room.id}?token=${room.studentToken}`,
    status: room.status,
    slides: room.slides,
    scheduledAt: room.scheduledAt,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    recordingUrl: room.recordingUrl,
    participants: room.participants?.map((p) => ({
      name: p.name,
      role: p.role,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      speakingTimeSeconds: p.speakingTimeSeconds,
      studentEmail: p.student?.email ?? null,
    })) ?? [],
    createdAt: room.createdAt,
  });
}

// DELETE /api/v1/rooms/:id - Close/cancel room
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({
    where: { id, academyId: academy.id },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status === RoomStatus.COMPLETED || room.status === RoomStatus.CANCELLED) {
    return NextResponse.json({ error: "Room is already closed" }, { status: 400 });
  }

  // Close the LiveKit room
  if (room.livekitRoomId) {
    try {
      const roomService = getRoomService();
      await roomService.deleteRoom(room.livekitRoomId);
    } catch {
      // Room may already be gone
    }
  }

  room.status = room.status === RoomStatus.ACTIVE ? RoomStatus.COMPLETED : RoomStatus.CANCELLED;
  room.endedAt = new Date();
  await ds.getRepository(Room).save(room);

  return NextResponse.json({ id: room.id, status: room.status });
}
