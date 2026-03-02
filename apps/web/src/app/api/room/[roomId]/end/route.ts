import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room } from "@/entities";
import { RoomStatus } from "@langopia/shared/types";
import { getRoomService } from "@/lib/livekit";
import { stopRecording } from "@/lib/recording";
import { runPostClassPipeline } from "@/lib/post-class-pipeline";

type Params = { params: Promise<{ roomId: string }> };

// POST /api/room/:roomId/end - End a room session (teacher action)
export async function POST(req: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({
    where: { id: roomId },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (
    room.status === RoomStatus.COMPLETED ||
    room.status === RoomStatus.CANCELLED
  ) {
    return NextResponse.json(
      { error: "Room is already closed" },
      { status: 400 }
    );
  }

  // Stop recording if active
  if (room.egressId) {
    try {
      const recordingUrl = await stopRecording(room.egressId);
      if (recordingUrl) {
        room.recordingUrl = recordingUrl;
      }
    } catch (err) {
      console.error("Failed to stop recording:", err);
    }
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

  room.status = RoomStatus.COMPLETED;
  room.endedAt = new Date();
  await ds.getRepository(Room).save(room);

  // Fire-and-forget: run post-class pipeline
  runPostClassPipeline(roomId).catch((err) =>
    console.error("[Pipeline] Background error:", err)
  );

  return NextResponse.json({ id: room.id, status: room.status });
}
