import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities";
import { UserRole } from "@langopia/shared/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const academyId = searchParams.get("academyId");

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);

  const where: Record<string, unknown> = {};
  if (academyId) {
    where.academyId = academyId;
  }

  const users = await userRepo.find({
    where,
    order: { createdAt: "DESC" },
    select: [
      "id",
      "email",
      "name",
      "role",
      "academyId",
      "isActive",
      "lastLoginAt",
      "createdAt",
    ],
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, role, academyId } = await req.json();

  if (!name || !email || !role) {
    return NextResponse.json(
      { error: "Name, email, and role are required" },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const userRepo = ds.getRepository(User);

  const existingUser = await userRepo.findOne({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = password
    ? await bcrypt.hash(password, 12)
    : null;

  const user = userRepo.create({
    name,
    email,
    passwordHash,
    role,
    academyId: academyId || session.user.academyId,
    isActive: true,
  });

  await userRepo.save(user);

  return NextResponse.json(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    { status: 201 }
  );
}
