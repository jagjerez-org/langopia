import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { RoomNotes } from "@/entities";

type Params = { params: Promise<{ roomId: string }> };

// PUT /api/room/:roomId/notes - Save/update room notes (from room participants)
export async function PUT(req: NextRequest, { params }: Params) {
  const { roomId } = await params;
  const body = await req.json();
  const { vocabulary, corrections, homework, objectives } = body;

  const ds = await getDataSource();
  let notes = await ds.getRepository(RoomNotes).findOne({
    where: { roomId },
  });

  if (!notes) {
    notes = new RoomNotes();
    notes.roomId = roomId;
  }

  if (vocabulary !== undefined) notes.vocabulary = vocabulary;
  if (corrections !== undefined) notes.corrections = corrections;
  if (homework !== undefined) notes.homework = homework;
  if (objectives !== undefined) notes.objectives = objectives;

  await ds.getRepository(RoomNotes).save(notes);
  return NextResponse.json({ ok: true });
}
