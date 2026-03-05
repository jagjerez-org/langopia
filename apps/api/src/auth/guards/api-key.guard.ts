import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Academy, AcademyMember } from "../../database/entities/index.js";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(Academy)
    private readonly academyRepository: Repository<Academy>,
    @InjectRepository(AcademyMember)
    private readonly memberRepository: Repository<AcademyMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    const token = authHeader?.slice(7);
    if (
      !authHeader?.startsWith("Bearer ") ||
      !token ||
      (!token.startsWith("ak_") && !token.startsWith("lgo_"))
    ) {
      throw new UnauthorizedException(
        "Missing or invalid Authorization header. Use: Bearer <api_key>",
      );
    }

    const apiKey = authHeader.slice(7);

    const academy = await this.academyRepository.findOne({
      where: { apiKey },
    });

    if (!academy) {
      throw new UnauthorizedException("Invalid API key");
    }

    const ownerMember = await this.memberRepository
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.user", "user")
      .where("m.academyId = :academyId", { academyId: academy.id })
      .andWhere("m.roles @> :roles", { roles: JSON.stringify(["owner"]) })
      .getOne();

    if (!ownerMember) {
      throw new UnauthorizedException("Academy has no owner");
    }

    request.academy = academy;
    request.ownerId = ownerMember.userId;

    return true;
  }
}
