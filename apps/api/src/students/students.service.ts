import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Student } from "../database/entities/student.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { ReportExercise } from "../database/entities/report-exercise.entity.js";

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
    @InjectRepository(ReportExercise)
    private readonly reportExerciseRepo: Repository<ReportExercise>,
  ) {}

  async listStudents(
    academyId: string,
    opts: { search?: string; limit: number; offset: number },
  ) {
    const { search, limit, offset } = opts;

    const qb = this.studentRepo
      .createQueryBuilder("student")
      .where("student.academyId = :academyId", { academyId })
      .orderBy("student.lastSeenAt", "DESC")
      .take(limit)
      .skip(offset);

    if (search) {
      qb.andWhere(
        "(student.name ILIKE :search OR student.email ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const [students, total] = await qb.getManyAndCount();

    return {
      data: students.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        totalRooms: s.totalRooms,
        totalMinutes: s.totalMinutes,
        cefrEstimate: s.cefrEstimate,
        firstSeenAt: s.firstSeenAt,
        lastSeenAt: s.lastSeenAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getStudentDetail(academyId: string, id: string) {
    const student = await this.studentRepo.findOne({
      where: { id, academyId },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Get participation history
    const participations = await this.participantRepo.find({
      where: { studentId: id },
      relations: ["room"],
      order: { joinedAt: "DESC" },
      take: 50,
    });

    // Get exercises via ReportExercise join table
    const reportExercises = await this.reportExerciseRepo.find({
      where: { studentId: id },
      relations: ["exercise"],
      order: { createdAt: "DESC" },
      take: 50,
    });

    return {
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
    };
  }
}
