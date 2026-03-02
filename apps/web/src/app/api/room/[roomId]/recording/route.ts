import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room } from "@/entities";
import { startRoomRecording, stopRecording } from "@/lib/recording";

type Params = { params: Promise<{ roomId: string }> };

// POST /api/room/:roomId/recording - Start recording
export async function POST(req: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({ where: { id: roomId } });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.egressId) {
    return NextResponse.json({ error: "Recording already active" }, { status: 400 });
  }

  if (!room.livekitRoomId) {
    return NextResponse.json({ error: "No LiveKit room" }, { status: 400 });
  }

  try {
    const egressId = await startRoomRecording(room.livekitRoomId, roomId);
    room.egressId = egressId;
    await ds.getRepository(Room).save(room);
    return NextResponse.json({ egressId });
  } catch (err) {
    console.error("Failed to start recording:", err);
    return NextResponse.json({ error: "Failed to start recording" }, { status: 500 });
  }
}

// DELETE /api/room/:roomId/recording - Stop recording
export async function DELETE(req: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({ where: { id: roomId } });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (!room.egressId) {
    return NextResponse.json({ error: "No active recording" }, { status: 400 });
  }

  try {
    const recordingUrl = await stopRecording(room.egressId);
    room.egressId = null;
    if (recordingUrl) room.recordingUrl = recordingUrl;
    await ds.getRepository(Room).save(room);
    return NextResponse.json({ recordingUrl });
  } catch (err) {
    console.error("Failed to stop recording:", err);
    return NextResponse.json({ error: "Failed to stop recording" }, { status: 500 });
  }
}
