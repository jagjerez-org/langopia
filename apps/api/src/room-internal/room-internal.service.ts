import crypto from "crypto";
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  GoneException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { ConfigService } from "@nestjs/config";
import {
  RoomStatus,
  ParticipantRole,
  ClassStatus,
} from "@langopia/shared/types";
import { Room } from "../database/entities/room.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { RoomNotes } from "../database/entities/room-notes.entity.js";
import { ChatMessage } from "../database/entities/chat-message.entity.js";
import { Transcription } from "../database/entities/transcription.entity.js";
import { LiveKitService } from "../livekit/livekit.service.js";
import { RecordingService } from "../recording/recording.service.js";
import { PostClassPipelineService } from "../post-class-pipeline/post-class-pipeline.service.js";
import { JoinRoomDto } from "./dto/join-room.dto.js";
import { SendChatDto } from "./dto/send-chat.dto.js";
import { SaveNotesDto } from "./dto/save-notes.dto.js";

@Injectable()
export class RoomInternalService {
  private readonly logger = new Logger(RoomInternalService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
    @InjectRepository(RoomNotes)
    private readonly notesRepo: Repository<RoomNotes>,
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(Transcription)
    private readonly transcriptionRepo: Repository<Transcription>,
    private readonly livekit: LiveKitService,
    private readonly recording: RecordingService,
    private readonly pipeline: PostClassPipelineService,
    private readonly config: ConfigService,
  ) {}

  // ─── POST /room/join ──────────────────────────────────────

