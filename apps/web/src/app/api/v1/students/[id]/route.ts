import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Student, RoomParticipant, ReportExercise } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/students/:id - Get student details with participation history
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const student = await ds.getRepository(Student).findOne({
    where: { id, academyId: academy.id },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Get participation history
  const participations = await ds.getRepository(RoomParticipant).find({
    where: { studentId: id },
    relations: ["room"],
    order: { joinedAt: "DESC" },
    take: 50,
  });

  // Get exercises via ReportExercise join table
  const reportExercises = await ds.getRepository(ReportExercise).find({
    where: { studentId: id },
    relations: ["exercise"],
    order: { createdAt: "DESC" },
    take: 50,
  });

  return NextResponse.json({
    id: student.id,
    email: student.email,
    name: student.name,
    totalRooms: student.totalRooms,
    totalMinutes: student.totalMinutes,
    cefrEstimate: student.cefrEstimate,
    firstSeenAt: student.firstSeenAt,
    lastSeenAt: student.lastSeenAt,
    recentRooms: participations.map((p) => ({
      roomId: p.roomId,
      roomTitle: p.room?.title,
      role: p.role,
      speakingTimeSeconds: p.speakingTimeSeconds,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
    })),
    exercises: reportExercises.map((re) => ({
      id: re.exercise?.id,
      type: re.exercise?.type,
      targetSkill: re.exercise?.targetSkill,
      topic: re.exercise?.topic,
      cefrLevel: re.exercise?.cefrLevel,
      source: re.exercise?.source,
      isCompleted: re.isCompleted,
      isCorrect: re.isCorrect,
      studentAnswer: re.studentAnswer,
      reportId: re.reportId,
      createdAt: re.createdAt,
    })),
  });
}
