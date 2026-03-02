import { getDataSource } from "@/lib/database";
import {
  Room,
  RoomParticipant,
  Transcription,
  ClassReport,
  Student,
  UsageRecord,
} from "@/entities";
import {
  ReportStatus,
  ParticipantRole,
  UsageMetric,
} from "@langopia/shared/types";
import { incrementUsage } from "@/lib/api-auth";

/**
 * Post-class pipeline: transcription → analysis → report generation
 * Called after a room session ends, runs asynchronously.
 */
export async function runPostClassPipeline(roomId: string): Promise<void> {
  const ds = await getDataSource();

  const room = await ds.getRepository(Room).findOne({
    where: { id: roomId },
    relations: ["participants", "participants.student"],
  });

  if (!room) {
    console.error(`[Pipeline] Room ${roomId} not found`);
    return;
  }

  // Create report placeholder
  let report = new ClassReport();
  report.roomId = roomId;
  report.status = ReportStatus.PROCESSING;
  report = await ds.getRepository(ClassReport).save(report);

  try {
    // Step 1: Transcribe recording (if available)
    let transcriptionText = "";
    const transcriptions: Transcription[] = [];

    if (room.recordingUrl) {
      const { transcribeAudio, diarizeSpeakers } = await import(
        "@langopia/ai-pipeline"
      );

      const result = await transcribeAudio(room.recordingUrl);

      // Diarize speakers
      const teacherParticipant = room.participants?.find(
        (p) => p.role === ParticipantRole.TEACHER
      );
      const studentParticipants =
        room.participants?.filter(
          (p) => p.role === ParticipantRole.STUDENT
        ) ?? [];

      const diarized = await diarizeSpeakers(result.segments, {
        teacherName: teacherParticipant?.name ?? "Teacher",
        studentNames: studentParticipants.map((p) => p.name),
      });

      // Save transcription segments
      for (const seg of diarized) {
        const t = new Transcription();
        t.roomId = roomId;
        t.speakerName =
          seg.speaker === "teacher"
            ? teacherParticipant?.name ?? "Teacher"
            : "Student";
        t.speakerRole =
          seg.speaker === "teacher"
            ? ParticipantRole.TEACHER
            : ParticipantRole.STUDENT;
        t.text = seg.text;
        t.timestampStart = seg.start;
        t.timestampEnd = seg.end;
        t.wordTimestamps = seg.words as unknown as Record<string, unknown>[];
        t.languageDetected = result.language;
        transcriptions.push(await ds.getRepository(Transcription).save(t));
      }

      transcriptionText = diarized
        .map((s) => `[${s.speaker}] ${s.text}`)
        .join("\n");
    }

    // Step 2: Analyze class and generate report
    const participants = room.participants ?? [];
    const teacherP = participants.find(
      (p) => p.role === ParticipantRole.TEACHER
    );
    const studentPs = participants.filter(
      (p) => p.role === ParticipantRole.STUDENT
    );

    // Compute class duration in seconds
    const classDuration =
      room.startedAt && room.endedAt
        ? Math.round(
            (room.endedAt.getTime() - room.startedAt.getTime()) / 1000
          )
        : 0;

    // Generate per-student reports via AI
    if (transcriptionText) {
      const { analyzeSession } = await import("@langopia/ai-pipeline");

      // Build transcription result for analysis
      const analysisResult = await analyzeSession({
        text: transcriptionText,
        segments: transcriptions.map((t) => ({
          speaker: t.speakerRole === ParticipantRole.TEACHER ? "teacher" as const : "student" as const,
          text: t.text,
          start: t.timestampStart,
          end: t.timestampEnd,
          words: (t.wordTimestamps ?? []).map((w) => ({
            word: String((w as Record<string, unknown>).word ?? ""),
            start: Number((w as Record<string, unknown>).start ?? 0),
            end: Number((w as Record<string, unknown>).end ?? 0),
            confidence: 1.0,
          })),
        })),
        language: room.language,
      });

      // Build teacher metrics
      report.teacher = teacherP
        ? {
            name: teacherP.name,
            speakingTime: Math.round(
              analysisResult.speakingMetrics.teacherSpeakingTime
            ),
            speakingRatio:
              1 - analysisResult.speakingMetrics.speakingRatio,
          }
        : null;

      // Build per-student reports
      report.studentReports = studentPs.map((sp) => ({
        studentId: sp.studentId ?? "",
        name: sp.name,
        email: sp.student?.email ?? "",
        speakingTime: Math.round(
          analysisResult.speakingMetrics.studentSpeakingTime /
            Math.max(studentPs.length, 1)
        ),
        speakingRatio:
          analysisResult.speakingMetrics.speakingRatio /
          Math.max(studentPs.length, 1),
        fillerWords: Math.round(
          analysisResult.speakingMetrics.fillerWordCount /
            Math.max(studentPs.length, 1)
        ),
        vocabulary: analysisResult.vocabulary.map((v) => ({
          word: v.word,
          cefrLevel: v.cefrLevel,
          context: v.context,
        })),
        grammarErrors: analysisResult.grammarErrors.map((g) => ({
          text: g.text,
          correction: g.correction,
          rule: g.rule,
          explanation: g.explanation,
        })),
        exercises: [],
        homeworkSuggestions: analysisResult.suggestions,
      }));

      report.summary = analysisResult.summary;
      report.classDuration = classDuration;
      report.status = ReportStatus.COMPLETED;
    } else {
      // No transcription available — minimal report
      report.summary =
        "No recording available for this session. Report could not be generated.";
      report.classDuration = classDuration;
      report.teacher = teacherP
        ? { name: teacherP.name, speakingTime: 0, speakingRatio: 0 }
        : null;
      report.studentReports = studentPs.map((sp) => ({
        studentId: sp.studentId ?? "",
        name: sp.name,
        email: sp.student?.email ?? "",
        speakingTime: 0,
        speakingRatio: 0,
        fillerWords: 0,
        vocabulary: [],
        grammarErrors: [],
        exercises: [],
        homeworkSuggestions: [],
      }));
      report.status = ReportStatus.COMPLETED;
    }

    await ds.getRepository(ClassReport).save(report);

    // Step 3: Update student records
    for (const sp of studentPs) {
      if (sp.studentId) {
        const student = await ds.getRepository(Student).findOne({
          where: { id: sp.studentId },
        });
        if (student) {
          student.totalRooms += 1;
          student.totalMinutes += Math.round(classDuration / 60);
          await ds.getRepository(Student).save(student);
        }
      }
    }

    // Step 4: Track usage
    await incrementUsage(
      room.createdByUserId,
      room.academyId,
      UsageMetric.AI_REPORTS
    );
    await incrementUsage(
      room.createdByUserId,
      room.academyId,
      UsageMetric.CLASS_MINUTES,
      Math.round(classDuration / 60)
    );

    console.log(`[Pipeline] Report generated for room ${roomId}`);
  } catch (err) {
    console.error(`[Pipeline] Failed for room ${roomId}:`, err);
    report.status = ReportStatus.FAILED;
    report.summary = `Pipeline failed: ${err instanceof Error ? err.message : "Unknown error"}`;
    await ds.getRepository(ClassReport).save(report);
  }
}
