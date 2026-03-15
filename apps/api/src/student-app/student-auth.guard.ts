import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Student, User } from "../database/entities/index.js";

interface StudentJwtPayload {
  sub: string;
  email: string;
  studentId: string;
  academyId: string;
  type: "access" | "refresh";
}

@Injectable()
export class StudentAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing authorization token");
    }

    try {
      const payload = this.jwtService.verify<StudentJwtPayload>(token, {
        secret: this.configService.getOrThrow<string>("JWT_SECRET"),
      });

      if (payload.type !== "access") {
        throw new UnauthorizedException("Invalid token type");
      }

      if (!payload.studentId) {
        throw new UnauthorizedException("Not a student token");
      }

      const [user, student] = await Promise.all([
        this.userRepo.findOne({ where: { id: payload.sub } }),
        this.studentRepo.findOne({ where: { id: payload.studentId } }),
      ]);

      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      if (!student || !student.isActive) {
        throw new UnauthorizedException("Student not found or inactive");
      }

      request.user = user;
      request.student = student;
      request.academyId = student.academyId;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractToken(request: { headers: { authorization?: string } }): string | null {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    return auth.slice(7);
  }
}
