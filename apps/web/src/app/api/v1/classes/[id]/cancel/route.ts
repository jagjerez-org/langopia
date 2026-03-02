import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Class, ClassStudent, AcademyMember } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { sendClassCancelled } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// POST /api/v1/classes/:id/cancel - Cancel a class
export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const cls = await ds.getRepository(Class).findOne({
    where: { id, academyId: academy.id },
  });

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  if (cls.status !== "scheduled" && cls.status !== "confirmed") {
    return NextResponse.json(
      { error: "Can only cancel classes with status scheduled or confirmed" },
      { status: 400 }
    );
  }

  // Check cancellation policy
  const now = Date.now();
  const classTime = new Date(cls.scheduledAt).getTime();
  const cancellationDeadline = classTime - cls.cancellationMinutes * 60_000;

  if (now > cancellationDeadline) {
    return NextResponse.json(
      { error: `Cancellation deadline passed. Must cancel at least ${cls.cancellationMinutes} minutes before class.` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { reason } = body as { reason?: string };

  cls.status = "cancelled";
  cls.cancelledAt = new Date();
  cls.cancelReason = reason ?? null;
  await ds.getRepository(Class).save(cls);

  // Update all enrolled ClassStudent statuses
  await ds.getRepository(ClassStudent)
    .createQueryBuilder()
    .update()
    .set({ status: "cancelled" })
    .where("classId = :classId", { classId: cls.id })
    .andWhere("status = :status", { status: "enrolled" })
    .execute();

  // Fire-and-forget: send cancellation emails
  const emailRecipients: string[] = [];

  // Get teacher email
  if (cls.teacherId) {
    const teacherMember = await ds.getRepository(AcademyMember).findOne({
      where: { id: cls.teacherId },
      relations: ["user"],
    });
    if (teacherMember?.user?.email) {
      emailRecipients.push(teacherMember.user.email);
    }
  }

  // Get student emails
  const classStudents = await ds.getRepository(ClassStudent).find({
    where: { classId: cls.id },
    relations: ["student"],
  });
  for (const cs of classStudents) {
    if (cs.student?.email) {
      emailRecipients.push(cs.student.email);
    }
  }

  for (const email of emailRecipients) {
    sendClassCancelled({
      to: email,
      classTitle: cls.title,
      scheduledAt: cls.scheduledAt,
      reason: reason,
    }).catch(() => {});
  }

  return NextResponse.json({
    id: cls.id,
    status: cls.status,
    cancelledAt: cls.cancelledAt,
    cancelReason: cls.cancelReason,
  });
}
