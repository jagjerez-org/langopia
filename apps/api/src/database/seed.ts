/**
 * Development seed for Langopia.
 * UPSERT strategy — inserts new data, updates existing data. Safe to run multiple times.
 *
 * Usage:
 *   cd apps/api
 *   pnpm db:seed
 */

import "reflect-metadata";
import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { entities } from "./entities/index.js";

// ─── Deterministic IDs ──────────────────────────────

const ID = {
  user1: "a0000000-0000-0000-0000-000000000001",
  user2: "a0000000-0000-0000-0000-000000000002",
  user3: "a0000000-0000-0000-0000-000000000003",
  academy1: "b0000000-0000-0000-0000-000000000001",
  academy2: "b0000000-0000-0000-0000-000000000002",
  member1: "c0000000-0000-0000-0000-000000000001",
  member2: "c0000000-0000-0000-0000-000000000002",
  member3: "c0000000-0000-0000-0000-000000000003",
  team1: "d0000000-0000-0000-0000-000000000001",
  team2: "d0000000-0000-0000-0000-000000000002",
  team3: "d0000000-0000-0000-0000-000000000003",
  planBasic: "e0000000-0000-0000-0000-000000000001",
  planPremium: "e0000000-0000-0000-0000-000000000002",
  planVip: "e0000000-0000-0000-0000-000000000003",
  planFreelance: "e0000000-0000-0000-0000-000000000004",
  landing1: "e1000000-0000-0000-0000-000000000001",
  landing2: "e1000000-0000-0000-0000-000000000002",
} as const;

