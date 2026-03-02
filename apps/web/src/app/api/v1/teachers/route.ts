import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { AcademyMember, User } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/teachers - List teachers for the academy
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const teachers = await ds.getRepository(AcademyMember)
    .createQueryBuilder("m")
    .leftJoinAndSelect("m.user", "user")
    .where("m.academyId = :academyId", { academyId: academy.id })
    .andWhere("m.roles @> :roles", { roles: JSON.stringify(["teacher"]) })
    .getMany();

  return NextResponse.json({
    data: teachers.map((t) => ({
      id: t.id,
      name: t.user.name,
      email: t.user.email,
      roles: t.roles,
    })),
  });
}

// POST /api/v1/teachers - Invite a teacher by email
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const body = await req.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Find user by email
  const user = await ds.getRepository(User).findOne({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "No user found with this email. They must register first." },
      { status: 404 }
    );
  }

  // Check if already a member
  let member = await ds.getRepository(AcademyMember).findOne({
    where: { userId: user.id, academyId: academy.id },
  });

  if (member) {
    // Add teacher role if not already present
    if (!member.roles.includes("teacher")) {
      member.roles = [...member.roles, "teacher"];
      await ds.getRepository(AcademyMember).save(member);
    }
  } else {
    member = new AcademyMember();
    member.userId = user.id;
    member.academyId = academy.id;
    member.roles = ["teacher"];
    member = await ds.getRepository(AcademyMember).save(member);
  }

  return NextResponse.json(
    {
      id: member.id,
      name: user.name,
      email: user.email,
      roles: member.roles,
    },
    { status: 201 }
  );
}
