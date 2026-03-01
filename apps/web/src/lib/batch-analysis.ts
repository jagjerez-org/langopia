import { getDataSource } from "@/lib/database";
import {
  Session,
  Transcription,
  ClassReport,
  LearningProfile,
} from "@/entities";
import { Speaker } from "@langopia/shared/types";
import {
  analyzeSession,
  type TranscriptionResult,
  type TranscriptionSegment,
} from "@langopia/ai-pipeline";

export async function runBatchAnalysis(sessionId: string): Promise<void> {
  const ds = await getDataSource();
  const sessionRepo = ds.getRepository(Session);
  const transcriptionRepo = ds.getRepository(Transcription);
  const reportRepo = ds.getRepository(ClassReport);
  const profileRepo = ds.getRepository(LearningProfile);

  const session = await sessionRepo.findOne({
    where: { id: sessionId },
    relations: ["classroom", "classroom.enrollments"],
  });

  if (!session) {
    console.error(`Session ${sessionId} not found for analysis`);
    return;
  }

  // Check if report already exists
  const existing = await reportRepo.findOne({ where: { sessionId } });
  if (existing) {
    console.log(`Report already exists for session ${sessionId}`);
    return;
  }

  // Load transcription segments
  const segments = await transcriptionRepo.find({
    where: { sessionId },
    order: { timestampStart: "ASC" },
  });

  if (segments.length === 0) {
    console.log(`No transcription segments for session ${sessionId}`);
    return;
  }

  // Build TranscriptionResult from DB segments
  const transcriptionResult: TranscriptionResult = {
    text: segments.map((s) => s.text).join(" "),
    language: segments[0].languageDetected ?? "en",
    segments: segments.map(
      (s): TranscriptionSegment => ({
        speaker: s.speaker === Speaker.TEACHER ? "teacher" : "student",
        text: s.text,
        start: s.timestampStart,
        end: s.timestampEnd,
        words: (s.wordTimestamps ?? []).map((w) => ({
          word: String(w.word ?? ""),
          start: Number(w.start ?? 0),
          end: Number(w.end ?? 0),
          confidence: Number(w.confidence ?? 1),
        })),
      })
    ),
  };

  console.log(`Starting AI analysis for session ${sessionId}`);

  const analysis = await analyzeSession(transcriptionResult);

  // Save ClassReport
  const report = new ClassReport();
  report.academyId = session.academyId;
  report.sessionId = sessionId;
  report.summary = analysis.summary;
  report.vocabulary = analysis.vocabulary as unknown as Record<string, unknown>[];
  report.grammarErrors = analysis.grammarErrors as unknown as Record<string, unknown>[];
  report.speakingMetrics = analysis.speakingMetrics as unknown as Record<string, unknown>;
  report.suggestions = analysis.suggestions;
  await reportRepo.save(report);

  // Update LearningProfiles for enrolled students
  const enrollments = session.classroom?.enrollments ?? [];
  for (const enrollment of enrollments) {
    let profile = await profileRepo.findOne({
      where: { studentId: enrollment.studentId },
    });

    if (!profile) {
      profile = new LearningProfile();
      profile.academyId = session.academyId;
      profile.studentId = enrollment.studentId;
      profile.vocabularyBank = [];
      profile.grammarPatterns = [];
    }

    // Append new vocabulary to the bank
    const existingWords = new Set(
      profile.vocabularyBank.map((v) => String(v.word ?? "").toLowerCase())
    );
    for (const vocab of analysis.vocabulary) {
      if (!existingWords.has(vocab.word.toLowerCase())) {
        profile.vocabularyBank.push({
          word: vocab.word,
          cefrLevel: vocab.cefrLevel,
          context: vocab.context,
          learnedAt: new Date().toISOString(),
          sessionId,
        });
      }
    }

    // Append grammar patterns
    for (const err of analysis.grammarErrors) {
      profile.grammarPatterns.push({
        rule: err.rule,
        example: err.text,
        correction: err.correction,
        sessionId,
        date: new Date().toISOString(),
      });
    }

    await profileRepo.save(profile);
  }

  console.log(`AI analysis complete for session ${sessionId}`);
}
