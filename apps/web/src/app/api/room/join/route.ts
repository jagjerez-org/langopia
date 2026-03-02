import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Room, Student, RoomParticipant } from "@/entities";
import { RoomStatus, ParticipantRole } from "@langopia/shared/types";
import { createParticipantToken } from "@/lib/livekit";

// POST /api/room/join - Join a room using token (from teacher/student URL)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, name, email } = body;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const ds = await getDataSource();

  // Find room by teacher or student token
  const room = await ds.getRepository(Room).findOne({
    where: [{ teacherToken: token }, { studentToken: token }],
  });

  if (!room) {
    return NextResponse.json({ error: "Invalid room token" }, { status: 404 });
  }

  if (room.status === RoomStatus.COMPLETED || room.status === RoomStatus.CANCELLED) {
    return NextResponse.json({ error: "Room is no longer active" }, { status: 410 });
  }

  const isTeacher = token === room.teacherToken;
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
