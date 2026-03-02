import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room, RoomNotes } from "@/entities";
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

  const notes = await ds.getRepository(RoomNotes).findOne({
    where: { roomId: id },
  });

  if (!notes) {
    return NextResponse.json({
      vocabulary: [],
      corrections: [],
      homework: "",
      objectives: "",
    });
  }

  return NextResponse.json({
    vocabulary: notes.vocabulary,
    corrections: notes.corrections,
    homework: notes.homework,
    objectives: notes.objectives,
    updatedAt: notes.updatedAt,
  });
}
