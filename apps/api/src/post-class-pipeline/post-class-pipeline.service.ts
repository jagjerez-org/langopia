import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ReportStatus,
  ParticipantRole,
  UsageMetric,
} from "@langopia/shared/types";
import { Room } from "../database/entities/room.entity.js";
import { Transcription } from "../database/entities/transcription.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { ChatMessage } from "../database/entities/chat-message.entity.js";
import { ReviewItem } from "../database/entities/review-item.entity.js";
import { UsageService } from "../usage/usage.service.js";
import { PushNotificationService } from "../push-notification/push-notification.service.js";

@Injectable()
export class PostClassPipelineService {
  private readonly logger = new Logger(PostClassPipelineService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Transcription)
    private readonly transcriptionRepo: Repository<Transcription>,
    @InjectRepository(ClassReport)
    private readonly reportRepo: Repository<ClassReport>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(ReviewItem)
    private readonly reviewItemRepo: Repository<ReviewItem>,
    private readonly usage: UsageService,
    private readonly pushService: PushNotificationService,
  ) {}

  async runPostClassPipeline(roomId: string): Promise<void> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: ["participants", "participants.student"],
    });

    if (!room) {
      this.logger.error(`Room ${roomId} not found`);
      return;
    }

    let report = new ClassReport();
    report.roomId = roomId;
    report.status = ReportStatus.PROCESSING;
    report = await this.reportRepo.save(report);

    try {
      let transcriptionText = "";
      const transcriptions: Transcription[] = [];

      if (room.recordingUrl) {
        const { transcribeAudio, diarizeSpeakers } = await import(
          "@langopia/ai-pipeline"
        );

        const result = await transcribeAudio(room.recordingUrl);

        const teacherParticipant = room.participants?.find(
          (p) => p.role === ParticipantRole.TEACHER,
        );
        const studentParticipants =
          room.participants?.filter(
            (p) => p.role === ParticipantRole.STUDENT,
          ) ?? [];

        const diarizeResult = await diarizeSpeakers(result.segments, {
          teacherName: teacherParticipant?.name ?? "Teacher",
          studentNames: studentParticipants.map((p) => p.name),
        });

        if (diarizeResult.tokensUsed > 0) {
          await this.usage.incrementUsage(
            room.createdByUserId,
            room.academyId,
            UsageMetric.AI_TOKENS,
            diarizeResult.tokensUsed,
          );
        }

        for (const seg of diarizeResult.segments) {
          const t = new Transcription();
          t.roomId = roomId;
          t.speakerName =
            seg.speaker === "teacher"
              ? (teacherParticipant?.name ?? "Teacher")
              : "Student";
          t.speakerRole =
            seg.speaker === "teacher"
              ? ParticipantRole.TEACHER
              : ParticipantRole.STUDENT;
          t.text = seg.text;
          t.timestampStart = seg.start;
          t.timestampEnd = seg.end;
          t.wordTimestamps =
            seg.words as unknown as Record<string, unknown>[];
          t.languageDetected = result.language;
          transcriptions.push(
            await this.transcriptionRepo.save(t),
          );
        }

        transcriptionText = diarizeResult.segments
          .map((s) => `[${s.speaker}] ${s.text}`)
          .join("\n");
      }

      const participants = room.participants ?? [];
      const teacherP = participants.find(
        (p) => p.role === ParticipantRole.TEACHER,
      );
      const studentPs = participants.filter(
        (p) => p.role === ParticipantRole.STUDENT,
      );

      const classDuration =
        room.startedAt && room.endedAt
          ? Math.round(
              (room.endedAt.getTime() - room.startedAt.getTime()) /
                1000,
            )
          : 0;

      // Load chat messages for analysis
      const chatMessages = await this.chatRepo.find({
        where: { roomId },
        order: { createdAt: "ASC" },
      });
      const chatText = chatMessages.length > 0
        ? chatMessages
            .map((m) => `[${m.senderRole} - ${m.senderName}] ${m.message}`)
            .join("\n")
        : undefined;

      if (transcriptionText || chatText) {
        const { analyzeSession } = await import(
          "@langopia/ai-pipeline"
        );

        const analysisResult = await analyzeSession({
          text: transcriptionText || "",
          segments: transcriptions.map((t) => ({
            speaker:
              t.speakerRole === ParticipantRole.TEACHER
                ? ("teacher" as const)
                : ("student" as const),
            text: t.text,
            start: t.timestampStart,
            end: t.timestampEnd,
            words: (t.wordTimestamps ?? []).map((w) => ({
              word: String(
                (w as Record<string, unknown>).word ?? "",
              ),
              start: Number(
                (w as Record<string, unknown>).start ?? 0,
              ),
              end: Number(
                (w as Record<string, unknown>).end ?? 0,
              ),
              confidence: 1.0,
            })),
          })),
          language: room.language,
          chatText,
        });

        if (analysisResult.tokensUsed > 0) {
          await this.usage.incrementUsage(
            room.createdByUserId,
            room.academyId,
            UsageMetric.AI_TOKENS,
            analysisResult.tokensUsed,
          );
        }

        report.teacher = teacherP
          ? {
              name: teacherP.name,
              speakingTime: Math.round(
                analysisResult.speakingMetrics.teacherSpeakingTime,
              ),
              speakingRatio:
                1 -
                analysisResult.speakingMetrics.speakingRatio,
            }
          : null;

        report.studentReports = studentPs.map((sp) => ({
          studentId: sp.studentId ?? "",
          name: sp.name,
          email: sp.student?.email ?? "",
          speakingTime: Math.round(
            analysisResult.speakingMetrics.studentSpeakingTime /
              Math.max(studentPs.length, 1),
          ),
          speakingRatio:
            analysisResult.speakingMetrics.speakingRatio /
            Math.max(studentPs.length, 1),
          fillerWords: Math.round(
            analysisResult.speakingMetrics.fillerWordCount /
              Math.max(studentPs.length, 1),
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
        report.summary =
          "No recording available for this session. Report could not be generated.";
        report.classDuration = classDuration;
        report.teacher = teacherP
          ? {
              name: teacherP.name,
              speakingTime: 0,
              speakingRatio: 0,
            }
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

      await this.reportRepo.save(report);

      // Ingest vocabulary + grammar errors as review items for spaced repetition
      if (report.status === ReportStatus.COMPLETED && report.studentReports?.length) {
        await this.ingestReviewItems(room.academyId, roomId, report.studentReports);
      }

      // Fire-and-forget: push notification to teacher when report is ready
      if (
        report.status === ReportStatus.COMPLETED &&
        room.createdByUserId
      ) {
        this.pushService
          .sendReportReady(room.createdByUserId, {
            reportId: report.id,
            roomId,
            classTitle: room.title,
          })
          .catch(() => {});
      }

      for (const sp of studentPs) {
        if (sp.studentId) {
          const student = await this.studentRepo.findOne({
            where: { id: sp.studentId },
          });
          if (student) {
            student.totalRooms += 1;
            student.totalMinutes += Math.round(classDuration / 60);
            await this.studentRepo.save(student);
          }
        }
      }

      await this.usage.incrementUsage(
        room.createdByUserId,
        room.academyId,
        UsageMetric.AI_REPORTS,
      );
      await this.usage.incrementUsage(
        room.createdByUserId,
        room.academyId,
        UsageMetric.CLASS_MINUTES,
        Math.round(classDuration / 60),
      );

      this.logger.log(`Report generated for room ${roomId}`);
    } catch (err) {
      this.logger.error(`Pipeline failed for room ${roomId}:`, err);
      report.status = ReportStatus.FAILED;
      report.summary = `Pipeline failed: ${err instanceof Error ? err.message : "Unknown error"}`;
      await this.reportRepo.save(report);
    }
  }

  /**
   * Creates ReviewItem records (spaced repetition flashcards) from class report data.
   * This works independently of whether the academy has any courses/lessons/exercises.
   * Vocabulary and grammar errors from AI analysis become review items for students.
   */
  private async ingestReviewItems(
    academyId: string,
    roomId: string,
    studentReports: Array<{
      email: string;
      studentId: string;
      vocabulary?: Array<{ word: string; cefrLevel?: string; context?: string }>;
      grammarErrors?: Array<{ text: string; correction?: string; rule?: string; explanation?: string }>;
    }>,
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    for (const report of studentReports) {
      if (!report.email && !report.studentId) continue;

      // Find the student — by studentId first, fallback to email
      let student: Student | null = null;
      if (report.studentId) {
        student = await this.studentRepo.findOne({ where: { id: report.studentId } });
      }
      if (!student && report.email) {
        student = await this.studentRepo.findOne({
          where: { academyId, email: report.email },
        });
      }
      if (!student) continue;

      const items: ReviewItem[] = [];

      // Vocabulary → review items
      if (report.vocabulary?.length) {
        for (const v of report.vocabulary) {
          const item = new ReviewItem();
          item.studentId = student.id;
          item.itemType = "vocabulary";
          item.content = v as Record<string, unknown>;
          item.sourceType = "class_report";
          item.sourceId = roomId;
          item.nextReviewDate = today;
          items.push(item);
        }
      }

      // Grammar errors → review items
      if (report.grammarErrors?.length) {
        for (const g of report.grammarErrors) {
          const item = new ReviewItem();
          item.studentId = student.id;
          item.itemType = "grammar";
          item.content = g as Record<string, unknown>;
          item.sourceType = "class_report";
          item.sourceId = roomId;
          item.nextReviewDate = today;
          items.push(item);
        }
      }

      if (items.length > 0) {
        await this.reviewItemRepo.save(items);
        this.logger.log(
          `Created ${items.length} review items for student ${student.id} from room ${roomId}`,
        );
      }
    }
  }
}
