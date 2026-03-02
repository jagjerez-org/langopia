import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { ExerciseTemplate } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/exercises/templates/:id
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const template = await ds.getRepository(ExerciseTemplate).findOne({
    where: { id, academyId: academy.id },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: template.id,
    slug: template.slug,
    name: template.name,
    promptTemplate: template.promptTemplate,
    targetSkill: template.targetSkill,
    isSystem: template.isSystem,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  });
}

// PATCH /api/v1/exercises/templates/:id - Update template
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();
  const repo = ds.getRepository(ExerciseTemplate);

  const template = await repo.findOne({
    where: { id, academyId: academy.id },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.name !== undefined) template.name = body.name;
  if (body.promptTemplate !== undefined) template.promptTemplate = body.promptTemplate;
  if (body.targetSkill !== undefined) template.targetSkill = body.targetSkill;
  if (body.isActive !== undefined) template.isActive = body.isActive;

  const saved = await repo.save(template);

  return NextResponse.json({
    id: saved.id,
    slug: saved.slug,
    name: saved.name,
    promptTemplate: saved.promptTemplate,
    targetSkill: saved.targetSkill,
    isSystem: saved.isSystem,
    isActive: saved.isActive,
    sortOrder: saved.sortOrder,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  });
}

// DELETE /api/v1/exercises/templates/:id - Delete custom template only
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();
  const repo = ds.getRepository(ExerciseTemplate);

  const template = await repo.findOne({
    where: { id, academyId: academy.id },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (template.isSystem) {
    return NextResponse.json(
      { error: "Cannot delete built-in templates. You can deactivate them instead." },
      { status: 400 }
    );
  }

  await repo.remove(template);

  return NextResponse.json({ deleted: true });
}
