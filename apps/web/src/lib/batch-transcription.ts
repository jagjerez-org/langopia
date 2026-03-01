import { getDataSource } from "@/lib/database";
import { Session, Transcription } from "@/entities";
import { Speaker } from "@langopia/shared/types";
import { transcribeAudio } from "@langopia/ai-pipeline";
import { runBatchAnalysis } from "@/lib/batch-analysis";

export async function runBatchTranscription(sessionId: string): Promise<void> {
  const ds = await getDataSource();
  const sessionRepo = ds.getRepository(Session);
  const transcriptionRepo = ds.getRepository(Transcription);

  const session = await sessionRepo.findOne({
    where: { id: sessionId },
    relations: ["classroom"],
  });

  if (!session?.recordingUrl) {
    console.error(`No recording URL for session ${sessionId}`);
    return;
  }

  console.log(`Starting batch transcription for session ${sessionId}`);

  const result = await transcribeAudio(session.recordingUrl);

  const entities = result.segments.map((segment) => {
    const t = new Transcription();
    t.academyId = session.academyId;
    t.sessionId = session.id;
    t.speaker = segment.speaker === "teacher" ? Speaker.TEACHER : Speaker.STUDENT;
    t.text = segment.text;
    t.timestampStart = segment.start;
    t.timestampEnd = segment.end;
    t.wordTimestamps = segment.words.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
    }));
    t.languageDetected = result.language;
    return t;
  });

  await transcriptionRepo.save(entities);

  console.log(
    `Batch transcription complete for session ${sessionId}: ${entities.length} segments`
  );

  // Fire-and-forget AI analysis (generates ClassReport + updates LearningProfile)
  runBatchAnalysis(sessionId).catch((err) =>
    console.error("Batch analysis failed:", err)
  );
}
