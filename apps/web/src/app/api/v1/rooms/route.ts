import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDataSource } from "@/lib/database";
import { Room, AcademyMember, User } from "@/entities";
import { RoomStatus, UsageMetric } from "@langopia/shared/types";
import { authenticateApiKey, incrementUsage, checkPlanLimit } from "@/lib/api-auth";
import { getRoomService } from "@/lib/livekit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/v1/rooms - Create a new room
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;
  const ds = await getDataSource();

  // Check plan limits
  const owner = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 500 });
  }

  const limitCheck = await checkPlanLimit(ownerId, owner.plan, UsageMetric.ROOMS_CREATED);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Room limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { title, language, maxStudents, slides, scheduledAt } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Generate unique tokens for URLs
  const teacherToken = "t_" + crypto.randomBytes(24).toString("hex");
  const studentToken = "s_" + crypto.randomBytes(24).toString("hex");
  const livekitRoomId = `room-${crypto.randomBytes(8).toString("hex")}`;

  // Create LiveKit room
  try {
    const roomService = getRoomService();
    await roomService.createRoom({
      name: livekitRoomId,
      emptyTimeout: 600, // 10 minutes
      maxParticipants: (maxStudents ?? 1) + 1, // +1 for teacher
    });
  } catch (err) {
    console.error("Failed to create LiveKit room:", err);
    return NextResponse.json({ error: "Failed to create video room" }, { status: 500 });
  }

  // Find the user who made the request (owner of the academy by default)
  const room = new Room();
  room.academyId = academy.id;
  room.createdByUserId = ownerId;
  room.title = title;
  room.language = language ?? "en";
  room.maxStudents = maxStudents ?? 1;
  room.teacherToken = teacherToken;
  room.studentToken = studentToken;
  room.slides = slides ?? [];
  room.livekitRoomId = livekitRoomId;
  room.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

  const saved = await ds.getRepository(Room).save(room);

  // Track usage
  await incrementUsage(ownerId, academy.id, UsageMetric.ROOMS_CREATED);

  return NextResponse.json(
    {
      id: saved.id,
      title: saved.title,
      language: saved.language,
      maxStudents: saved.maxStudents,
      teacherUrl: `${APP_URL}/room/${saved.id}?token=${teacherToken}`,
      studentUrl: `${APP_URL}/room/${saved.id}?token=${studentToken}`,
      status: saved.status,
      slides: saved.slides,
      scheduledAt: saved.scheduledAt,
      createdAt: saved.createdAt,
    },
    { status: 201 }
  );
}

// GET /api/v1/rooms - List rooms
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

  const qb = ds.getRepository(Room)
    .createQueryBuilder("room")
    .where("room.academyId = :academyId", { academyId: academy.id })
    .orderBy("room.createdAt", "DESC")
    .take(limit)
    .skip(offset);

  if (status) {
    qb.andWhere("room.status = :status", { status });
  }

  const [rooms, total] = await qb.getManyAndCount();

  return NextResponse.json({
    data: rooms.map((r) => ({
      id: r.id,
      title: r.title,
      language: r.language,
      maxStudents: r.maxStudents,
      teacherUrl: `${APP_URL}/room/${r.id}?token=${r.teacherToken}`,
      studentUrl: `${APP_URL}/room/${r.id}?token=${r.studentToken}`,
      status: r.status,
      slides: r.slides,
      scheduledAt: r.scheduledAt,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      createdAt: r.createdAt,
    })),
    total,
    limit,
    offset,
  });
}
