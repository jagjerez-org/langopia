import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import {
  Classroom,
  ClassroomEnrollment,
  ProgressReport,
  ClassReport,
  Session,
  LearningProfile,
  User,
} from "@/entities";
import { UserRole, SessionStatus } from "@langopia/shared/types";
import {
  generateProgressReport,
  type VocabularyItem,
  type GrammarError,
  type SpeakingMetrics,
} from "@langopia/ai-pipeline";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const classroom = await ds.getRepository(Classroom).findOne({ where: { id } });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  const role = session.user.role as UserRole;
  const studentId = req.nextUrl.searchParams.get("studentId");

  // Students can only view their own reports
  if (role === UserRole.STUDENT) {
    const enrollment = await ds.getRepository(ClassroomEnrollment).findOne({
      where: { classroomId: id, studentId: session.user.id },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === UserRole.TEACHER && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = { classroomId: id };
  if (studentId) {
    where.studentId = studentId;
  } else if (role === UserRole.STUDENT) {
    where.studentId = session.user.id;
  }

  const reports = await ds.getRepository(ProgressReport).find({
    where,
    order: { createdAt: "DESC" },
    relations: ["student"],
  });

  return NextResponse.json(reports);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const classroom = await ds.getRepository(Classroom).findOne({ where: { id } });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { studentId, periodStart, periodEnd } = body;

  if (!studentId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "studentId, periodStart, and periodEnd are required" },
      { status: 400 }
    );
  }

  // Verify student is enrolled
  const enrollment = await ds.getRepository(ClassroomEnrollment).findOne({
    where: { classroomId: id, studentId },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Student not enrolled" }, { status: 400 });
  }

  // Get student info
  const student = await ds.getRepository(User).findOne({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Get completed sessions with reports in the period
  const sessions = await ds.getRepository(Session).find({
    where: { classroomId: id, status: SessionStatus.COMPLETED },
    order: { startedAt: "ASC" },
  });

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);

  const sessionsInPeriod = sessions.filter((s) => {
    const d = s.startedAt ?? s.scheduledAt;
    return d >= periodStartDate && d <= periodEndDate;
  });

  // Get class reports for those sessions
  const classReports = await Promise.all(
    sessionsInPeriod.map(async (s) => {
      const report = await ds.getRepository(ClassReport).findOne({
        where: { sessionId: s.id },
      });
      if (!report) return null;
      return {
        date: (s.startedAt ?? s.scheduledAt).toISOString().split("T")[0],
        summary: report.summary,
        vocabulary: report.vocabulary as unknown as VocabularyItem[],
        grammarErrors: report.grammarErrors as unknown as GrammarError[],
        speakingMetrics: report.speakingMetrics as unknown as SpeakingMetrics,
      };
    })
  );

  const validReports = classReports.filter(
    (r): r is NonNullable<typeof r> => r !== null
  );

  if (validReports.length === 0) {
    return NextResponse.json(
      { error: "No class reports found in the specified period" },
      { status: 400 }
    );
  }

  // Get current learning profile
  const profile = await ds.getRepository(LearningProfile).findOne({
    where: { studentId },
  });

  const result = await generateProgressReport({
    studentName: student.name,
    classroomName: classroom.name,
    language: classroom.languageTarget,
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    classReports: validReports,
    currentCefrEstimate: profile?.cefrLevelEstimate ?? null,
  });

  // Save progress report
  const progressReport = new ProgressReport();
  progressReport.academyId = classroom.academyId;
  progressReport.studentId = studentId;
  progressReport.classroomId = id;
  progressReport.periodStart = periodStartDate;
  progressReport.periodEnd = periodEndDate;
  progressReport.scores = result.scores;
  progressReport.teacherComments = result.report;

  await ds.getRepository(ProgressReport).save(progressReport);

  // Update CEFR estimate on learning profile
  if (profile) {
    profile.cefrLevelEstimate = result.cefrEstimate;
    await ds.getRepository(LearningProfile).save(profile);
  }

  return NextResponse.json(progressReport, { status: 201 });
}
