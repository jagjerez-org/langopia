import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User, Academy, AcademyMember } from "../database/entities/index.js";
import { UserPlan, AcademyType } from "@langopia/shared/types";
import { RegisterDto } from "./dto/register.dto.js";
import { LoginDto } from "./dto/login.dto.js";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Academy)
    private readonly academyRepository: Repository<Academy>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = manager.create(User, {
        email: dto.email,
        name: dto.name,
        passwordHash,
        plan: UserPlan.FREE,
      });
      await manager.save(user);

      const academyName = dto.academyName || `${dto.name}'s Academy`;
      const slug = this.generateSlug(academyName);
      const apiKey = this.generateApiKey();

      const academy = manager.create(Academy, {
        name: academyName,
        slug,
        apiKey,
        academyType: dto.academyType || AcademyType.FREELANCE,
      });
      await manager.save(academy);

      const member = manager.create(AcademyMember, {
        userId: user.id,
        academyId: academy.id,
        roles: ["owner"],
      });
      await manager.save(member);

      const tokens = this.generateTokens(user);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        },
      };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is disabled");
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_SECRET"),
      });

      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Invalid token type");
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, plan: user.plan };

    const accessToken = this.jwtService.sign(
      { ...payload, type: "access" },
      {
        expiresIn: this.configService.get("JWT_EXPIRATION", "6h"),
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: "refresh" },
      {
        expiresIn: this.configService.get("JWT_REFRESH_EXPIRATION", "7d"),
      },
    );

    return { accessToken, refreshToken };
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  private generateApiKey(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "ak_";
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
}
