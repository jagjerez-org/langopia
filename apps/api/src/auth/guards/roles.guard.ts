import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademyMember } from "../../database/entities/index.js";
import { ROLES_KEY } from "../decorators/roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(AcademyMember)
    private readonly memberRepository: Repository<AcademyMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const academyId = request.params.academyId || request.body?.academyId || request.academyId;

    if (!user || !academyId) {
      throw new ForbiddenException("Missing user or academy context");
    }

    const member = await this.memberRepository.findOne({
      where: { userId: user.id, academyId },
    });

    if (!member) {
      throw new ForbiddenException("Not a member of this academy");
    }

    const hasRole = requiredRoles.some((role) => member.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }
}
