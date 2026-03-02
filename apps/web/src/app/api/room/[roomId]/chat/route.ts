import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { ChatMessage } from "@/entities";
import { ParticipantRole } from "@langopia/shared/types";

type Params = { params: Promise<{ roomId: string }> };

// POST /api/room/:roomId/chat - Save a chat message (from room participants)
export async function POST(req: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const body = await req.json();
  const { senderName, senderRole, message } = body;

  if (!senderName || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ds = await getDataSource();
  const msg = new ChatMessage();
  msg.roomId = roomId;
  msg.senderName = senderName;
  msg.senderRole = senderRole === "student" ? ParticipantRole.STUDENT : ParticipantRole.TEACHER;
  msg.message = message;

  const saved = await ds.getRepository(ChatMessage).save(msg);
  return NextResponse.json({ id: saved.id }, { status: 201 });
}
