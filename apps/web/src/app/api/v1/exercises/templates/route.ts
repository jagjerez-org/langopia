import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { ExerciseTemplate } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { ensureBuiltInTemplates } from "@/lib/exercise-templates";

// GET /api/v1/exercises/templates - List all templates (lazy-seeds built-ins)
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const templates = await ensureBuiltInTemplates(academy.id);

  return NextResponse.json({
    data: templates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      promptTemplate: t.promptTemplate,
      targetSkill: t.targetSkill,
      isSystem: t.isSystem,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
}

// POST /api/v1/exercises/templates - Create custom template
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const body = await req.json();
  const { name, promptTemplate, targetSkill } = body;

  if (!name || !promptTemplate) {
    return NextResponse.json(
      { error: "name and promptTemplate are required" },
      { status: 400 }
    );
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);

  if (!slug) {
    return NextResponse.json(
      { error: "Could not generate valid slug from name" },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(ExerciseTemplate);

  // Check for duplicate slug
  const existing = await repo.findOne({
    where: { academyId: academy.id, slug },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A template with slug "${slug}" already exists` },
      { status: 409 }
    );
  }

  // Find max sortOrder for this academy
  const maxSort = await repo
    .createQueryBuilder("t")
    .select("MAX(t.sortOrder)", "max")
    .where("t.academyId = :academyId", { academyId: academy.id })
    .getRawOne();

  const template = new ExerciseTemplate();
  template.academyId = academy.id;
  template.slug = slug;
  template.name = name;
  template.promptTemplate = promptTemplate;
  template.targetSkill = targetSkill ?? null;
  template.isSystem = false;
  template.isActive = true;
  template.sortOrder = (maxSort?.max ?? 0) + 1;

  const saved = await repo.save(template);

  return NextResponse.json(
    {
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
    },
    { status: 201 }
  );
}
