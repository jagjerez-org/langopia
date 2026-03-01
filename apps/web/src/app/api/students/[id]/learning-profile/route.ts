import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { LearningProfile } from "@/entities";
import { UserRole } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: studentId } = await params;
  const role = session.user.role as UserRole;

  // Students can only view their own profile
  if (role === UserRole.STUDENT && session.user.id !== studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ds = await getDataSource();
  const profile = await ds.getRepository(LearningProfile).findOne({
    where: { studentId },
    relations: ["student"],
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Teachers can only view profiles of students in their academy
  if (role === UserRole.TEACHER && profile.academyId !== session.user.academyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(profile);
}
