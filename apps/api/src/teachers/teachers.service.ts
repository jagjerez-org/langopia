import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { User } from "../database/entities/user.entity.js";

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(AcademyMember)
    private readonly memberRepo: Repository<AcademyMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async listTeachers(academyId: string) {
    const teachers = await this.memberRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.user", "user")
      .where("m.academyId = :academyId", { academyId })
      .andWhere("m.roles @> :roles", { roles: JSON.stringify(["teacher"]) })
      .getMany();

    return {
      data: teachers.map((t) => ({
        id: t.id,
        name: t.user.name,
        email: t.user.email,
        roles: t.roles,
      })),
    };
  }

  async inviteTeacher(academyId: string, email: string) {
    // Find user by email
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(
        "No user found with this email. They must register first.",
      );
    }

    // Check if already a member
    let member = await this.memberRepo.findOne({
      where: { userId: user.id, academyId },
    });

    if (member) {
      // Add teacher role if not already present
      if (!member.roles.includes("teacher")) {
        member.roles = [...member.roles, "teacher"];
        await this.memberRepo.save(member);
      }
    } else {
      member = new AcademyMember();
      member.userId = user.id;
      member.academyId = academyId;
      member.roles = ["teacher"];
      member = await this.memberRepo.save(member);
    }

    return {
      id: member.id,
      name: user.name,
      email: user.email,
      roles: member.roles,
    };
  }
}