  async joinRoom(dto: JoinRoomDto) {
    const { token, name, email } = dto;

    if (!token) {
      throw new BadRequestException("token is required");
    }

    // Find room by teacher or student token
    let room = await this.roomRepo.findOne({
      where: [{ teacherToken: token }, { studentToken: token }],
    });

    let isTeacher: boolean;

    // If no Room found, try Class token lookup
    if (!room) {
      const cls = await this.classRepo.findOne({
        where: [{ teacherToken: token }, { studentToken: token }],
      });

      if (!cls) {
        throw new NotFoundException("Invalid room token");
      }

      if (
        cls.status === ClassStatus.COMPLETED ||
        cls.status === ClassStatus.CANCELLED
      ) {
        throw new GoneException("Class is no longer active");
      }

      isTeacher = token === cls.teacherToken;

      // 5-minute join rule: can only enter 5 min before scheduled time
      if (cls.scheduledAt) {
        const now = new Date();
        const fiveMinBefore = new Date(cls.scheduledAt.getTime() - 5 * 60_000);
        if (now < fiveMinBefore) {
          throw new ForbiddenException(
            "You can join 5 minutes before the scheduled time",
          );
        }
      }

      // If Class has a Room already, use it
      if (cls.roomId) {
        room = await this.roomRepo.findOne({
          where: { id: cls.roomId },
        });
      }

      // If no Room exists yet, create one on-demand
      if (!room) {
        const livekitRoomId = `room-${crypto.randomBytes(8).toString("hex")}`;

        try {
          const roomService = this.livekit.getRoomService();
          await roomService.createRoom({
            name: livekitRoomId,
            emptyTimeout: 600,
            maxParticipants: (cls.maxStudents ?? 1) + 1,
          });
        } catch (err) {
          this.logger.error("Failed to create LiveKit room for class:", err);
          throw new InternalServerErrorException(
            "Failed to create video room",
          );
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

        room = await this.roomRepo.save(newRoom);

        // Link Room to Class and update Class status
        cls.roomId = room.id;
        cls.status = ClassStatus.IN_PROGRESS;
        await this.classRepo.save(cls);
      }
    } else {
      isTeacher = token === room.teacherToken;
    }

    if (
      room.status === RoomStatus.COMPLETED ||
      room.status === RoomStatus.CANCELLED
    ) {
      throw new GoneException("Room is no longer active");
    }

    const role = isTeacher
      ? ParticipantRole.TEACHER
      : ParticipantRole.STUDENT;

    // Students must provide name and email
    if (!isTeacher && (!name || !email)) {
      throw new BadRequestException(
        "name and email are required for students",
      );
    }

    // For students, check maxStudents limit
    if (!isTeacher) {
      const currentStudents = await this.participantRepo.count({
        where: {
          roomId: room.id,
          role: ParticipantRole.STUDENT,
          leftAt: IsNull(),
        },
      });
      if (currentStudents >= room.maxStudents) {
        throw new ForbiddenException("Room is full");
      }
    }

    // Find or create student record
    let studentId: string | null = null;
    if (!isTeacher && email) {
      let student = await this.studentRepo.findOne({
        where: { academyId: room.academyId, email },
      });

      if (!student) {
        student = new Student();
        student.academyId = room.academyId;
        student.email = email;
        student.name = name!;
        student = await this.studentRepo.save(student);
      } else if (student.name !== name) {
        student.name = name!;
        await this.studentRepo.save(student);
      }

      studentId = student.id;
    }

    // Create participant record
    const participant = new RoomParticipant();
    participant.roomId = room.id;
    participant.name = isTeacher ? (name || "Teacher") : name!;
    participant.role = role;
    participant.studentId = studentId;
    await this.participantRepo.save(participant);

    // If teacher joins and room is waiting, activate it
    if (isTeacher && room.status === RoomStatus.WAITING) {
      room.status = RoomStatus.ACTIVE;
      room.startedAt = new Date();
      await this.roomRepo.save(room);
    }

    // Generate LiveKit token for participant
    const identity = isTeacher
      ? `teacher-${room.id}`
      : `student-${studentId}`;
    const livekitToken = await this.livekit.createParticipantToken(
      room.livekitRoomId!,
      identity,
      isTeacher ? (name || "Teacher") : name!,
      {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    );

    const livekitUrl =
      this.config.get<string>("LIVEKIT_URL") ??
      this.config.get<string>("NEXT_PUBLIC_LIVEKIT_URL") ??
      "ws://localhost:7880";

    // Find linked class for scheduledAt + durationMinutes
    const linkedClass = await this.classRepo.findOne({
      where: { roomId: room.id },
    });

    return {
      roomId: room.id,
      title: room.title,
      language: room.language,
      role,
      participantId: participant.id,
      participantName: participant.name,
      livekitToken,
      livekitUrl,
      slides: room.slides,
      status: room.status,
      scheduledAt: linkedClass?.scheduledAt?.toISOString() ?? room.scheduledAt?.toISOString() ?? null,
      durationMinutes: linkedClass?.durationMinutes ?? null,
    };
  }

  // ─── POST /room/:roomId/chat ──────────────────────────────

  async sendChat(roomId: string, dto: SendChatDto) {
    const { senderName, senderRole, message } = dto;

    if (!senderName || !message) {
      throw new BadRequestException("Missing fields");
    }

    const msg = new ChatMessage();
    msg.roomId = roomId;
    msg.senderName = senderName;
    msg.senderRole =
      senderRole === "student"
        ? ParticipantRole.STUDENT
        : ParticipantRole.TEACHER;
    msg.message = message;

    const saved = await this.chatRepo.save(msg);
    return { id: saved.id };
  }

  // ─── PUT /room/:roomId/notes ──────────────────────────────

  async saveNotes(roomId: string, dto: SaveNotesDto) {
    const { vocabulary, corrections, homework, objectives } = dto;

    let notes = await this.notesRepo.findOne({
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

    await this.notesRepo.save(notes);
    return { ok: true };
  }

  // ─── POST /room/:roomId/recording ─────────────────────────

  async startRecording(roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    if (room.egressId) {
      throw new BadRequestException("Recording already active");
    }

    if (!room.livekitRoomId) {
      throw new BadRequestException("No LiveKit room");
    }

    try {
      const egressId = await this.recording.startRoomRecording(
        room.livekitRoomId,
        roomId,
      );
      room.egressId = egressId;
      await this.roomRepo.save(room);
      return { egressId };
    } catch (err) {
      this.logger.error("Failed to start recording:", err);
      throw new InternalServerErrorException("Failed to start recording");
    }
  }

  // ─── DELETE /room/:roomId/recording ────────────────────────

  async stopRecording(roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    if (!room.egressId) {
      throw new BadRequestException("No active recording");
    }

    try {
      const recordingUrl = await this.recording.stopRecording(room.egressId);
      room.egressId = null;
      if (recordingUrl) room.recordingUrl = recordingUrl;
      await this.roomRepo.save(room);
      return { recordingUrl };
    } catch (err) {
      this.logger.error("Failed to stop recording:", err);
      throw new InternalServerErrorException("Failed to stop recording");
    }
  }

  // ─── POST /room/:roomId/end ────────────────────────────────

  async endSession(roomId: string) {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException("Room not found");
    }

    if (
      room.status === RoomStatus.COMPLETED ||
      room.status === RoomStatus.CANCELLED
    ) {
      throw new BadRequestException("Room is already closed");
    }

    // Stop recording if active
    if (room.egressId) {
      try {
        const recordingUrl = await this.recording.stopRecording(
          room.egressId,
        );
        if (recordingUrl) {
          room.recordingUrl = recordingUrl;
        }
      } catch (err) {
        this.logger.error("Failed to stop recording:", err);
      }
    }

    // Close the LiveKit room
    if (room.livekitRoomId) {
      try {
        const roomService = this.livekit.getRoomService();
        await roomService.deleteRoom(room.livekitRoomId);
      } catch {
        // Room may already be gone
      }
    }

    room.status = RoomStatus.COMPLETED;
    room.endedAt = new Date();
    await this.roomRepo.save(room);

    // Update linked class status to completed
    const linkedClass = await this.classRepo.findOne({
      where: { roomId },
    });
    if (linkedClass) {
      linkedClass.status = ClassStatus.COMPLETED;
      await this.classRepo.save(linkedClass);
    }

    // Fire-and-forget: run post-class pipeline
    this.pipeline.runPostClassPipeline(roomId).catch((err) =>
      this.logger.error("[Pipeline] Background error:", err),
    );

    return { id: room.id, status: room.status };
  }

  // ─── POST /room/:roomId/transcribe ─────────────────────
  private readonly transcribeRateLimit = new Map<string, number>();

  async transcribeChunk(
    roomId: string,
    participantId: string,
    participantRole: string,
    audioFile: Express.Multer.File,
  ) {
    // Rate limit: 6 req/min per participant
    const key = `${roomId}:${participantId}`;
    const now = Date.now();
    const lastTime = this.transcribeRateLimit.get(key) ?? 0;
    if (now - lastTime < 10000) {
      throw new BadRequestException("Rate limit exceeded (max 6/min)");
    }
    this.transcribeRateLimit.set(key, now);

    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException("Room not found");
    if (room.status !== "active") {
      throw new BadRequestException("Room is not active");
    }

    // Find participant for speaker name
    const participant = await this.participantRepo.findOne({
      where: { id: participantId },
    });

    const { transcribeChunk: transcribeAudioChunk } = await import(
      "@langopia/ai-pipeline"
    );

    const file = new File([audioFile.buffer], "chunk.webm", {
      type: audioFile.mimetype,
    });
    const text = await transcribeAudioChunk(file);

    if (!text || text.trim().length === 0) {
      return { text: "" };
    }

    const transcription = new Transcription();
    transcription.roomId = roomId;
    transcription.speakerName = participant?.name ?? "Student";
    transcription.speakerRole =
      participantRole === "student"
        ? ParticipantRole.STUDENT
        : ParticipantRole.TEACHER;
    transcription.text = text.trim();
    transcription.timestampStart = 0;
    transcription.timestampEnd = 0;
    transcription.isLive = true;
    transcription.languageDetected = room.language;

    await this.transcriptionRepo.save(transcription);
    return { text: text.trim() };
  }

  // ─── POST /room/:roomId/suggestions ────────────────────
  async triggerSuggestions(roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException("Room not found");

    if (room.suggestions) {
      return { status: "already_generated" };
    }

    // Collect live transcriptions
    const transcriptions = await this.transcriptionRepo.find({
      where: { roomId, isLive: true },
      order: { createdAt: "ASC" },
    });

    // Collect chat messages
    const chatMessages = await this.chatRepo.find({
      where: { roomId },
      order: { createdAt: "ASC" },
    });

    const transcriptText = transcriptions.map((t) => `[${t.speakerRole}] ${t.text}`).join("\n");
    const chatText = chatMessages.map((m) => `[${m.senderRole} - ${m.senderName}] ${m.message}`).join("\n");

    const { generateContentSuggestions } = await import(
      "@langopia/ai-pipeline"
    );

    const suggestions = await generateContentSuggestions({
      transcriptText,
      chatText,
      language: room.language,
      academyId: room.academyId,
    });

    room.suggestions = suggestions;
    await this.roomRepo.save(room);

    return { status: "completed", suggestions };
  }

  // ─── GET /room/:roomId/suggestions ─────────────────────
  async getSuggestions(roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException("Room not found");

    return {
      status: room.suggestions ? "completed" : "pending",
      suggestions: room.suggestions ?? null,
    };
  }
}
