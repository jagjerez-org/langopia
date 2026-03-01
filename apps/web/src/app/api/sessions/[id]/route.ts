import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Session } from "@/entities";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const sessionEntity = await ds.getRepository(Session).findOne({
    where: { id },
    relations: ["classroom", "classroom.teacher"],
  });

  if (!sessionEntity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(sessionEntity);
}
