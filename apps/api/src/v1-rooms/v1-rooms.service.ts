import * as crypto from "crypto";
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { RoomStatus, UsageMetric } from "@langopia/shared/types";
import { Room } from "../database/entities/room.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { RoomNotes } from "../database/entities/room-notes.entity.js";
import { ChatMessage } from "../database/entities/chat-message.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { User } from "../database/entities/user.entity.js";
import { Academy } from "../database/entities/academy.entity.js";
import { UsageService } from "../usage/usage.service.js";
import { LiveKitService } from "../livekit/livekit.service.js";
import { CreateRoomDto } from "./dto/create-room.dto.js";
import { QueryRoomsDto } from "./dto/query-rooms.dto.js";

@Injectable()
export class V1RoomsService {
  private readonly appUrl: string;

  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
    @InjectRepository(RoomNotes)
    private readonly notesRepo: Repository<RoomNotes>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(ClassReport)
    private readonly classReportRepo: Repository<ClassReport>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usageService: UsageService,
    private readonly liveKitService: LiveKitService,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("NEXT_PUBLIC_APP_URL") ??
      "http://localhost:3000";
  }

  async create(academy: Academy, ownerId: string, dto: CreateRoomDto) {
    // Check plan limits
    const owner = await this.userRepo.findOne({ where: { id: ownerId } });
    if (!owner) {
      throw new InternalServerErrorException("Owner not found");
    }

    const limitCheck = await this.usageService.checkPlanLimit(
      ownerId,
      owner.plan,
      UsageMetric.ROOMS_CREATED,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        `Room limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan.`,
      );
    }

    // Validate lessonId if provided
    if (dto.lessonId) {
      const lesson = await this.lessonRepo.findOne({
        where: { id: dto.lessonId, academyId: academy.id },
      });
      if (!lesson) {
        throw new BadRequestException(
          "Lesson not found or belongs to a different academy",
        );
      }
    }

    // Generate unique tokens for URLs
    const teacherToken = "t_" + crypto.randomBytes(24).toString("hex");
    const studentToken = "s_" + crypto.randomBytes(24).toString("hex");
    const livekitRoomId = `room-${crypto.randomBytes(8).toString("hex")}`;

    // Create LiveKit room
    try {
      const roomService = this.liveKitService.getRoomService();
      await roomService.createRoom({
        name: livekitRoomId,
        emptyTimeout: 600, // 10 minutes
        maxParticipants: (dto.maxStudents ?? 1) + 1, // +1 for teacher
      });
    } catch (err) {
      console.error("Failed to create LiveKit room:", err);
      throw new InternalServerErrorException("Failed to create video room");
    }

    // Create DB record
    const room = new Room();
    room.academyId = academy.id;
    room.createdByUserId = ownerId;
    room.title = dto.title;
    room.language = dto.language ?? "en";
    room.maxStudents = dto.maxStudents ?? 1;
    room.teacherToken = teacherToken;
    room.studentToken = studentToken;
    room.slides = dto.slides ?? [];
    room.livekitRoomId = livekitRoomId;
    room.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    room.lessonId = dto.lessonId ?? null;

    const saved = await this.roomRepo.save(room);

    // Track usage
    await this.usageService.incrementUsage(
      ownerId,
      academy.id,
      UsageMetric.ROOMS_CREATED,
    );

    return {
      id: saved.id,
      title: saved.title,
      language: saved.language,
      maxStudents: saved.maxStudents,
      teacherUrl: `${this.appUrl}/room/${saved.id}?token=${teacherToken}`,
      studentUrl: `${this.appUrl}/room/${saved.id}?token=${studentToken}`,
      status: saved.status,
      slides: saved.slides,
      lessonId: saved.lessonId,
      scheduledAt: saved.scheduledAt,
      createdAt: saved.createdAt,
    };
  }

  async findAll(academy: Academy, query: QueryRoomsDto) {
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const qb = this.roomRepo
      .createQueryBuilder("room")
      .where("room.academyId = :academyId", { academyId: academy.id })
      .orderBy("room.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (query.status) {
      qb.andWhere("room.status = :status", { status: query.status });
    }

    const [rooms, total] = await qb.getManyAndCount();

    return {
      data: rooms.map((r) => ({
        id: r.id,
        title: r.title,
        language: r.language,
        maxStudents: r.maxStudents,
        teacherUrl: `${this.appUrl}/room/${r.id}?token=${r.teacherToken}`,
        studentUrl: `${this.appUrl}/room/${r.id}?token=${r.studentToken}`,
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
    };
  }

  async findOne(academy: Academy, id: string) {
    const room = await this.roomRepo.findOne({
      where: { id, academyId: academy.id },
      relations: ["participants", "participants.student"],
    });

    if (!room) {
      throw new NotFoundException("Room not found");
    }

    return {
      id: room.id,
      title: room.title,
      language: room.language,
      maxStudents: room.maxStudents,
      teacherUrl: `${this.appUrl}/room/${room.id}?token=${room.teacherToken}`,
      studentUrl: `${this.appUrl}/room/${room.id}?token=${room.studentToken}`,
      status: room.status,
      slides: room.slides,
      scheduledAt: room.scheduledAt,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      recordingUrl: room.recordingUrl,
      participants:
        room.participants?.map((p) => ({
          name: p.name,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          speakingTimeSeconds: p.speakingTimeSeconds,
          studentEmail: p.student?.email ?? null,
        })) ?? [],
      createdAt: room.createdAt,
    };
  }

  async remove(academy: Academy, id: string) {
    const room = await this.roomRepo.findOne({
      where: { id, academyId: academy.id },
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

    // Close the LiveKit room
    if (room.livekitRoomId) {
      try {
        const roomService = this.liveKitService.getRoomService();
        await roomService.deleteRoom(room.livekitRoomId);
      } catch {
        // Room may already be gone
      }
    }

    room.status =
      room.status === RoomStatus.ACTIVE
        ? RoomStatus.COMPLETED
        : RoomStatus.CANCELLED;
    room.endedAt = new Date();
    await this.roomRepo.save(room);

    return { id: room.id, status: room.status };
  }

  async getChatHistory(academy: Academy, id: string) {
    const room = await this.roomRepo.findOne({
      where: { id, academyId: academy.id },
    });

    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const messages = await this.chatMessageRepo.find({
      where: { roomId: id },
      order: { createdAt: "ASC" },
    });

    return messages.map((m) => ({
      id: m.id,
      senderName: m.senderName,
      senderRole: m.senderRole,
      message: m.message,
      createdAt: m.createdAt,
    }));
  }

  async getNotes(academy: Academy, id: string) {
    const room = await this.roomRepo.findOne({
      where: { id, academyId: academy.id },
    });

    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const notes = await this.notesRepo.findOne({
      where: { roomId: id },
    });

    if (!notes) {
      return {
        vocabulary: [],
        corrections: [],
        homework: "",
        objectives: "",
      };
    }

    return {
      vocabulary: notes.vocabulary,
      corrections: notes.corrections,
      homework: notes.homework,
      objectives: notes.objectives,
      updatedAt: notes.updatedAt,
    };
  }

  async getReport(academy: Academy, id: string) {
    const room = await this.roomRepo.findOne({
      where: { id, academyId: academy.id },
    });

    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const report = await this.classReportRepo.findOne({
      where: { roomId: id },
    });

    if (!report) {
      throw new NotFoundException("Report not yet available");
    }

    return {
      id: report.id,
      roomId: report.roomId,
      status: report.status,
      summary: report.summary,
      classDuration: report.classDuration,
      tokensUsed: report.tokensUsed,
      teacher: report.teacher,
      students: report.studentReports,
      createdAt: report.createdAt,
    };
  }
}