function studentId(i: number) {
  return `f0000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function lessonId(i: number) {
  return `f1000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function courseId(i: number) {
  return `f2000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function lpId(i: number) {
  return `f3000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function exerciseId(i: number) {
  return `f4000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function classId(i: number) {
  return `f5000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function subId(i: number) {
  return `f6000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function appId(i: number) {
  return `f7000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function customFieldId(i: number) {
  return `f8000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function usageId(i: number) {
  return `f9000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
}
function classStudentId(classIdx: number, studentIdx: number) {
  return `fa000000-0000-0000-${String(classIdx).padStart(4, "0")}-${String(studentIdx).padStart(12, "0")}`;
}
function courseLessonId(courseIdx: number, lessonIdx: number) {
  return `fb000000-0000-0000-${String(courseIdx).padStart(4, "0")}-${String(lessonIdx).padStart(12, "0")}`;
}
function lpCourseId(lpIdx: number, courseIdx: number) {
  return `fc000000-0000-0000-${String(lpIdx).padStart(4, "0")}-${String(courseIdx).padStart(12, "0")}`;
}

// ─── Helpers ────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function generateToken() {
  return randomUUID().replace(/-/g, "");
}

// ─── Main ───────────────────────────────────────────

async function seed() {
  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities,
    synchronize: true,
    logging: false,
  });

  await ds.initialize();
  console.log("Connected to database\n");

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

  const passwordHash = await bcrypt.hash("password123", 10);

  // ─── Users ──────────────────────────────────────

  console.log("Users...");
  const users = [
    { id: ID.user1, email: "admin@langopia.dev", name: "Maria Garcia", plan: "professional" },
    { id: ID.user2, email: "teacher@langopia.dev", name: "Carlos Lopez", plan: "free" },
    { id: ID.user3, email: "carlos@langopia.dev", name: "Carlos Freelance", plan: "starter" },
  ];

  for (const u of users) {
    await ds.query(
      `INSERT INTO users (id, email, "passwordHash", name, plan, "isActive", "fcmTokens", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, '[]', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = $4, plan = $5, "updatedAt" = NOW()`,
      [u.id, u.email, passwordHash, u.name, u.plan],
    );
  }
  console.log("  3 users upserted");

  // ─── Academies ──────────────────────────────────

  console.log("Academies...");
  const academies = [
    { id: ID.academy1, name: "Lingua Academy", slug: "lingua-academy", type: "academy" },
    { id: ID.academy2, name: "Carlos Languages", slug: "carlos-languages", type: "freelance" },
  ];

  for (const a of academies) {
    await ds.query(
      `INSERT INTO academies (id, name, slug, "apiKey", "academyType", "onboardingCompleted", settings, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, '{}', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3, "academyType" = $5, "updatedAt" = NOW()`,
      [a.id, a.name, a.slug, `lk_${randomUUID().replace(/-/g, "")}`, a.type],
    );
  }
  console.log("  2 academies upserted");

  // ─── Academy Members ────────────────────────────

  console.log("Academy Members...");
  const members = [
    { id: ID.member1, userId: ID.user1, academyId: ID.academy1, roles: ["owner", "admin"] },
    { id: ID.member2, userId: ID.user2, academyId: ID.academy1, roles: ["teacher"] },
    { id: ID.member3, userId: ID.user3, academyId: ID.academy2, roles: ["owner", "teacher"] },
  ];

  for (const m of members) {
    await ds.query(
      `INSERT INTO academy_members (id, "userId", "academyId", roles, "joinedAt")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET roles = $4`,
      [m.id, m.userId, m.academyId, JSON.stringify(m.roles)],
    );
  }
  console.log("  3 members upserted");

  // ─── Team Members ───────────────────────────────

  console.log("Team Members...");
  const allPerms = [
    "CLASSES_VIEW", "CLASSES_CREATE", "CLASSES_EDIT", "CLASSES_CANCEL",
    "COURSES_VIEW", "COURSES_MANAGE", "LESSONS_VIEW", "LESSONS_MANAGE",
    "EXERCISES_VIEW", "EXERCISES_MANAGE", "LEARNING_PATHS_VIEW", "LEARNING_PATHS_MANAGE",
    "MEDIA_VIEW", "MEDIA_MANAGE", "STUDENTS_VIEW", "STUDENTS_CREATE", "STUDENTS_DEACTIVATE",
    "TEACHERS_VIEW", "TEACHERS_APPROVE", "FINANCINGS_VIEW_KPIS", "FINANCINGS_MANAGE_PLANS",
    "TEAM_VIEW", "TEAM_INVITE", "TEAM_EDIT_ROLES", "INTEGRATIONS_VIEW", "INTEGRATIONS_MANAGE",
    "ACADEMY_SETTINGS",
  ];
  const coordPerms = ["CLASSES_VIEW", "CLASSES_CREATE", "CLASSES_EDIT", "STUDENTS_VIEW", "TEACHERS_VIEW"];

  const teamMembers = [
    { id: ID.team1, userId: ID.user1, academyId: ID.academy1, role: "admin", perms: allPerms },
    { id: ID.team2, userId: ID.user2, academyId: ID.academy1, role: "coordinator", perms: coordPerms },
    { id: ID.team3, userId: ID.user3, academyId: ID.academy2, role: "admin", perms: allPerms },
  ];

  for (const tm of teamMembers) {
    await ds.query(
      `INSERT INTO team_members (id, "userId", "academyId", role, permissions, "isActive", "joinedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       ON CONFLICT (id) DO UPDATE SET role = $4, permissions = $5`,
      [tm.id, tm.userId, tm.academyId, tm.role, JSON.stringify(tm.perms)],
    );
  }
  console.log("  3 team members upserted");

  // ─── Levels ─────────────────────────────────────

  console.log("Levels...");
  const levels = [
    { code: "A1", label: "Beginner", order: 0 },
    { code: "A2", label: "Elementary", order: 1 },
    { code: "B1", label: "Intermediate", order: 2 },
    { code: "B2", label: "Upper Intermediate", order: 3 },
    { code: "C1", label: "Advanced", order: 4 },
    { code: "C2", label: "Mastery", order: 5 },
  ];

  for (const acId of [ID.academy1, ID.academy2]) {
    for (const lvl of levels) {
      await ds.query(
        `INSERT INTO academy_levels (id, "academyId", code, label, "sortOrder", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT ("academyId", code) DO UPDATE SET label = $4, "sortOrder" = $5`,
        [randomUUID(), acId, lvl.code, lvl.label, lvl.order],
      );
    }
  }
  console.log("  12 levels upserted (A1-C2 x 2)");

  // ─── Languages ──────────────────────────────────

  console.log("Languages...");
  const languages = [
    { code: "en", name: "English", order: 0 },
    { code: "es", name: "Spanish", order: 1 },
    { code: "fr", name: "French", order: 2 },
  ];

  for (const acId of [ID.academy1, ID.academy2]) {
    for (const lang of languages) {
      await ds.query(
        `INSERT INTO academy_languages (id, "academyId", code, name, "sortOrder", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT ("academyId", code) DO UPDATE SET name = $4, "sortOrder" = $5`,
        [randomUUID(), acId, lang.code, lang.name, lang.order],
      );
    }
  }
  console.log("  6 languages upserted (EN,ES,FR x 2)");

  // ─── Plans ──────────────────────────────────────

  console.log("Plans...");
  const plans = [
    {
      id: ID.planBasic, academyId: ID.academy1, name: "Basic", price: 29, limits: {
        individualClassesPerPeriod: 4, groupClassesPerPeriod: 8, classCancellationsPerPeriod: 2,
        classBookingsPerPeriod: 10, limitPeriod: "monthly",
        accessLearningPath: false, accessAiChat: false, accessGroupClasses: true, accessIndividualClasses: true,
      },
    },
    {
      id: ID.planPremium, academyId: ID.academy1, name: "Premium", price: 59, limits: {
        individualClassesPerPeriod: 8, groupClassesPerPeriod: 16, classCancellationsPerPeriod: 4,
        classBookingsPerPeriod: 20, limitPeriod: "monthly",
        accessLearningPath: true, accessAiChat: false, accessGroupClasses: true, accessIndividualClasses: true,
      },
    },
    {
      id: ID.planVip, academyId: ID.academy1, name: "VIP", price: 99, limits: {
        individualClassesPerPeriod: 20, groupClassesPerPeriod: 40, classCancellationsPerPeriod: 10,
        classBookingsPerPeriod: 50, limitPeriod: "monthly",
        accessLearningPath: true, accessAiChat: true, accessGroupClasses: true, accessIndividualClasses: true,
      },
    },
    {
      id: ID.planFreelance, academyId: ID.academy2, name: "Individual Sessions", price: 35, limits: {
        individualClassesPerPeriod: 8, groupClassesPerPeriod: 0, classCancellationsPerPeriod: 2,
        classBookingsPerPeriod: 10, limitPeriod: "monthly",
        accessLearningPath: true, accessAiChat: false, accessGroupClasses: false, accessIndividualClasses: true,
      },
    },
  ];

  for (const p of plans) {
    await ds.query(
      `INSERT INTO academy_plans (id, "academyId", name, price, currency, periodicity, "isActive", limits, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'EUR', 'monthly', true, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET name = $3, price = $4, limits = $5, "updatedAt" = NOW()`,
      [p.id, p.academyId, p.name, p.price, JSON.stringify(p.limits)],
    );
  }
  console.log("  4 plans upserted");

  // ─── Students ───────────────────────────────────

  console.log("Students...");
  const studentsData = [
    { name: "Emma Wilson", email: "emma@student.dev", cefr: "B1", rooms: 12, min: 720 },
    { name: "Liam Brown", email: "liam@student.dev", cefr: "A2", rooms: 8, min: 480 },
    { name: "Sofia Martinez", email: "sofia@student.dev", cefr: "B2", rooms: 20, min: 1200 },
    { name: "Noah Davis", email: "noah@student.dev", cefr: "A1", rooms: 3, min: 180 },
    { name: "Olivia Johnson", email: "olivia@student.dev", cefr: "C1", rooms: 30, min: 1800 },
    { name: "James Taylor", email: "james@student.dev", cefr: "B1", rooms: 15, min: 900 },
    { name: "Isabella Hernandez", email: "isabella@student.dev", cefr: "A2", rooms: 6, min: 360 },
    { name: "Lucas Anderson", email: "lucas@student.dev", cefr: "B2", rooms: 18, min: 1080 },
    { name: "Mia Thomas", email: "mia@student.dev", cefr: null as string | null, rooms: 1, min: 60, active: false },
    { name: "Ethan Garcia", email: "ethan@student.dev", cefr: "A1", rooms: 2, min: 120 },
  ];

  for (let i = 0; i < studentsData.length; i++) {
    const s = studentsData[i];
    await ds.query(
      `INSERT INTO students (id, "academyId", email, name, "totalRooms", "totalMinutes", "cefrEstimate", "isActive", "firstSeenAt", "lastSeenAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET name = $4, "totalRooms" = $5, "totalMinutes" = $6, "cefrEstimate" = $7, "isActive" = $8, "lastSeenAt" = NOW()`,
      [studentId(i + 1), ID.academy1, s.email, s.name, s.rooms, s.min, s.cefr, s.active !== false, daysAgo(30 + i * 5)],
    );
  }

  // Freelance students
  const freelanceStudents = [
    { name: "Ana Ruiz", email: "ana@student.dev", cefr: "B1", rooms: 10, min: 600 },
    { name: "Pedro Gomez", email: "pedro@student.dev", cefr: "A2", rooms: 5, min: 300 },
  ];
  for (let i = 0; i < freelanceStudents.length; i++) {
    const s = freelanceStudents[i];
    await ds.query(
      `INSERT INTO students (id, "academyId", email, name, "totalRooms", "totalMinutes", "cefrEstimate", "isActive", "firstSeenAt", "lastSeenAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET name = $4, "totalRooms" = $5, "totalMinutes" = $6, "cefrEstimate" = $7, "lastSeenAt" = NOW()`,
      [studentId(100 + i), ID.academy2, s.email, s.name, s.rooms, s.min, s.cefr, daysAgo(30)],
    );
  }
  console.log("  12 students upserted");

  // ─── Student Subscriptions ──────────────────────

  console.log("Subscriptions...");
  for (let i = 0; i < 8; i++) {
    const planId = i < 3 ? ID.planBasic : i < 6 ? ID.planPremium : ID.planVip;
    const status = i === 7 ? "past_due" : "active";
    await ds.query(
      `INSERT INTO student_subscriptions (id, "studentId", "academyPlanId", status, "startDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "academyPlanId" = $3, status = $4, "updatedAt" = NOW()`,
      [subId(i + 1), studentId(i + 1), planId, status, daysAgo(10 + i * 7)],
    );
  }
  console.log("  8 subscriptions upserted");

  // ─── Lessons ────────────────────────────────────

  console.log("Lessons...");
  const lessonsData = [
    { title: "Greetings & Introductions", desc: "Basic English greetings", lang: "en", cefr: "A1" },
    { title: "Daily Routines", desc: "Talk about your day", lang: "en", cefr: "A2" },
    { title: "Travel & Directions", desc: "Navigate and ask directions", lang: "en", cefr: "B1" },
    { title: "Business English Basics", desc: "Professional communication", lang: "en", cefr: "B2" },
    { title: "Advanced Debate Skills", desc: "Argue persuasively", lang: "en", cefr: "C1" },
    { title: "Saludos y Presentaciones", desc: "Saludos basicos en espanol", lang: "es", cefr: "A1" },
    { title: "La Vida Cotidiana", desc: "Rutina diaria", lang: "es", cefr: "A2" },
    { title: "Viajes y Turismo", desc: "Vocabulario para viajar", lang: "es", cefr: "B1" },
    { title: "Salutations et Presentations", desc: "Bases du francais", lang: "fr", cefr: "A1" },
    { title: "La Vie Quotidienne", desc: "Parler de sa journee", lang: "fr", cefr: "A2" },
  ];

  for (let i = 0; i < lessonsData.length; i++) {
    const l = lessonsData[i];
    await ds.query(
      `INSERT INTO lessons (id, "academyId", title, description, language, "cefrLevel", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'ready', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET title = $3, description = $4, language = $5, "cefrLevel" = $6, "updatedAt" = NOW()`,
      [lessonId(i + 1), ID.academy1, l.title, l.desc, l.lang, l.cefr],
    );
  }
  console.log("  10 lessons upserted");

  // ─── Exercises ──────────────────────────────────

  console.log("Exercises...");
  const exercisesData = [
    { type: "fill_blank", skill: "grammar", topic: "Present Simple", lang: "en", cefr: "A1", instr: "Fill in the blank", content: "She ___ (go) to school.", answer: "goes", expl: "3rd person uses -es." },
    { type: "multiple_choice", skill: "vocabulary", topic: "Colors", lang: "en", cefr: "A1", instr: "Choose the color", content: "The sky is ___.", answer: "blue", expl: "Sky is blue.", opts: ["red", "blue", "green", "yellow"] },
    { type: "fill_blank", skill: "grammar", topic: "Past Tense", lang: "en", cefr: "A2", instr: "Past simple", content: "Yesterday I ___ (eat) pizza.", answer: "ate", expl: "Irregular: eat-ate-eaten." },
    { type: "open_ended", skill: "writing", topic: "Daily Routine", lang: "en", cefr: "A2", instr: "Morning routine", content: "Describe your morning.", answer: "Varies", expl: "Use present simple." },
    { type: "multiple_choice", skill: "reading", topic: "Travel", lang: "en", cefr: "B1", instr: "Read and answer", content: "Train: 9:15-11:45. Duration?", answer: "2h30m", expl: "Time calc.", opts: ["2h", "2h30m", "3h", "1h30m"] },
    { type: "fill_blank", skill: "grammar", topic: "Subjuntivo", lang: "es", cefr: "B1", instr: "Completa subjuntivo", content: "Espero que ___ (venir).", answer: "vengas", expl: "Subjuntivo." },
    { type: "multiple_choice", skill: "vocabulary", topic: "Les Couleurs", lang: "fr", cefr: "A1", instr: "Bonne couleur", content: "Le ciel est ___.", answer: "bleu", expl: "Masculin.", opts: ["rouge", "bleu", "vert", "jaune"] },
    { type: "open_ended", skill: "writing", topic: "Business Email", lang: "en", cefr: "B2", instr: "Professional email", content: "Apologize for delay.", answer: "Varies", expl: "Formal register." },
  ];

  for (let i = 0; i < exercisesData.length; i++) {
    const ex = exercisesData[i];
    await ds.query(
      `INSERT INTO exercises (id, "academyId", type, "targetSkill", topic, language, "cefrLevel", instruction, content, "correctAnswer", explanation, options, source, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET type = $3, "targetSkill" = $4, topic = $5, instruction = $8, content = $9, "correctAnswer" = $10, explanation = $11, options = $12, "updatedAt" = NOW()`,
      [exerciseId(i + 1), ID.academy1, ex.type, ex.skill, ex.topic, ex.lang, ex.cefr, ex.instr, ex.content, ex.answer, ex.expl, ex.opts ? JSON.stringify(ex.opts) : null],
    );
  }
  console.log("  8 exercises upserted");

  // ─── Courses ────────────────────────────────────

  console.log("Courses...");
  const coursesData = [
    { title: "English Foundations", desc: "Beginner English", lang: "en", cefr: "A1", hours: 20, lessons: [1, 2] },
    { title: "English Intermediate", desc: "Build English skills", lang: "en", cefr: "B1", hours: 30, lessons: [3, 4] },
    { title: "English Advanced", desc: "Master complex English", lang: "en", cefr: "C1", hours: 40, lessons: [5] },
    { title: "Espanol Basico", desc: "Spanish beginners", lang: "es", cefr: "A1", hours: 20, lessons: [6, 7] },
    { title: "Espanol Intermedio", desc: "Improve Spanish", lang: "es", cefr: "B1", hours: 30, lessons: [8] },
    { title: "Francais Debutant", desc: "French beginners", lang: "fr", cefr: "A1", hours: 20, lessons: [9, 10] },
  ];

  for (let i = 0; i < coursesData.length; i++) {
    const c = coursesData[i];
    const cId = courseId(i + 1);
    await ds.query(
      `INSERT INTO courses (id, "academyId", title, description, language, "cefrLevel", status, "estimatedHours", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET title = $3, description = $4, "estimatedHours" = $7, "updatedAt" = NOW()`,
      [cId, ID.academy1, c.title, c.desc, c.lang, c.cefr, c.hours],
    );

    for (let j = 0; j < c.lessons.length; j++) {
      await ds.query(
        `INSERT INTO course_lessons (id, "courseId", "lessonId", "sortOrder", "createdAt")
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET "sortOrder" = $4`,
        [courseLessonId(i + 1, j), cId, lessonId(c.lessons[j]), j],
      );
    }
  }
  console.log("  6 courses upserted with lesson links");

  // ─── Learning Paths ─────────────────────────────

  console.log("Learning Paths...");
  const lpsData = [
    { title: "English A1 to B2 Journey", desc: "Beginner to upper intermediate", lang: "en", cefr: "A1", courses: [1, 2] },
    { title: "Spanish Beginner Path", desc: "Zero to conversational", lang: "es", cefr: "A1", courses: [4, 5] },
    { title: "French Starter", desc: "First steps in French", lang: "fr", cefr: "A1", courses: [6] },
  ];

  for (let i = 0; i < lpsData.length; i++) {
    const lp = lpsData[i];
    const id = lpId(i + 1);
    await ds.query(
      `INSERT INTO learning_paths (id, "academyId", title, description, language, "cefrLevel", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'published', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET title = $3, description = $4, "updatedAt" = NOW()`,
      [id, ID.academy1, lp.title, lp.desc, lp.lang, lp.cefr],
    );

    for (let j = 0; j < lp.courses.length; j++) {
      await ds.query(
        `INSERT INTO learning_path_courses (id, "learningPathId", "courseId", "sortOrder", "createdAt")
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET "sortOrder" = $4`,
        [lpCourseId(i + 1, j), id, courseId(lp.courses[j]), j],
      );
    }
  }
  console.log("  3 learning paths upserted");

  // ─── Classes ────────────────────────────────────

  console.log("Classes...");
  const classData = [
    { title: "English A1 - Greetings", type: "individual", status: "completed", at: daysAgo(7), dur: 60, lang: "en", max: 1 },
    { title: "English A2 - Routines", type: "individual", status: "completed", at: daysAgo(5), dur: 45, lang: "en", max: 1 },
    { title: "Group B1 - Travel", type: "group", status: "completed", at: daysAgo(3), dur: 90, lang: "en", max: 5 },
    { title: "Spanish A1 - Intro", type: "individual", status: "completed", at: daysAgo(2), dur: 60, lang: "es", max: 1 },
    { title: "English B2 - Business", type: "individual", status: "scheduled", at: daysFromNow(1), dur: 60, lang: "en", max: 1 },
    { title: "Group A2 - Daily Life", type: "group", status: "scheduled", at: daysFromNow(2), dur: 90, lang: "en", max: 8 },
    { title: "English C1 - Debate", type: "individual", status: "scheduled", at: daysFromNow(3), dur: 60, lang: "en", max: 1 },
    { title: "French A1 - Basics", type: "individual", status: "scheduled", at: daysFromNow(5), dur: 45, lang: "fr", max: 1 },
    { title: "Cancelled - Travel ES", type: "individual", status: "cancelled", at: daysFromNow(1), dur: 60, lang: "es", max: 1 },
  ];

  for (let i = 0; i < classData.length; i++) {
    const c = classData[i];
    const cId = classId(i + 1);
    await ds.query(
      `INSERT INTO classes (id, "academyId", "createdByUserId", title, "classType", "maxStudents", language, "teacherId", status, "scheduledAt", "durationMinutes", "teacherToken", "studentToken", "cancelledAt", "cancelReason", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET title = $4, status = $9, "scheduledAt" = $10, "durationMinutes" = $11, "updatedAt" = NOW()`,
      [
        cId, ID.academy1, ID.user1, c.title, c.type, c.max, c.lang, ID.member2,
        c.status, c.at, c.dur, generateToken(), generateToken(),
        c.status === "cancelled" ? new Date() : null,
        c.status === "cancelled" ? "Student requested cancellation" : null,
      ],
    );

    // Enroll students
    const enrollCount = c.type === "group" ? 3 : 1;
    for (let j = 0; j < enrollCount; j++) {
      const csStatus = c.status === "completed" ? "attended" : c.status === "cancelled" ? "cancelled" : "enrolled";
      await ds.query(
        `INSERT INTO class_students (id, "classId", "studentId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET status = $4, "updatedAt" = NOW()`,
        [classStudentId(i + 1, j + 1), cId, studentId(j + 1), csStatus],
      );
    }
  }
  console.log("  9 classes upserted with enrollments");

  // ─── Landings ───────────────────────────────────

  console.log("Landings...");
  const landings = [
    { id: ID.landing1, acId: ID.academy1, color: "#6366f1", bg: "#f8fafc", title: "Welcome to Lingua Academy", desc: "The best place to learn languages online." },
    { id: ID.landing2, acId: ID.academy2, color: "#059669", bg: "#f0fdf4", title: "Learn with Carlos", desc: "Personalized tutoring tailored to your goals." },
  ];

  for (const l of landings) {
    await ds.query(
      `INSERT INTO academy_landings (id, "academyId", "primaryColor", "backgroundColor", "heroTitle", "heroDescription", "showPlans", "showTeacherApplication", "isPublished", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, true, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "primaryColor" = $3, "backgroundColor" = $4, "heroTitle" = $5, "heroDescription" = $6, "updatedAt" = NOW()`,
      [l.id, l.acId, l.color, l.bg, l.title, l.desc],
    );
  }
  console.log("  2 landings upserted");

  // ─── Teacher Applications ───────────────────────

  console.log("Applications...");
  const apps = [
    { id: appId(1), name: "Sarah Bennett", email: "sarah@teacher.dev", phone: "+34612345678", langs: ["English", "Spanish"], exp: "5 years TEFL online", status: "pending" },
    { id: appId(2), name: "Pierre Dubois", email: "pierre@teacher.dev", phone: "+33698765432", langs: ["French", "English"], exp: "3 years Alliance Francaise", status: "pending" },
    { id: appId(3), name: "Ana Rodriguez", email: "ana.r@teacher.dev", phone: "+34687654321", langs: ["Spanish"], exp: "10 years teaching Spanish", status: "approved" },
  ];

  for (const a of apps) {
    await ds.query(
      `INSERT INTO teacher_applications (id, "academyId", "fullName", email, phone, languages, experience, status, "customFields", attachments, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', '[]', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "fullName" = $3, experience = $7, status = $8, "updatedAt" = NOW()`,
      [a.id, ID.academy1, a.name, a.email, a.phone, JSON.stringify(a.langs), a.exp, a.status],
    );
  }
  console.log("  3 applications upserted");

  // ─── Custom Fields ──────────────────────────────

  const customFields = [
    { id: customFieldId(1), name: "Teaching Certificate", type: "text", req: true, opts: [] },
    { id: customFieldId(2), name: "Availability", type: "select", req: true, opts: ["Full-time", "Part-time", "Weekends only"] },
    { id: customFieldId(3), name: "Why teach with us?", type: "textarea", req: false, opts: [] },
  ];

  for (let i = 0; i < customFields.length; i++) {
    const cf = customFields[i];
    await ds.query(
      `INSERT INTO application_custom_fields (id, "academyId", "fieldName", "fieldType", "isRequired", options, "sortOrder", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET "fieldName" = $3, "fieldType" = $4, "isRequired" = $5, options = $6, "sortOrder" = $7`,
      [cf.id, ID.academy1, cf.name, cf.type, cf.req, JSON.stringify(cf.opts), i],
    );
  }
  console.log("  3 custom fields upserted");

  // ─── Usage Records ──────────────────────────────

  console.log("Usage Records...");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const metrics = [
    { metric: "rooms_created", value: 15 },
    { metric: "class_minutes", value: 720 },
    { metric: "ai_reports", value: 8 },
    { metric: "ai_tokens", value: 125000 },
    { metric: "storage_bytes", value: 1073741824 },
    { metric: "tts_characters", value: 15000 },
  ];

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    await ds.query(
      `INSERT INTO usage_records (id, "userId", "academyId", metric, value, period, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET value = $5`,
      [usageId(i + 1), ID.user1, ID.academy1, m.metric, m.value, currentMonth],
    );
  }
  console.log("  6 usage records upserted");

  // ─── Done ───────────────────────────────────────

  await ds.destroy();
  console.log("\nSeed completed successfully!");
  console.log("\nLogin credentials:");
  console.log("  Admin:     admin@langopia.dev / password123");
  console.log("  Teacher:   teacher@langopia.dev / password123");
  console.log("  Freelance: carlos@langopia.dev / password123");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
