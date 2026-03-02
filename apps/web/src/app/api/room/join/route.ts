import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDataSource } from "@/lib/database";
import { Room, Student, RoomParticipant, Class } from "@/entities";
import { RoomStatus, ParticipantRole } from "@langopia/shared/types";
import { createParticipantToken } from "@/lib/livekit";
import { getRoomService } from "@/lib/livekit";

// POST /api/room/join - Join a room using token (from teacher/student URL)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, name, email } = body;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const ds = await getDataSource();

  // Find room by teacher or student token
  let room = await ds.getRepository(Room).findOne({
    where: [{ teacherToken: token }, { studentToken: token }],
  });

  let isTeacher: boolean;

  // If no Room found, try Class token lookup
  if (!room) {
    const cls = await ds.getRepository(Class).findOne({
      where: [{ teacherToken: token }, { studentToken: token }],
    });

    if (!cls) {
      return NextResponse.json({ error: "Invalid room token" }, { status: 404 });
    }

    if (cls.status === "completed" || cls.status === "cancelled") {
      return NextResponse.json({ error: "Class is no longer active" }, { status: 410 });
    }

    isTeacher = token === cls.teacherToken;

    // If Class has a Room already, use it
    if (cls.roomId) {
      room = await ds.getRepository(Room).findOne({ where: { id: cls.roomId } });
    }

    // If no Room exists yet, create one on-demand
    if (!room) {
      const livekitRoomId = `room-${crypto.randomBytes(8).toString("hex")}`;

      try {
        const roomService = getRoomService();
        await roomService.createRoom({
          name: livekitRoomId,
          emptyTimeout: 600,
          maxParticipants: (cls.maxStudents ?? 1) + 1,
        });
      } catch (err) {
        console.error("Failed to create LiveKit room for class:", err);
        return NextResponse.json({ error: "Failed to create video room" }, { status: 500 });
      }

      const newRoom = new Room();
      newRoom.academyId = cls.academyId;
      newRoom.createdByUserId = cls.createdByUserId;
      newRoom.title = cls.title;
      newRoom.language = cls.language;
      newRoom.maxStudents = cls.maxStudents;
      newRoom.teacherToken = cls.teacherToken;
      newRoom.studentToken = cls.studentToken;
      newRoom.livekitRoomId = livekitRoomId;
      newRoom.scheduledAt = cls.scheduledAt;
      newRoom.lessonId = cls.lessonId;
      newRoom.status = RoomStatus.WAITING;

      room = await ds.getRepository(Room).save(newRoom);

      // Link Room to Class and update Class status
      cls.roomId = room.id;
      cls.status = "in_progress";
      await ds.getRepository(Class).save(cls);
    }
  } else {
    isTeacher = token === room.teacherToken;
  }

  if (room.status === RoomStatus.COMPLETED || room.status === RoomStatus.CANCELLED) {
    return NextResponse.json({ error: "Room is no longer active" }, { status: 410 });
  }

  const role = isTeacher ? ParticipantRole.TEACHER : ParticipantRole.STUDENT;

  // Students must provide name and email
  if (!isTeacher && (!name || !email)) {
    return NextResponse.json(
      { error: "name and email are required for students" },
      { status: 400 }
    );
  }

  // For students, check maxStudents limit
  if (!isTeacher) {
    const currentStudents = await ds.getRepository(RoomParticipant).count({
      where: { roomId: room.id, role: ParticipantRole.STUDENT, leftAt: undefined },
    });
    if (currentStudents >= room.maxStudents) {
      return NextResponse.json({ error: "Room is full" }, { status: 403 });
    }
  }

  // Find or create student record
  let studentId: string | null = null;
  if (!isTeacher && email) {
    let student = await ds.getRepository(Student).findOne({
      where: { academyId: room.academyId, email },
    });

    if (!student) {
      student = new Student();
      student.academyId = room.academyId;
      student.email = email;
      student.name = name;
      student = await ds.getRepository(Student).save(student);
    } else if (student.name !== name) {
      student.name = name;
      await ds.getRepository(Student).save(student);
    }

    studentId = student.id;
  }

  // Create participant record
  const participant = new RoomParticipant();
  participant.roomId = room.id;
  participant.name = isTeacher ? (name || "Teacher") : name;
  participant.role = role;
  participant.studentId = studentId;
  await ds.getRepository(RoomParticipant).save(participant);

  // If teacher joins and room is waiting, activate it
  if (isTeacher && room.status === RoomStatus.WAITING) {
    room.status = RoomStatus.ACTIVE;
    room.startedAt = new Date();
    await ds.getRepository(Room).save(room);
  }

  // Generate LiveKit token for participant
  const identity = isTeacher ? `teacher-${room.id}` : `student-${studentId}`;
  const livekitToken = await createParticipantToken(
    room.livekitRoomId!,
    identity,
    isTeacher ? (name || "Teacher") : name,
    {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    }
  );

  return NextResponse.json({
    roomId: room.id,
    title: room.title,
    language: room.language,
    role,
    participantId: participant.id,
    livekitToken,
    livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    slides: room.slides,
    status: room.status,
  });
}
