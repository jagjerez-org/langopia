import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room, ChatMessage } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

  const messages = await ds.getRepository(ChatMessage).find({
    where: { roomId: id },
    order: { createdAt: "ASC" },
  });

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      senderName: m.senderName,
      senderRole: m.senderRole,
      message: m.message,
      createdAt: m.createdAt,
    }))
  );
}
