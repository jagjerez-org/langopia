# Class Scheduling System Design

**Date**: 2026-03-02
**Status**: Approved

## Overview

Replace the current "Rooms" concept with a full class management and scheduling system. Classes become the primary planning unit, with Rooms serving as the underlying video infrastructure created on-demand.

Key features:
- Class planner with calendar views (day, week, month)
- Academy types: Academy (multi-teacher) vs Freelance (solo teacher)
- Multi-role permission system
- Class booking via API with email notifications
- Per-class cancellation policies
- Teacher management for academy-type organizations

---

## 1. Academy Types

New enum `AcademyType` on the Academy entity:

| Type | Behavior |
|------|----------|
| **ACADEMY** | Organization with multiple teachers. Teachers section visible. Manual teacher assignment per class. |
| **FREELANCE** | Individual teacher. Owner is auto-assigned as teacher for all classes. Teachers section hidden. |

### Schema Change

```
Academy entity:
+ academyType: enum AcademyType (default: ACADEMY)
```

---

## 2. Role & Permission System

### Multi-role per member

Replace `AcademyMember.role` (single enum) with `AcademyMember.roles` (JSONB string array). A member can hold multiple roles simultaneously.

### Roles

| Role | Description |
|------|-------------|
| `owner` | Full control. Always assigned, cannot be removed. |
| `admin` | Manage members, academy settings, plus all permissions below. |
| `teacher` | View assigned classes, access rooms, view reports for own classes. |
| `planner` | Create/edit/cancel classes, assign teachers, manage calendar. |
| `content_creator` | Manage exercises, lessons, learning paths. |
| `staff` | Read-only access to stats, student list, general overview. |

### Permission Map (defined in code)

```typescript
// apps/web/src/lib/permissions.ts

export enum Permission {
  // Academy management
  MANAGE_MEMBERS = "manage_members",
  MANAGE_SETTINGS = "manage_settings",

  // Classes
  CREATE_CLASS = "create_class",
  EDIT_CLASS = "edit_class",
  CANCEL_CLASS = "cancel_class",
  VIEW_ALL_CLASSES = "view_all_classes",
  VIEW_OWN_CLASSES = "view_own_classes",
  JOIN_CLASS = "join_class",

  // Content
  MANAGE_EXERCISES = "manage_exercises",
  MANAGE_LESSONS = "manage_lessons",
  MANAGE_LEARNING_PATHS = "manage_learning_paths",

  // Teachers
  MANAGE_TEACHERS = "manage_teachers",
  INVITE_TEACHER = "invite_teacher",

  // Reports & Students
  VIEW_ALL_REPORTS = "view_all_reports",
  VIEW_OWN_REPORTS = "view_own_reports",
  VIEW_STUDENTS = "view_students",
  VIEW_USAGE = "view_usage",

  // API Keys
  MANAGE_API_KEYS = "manage_api_keys",
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.values(Permission), // all permissions
  admin: [
    Permission.MANAGE_MEMBERS,
    Permission.MANAGE_SETTINGS,
    Permission.CREATE_CLASS,
    Permission.EDIT_CLASS,
    Permission.CANCEL_CLASS,
    Permission.VIEW_ALL_CLASSES,
    Permission.JOIN_CLASS,
    Permission.MANAGE_EXERCISES,
    Permission.MANAGE_LESSONS,
    Permission.MANAGE_LEARNING_PATHS,
    Permission.MANAGE_TEACHERS,
    Permission.INVITE_TEACHER,
    Permission.VIEW_ALL_REPORTS,
    Permission.VIEW_STUDENTS,
    Permission.VIEW_USAGE,
    Permission.MANAGE_API_KEYS,
  ],
  teacher: [
    Permission.VIEW_OWN_CLASSES,
    Permission.JOIN_CLASS,
    Permission.VIEW_OWN_REPORTS,
  ],
  planner: [
    Permission.CREATE_CLASS,
    Permission.EDIT_CLASS,
    Permission.CANCEL_CLASS,
    Permission.VIEW_ALL_CLASSES,
    Permission.VIEW_STUDENTS,
  ],
  content_creator: [
    Permission.MANAGE_EXERCISES,
    Permission.MANAGE_LESSONS,
    Permission.MANAGE_LEARNING_PATHS,
  ],
  staff: [
    Permission.VIEW_ALL_CLASSES,
    Permission.VIEW_STUDENTS,
    Permission.VIEW_ALL_REPORTS,
    Permission.VIEW_USAGE,
  ],
};
```

### Helper function

```typescript
export function hasPermission(roles: string[], permission: Permission): boolean {
  return roles.some(role => ROLE_PERMISSIONS[role]?.includes(permission));
}
```

---

## 3. Class Entity

The Class entity is the primary scheduling unit. It wraps a Room (video infrastructure) with planning metadata.

### Schema

```
Class
├── id (UUID, PK)
├── academyId (FK → Academy)
├── title (varchar 255)
├── description (text, nullable)
├── classType: enum ClassType ("individual" | "group")
├── maxStudents (int, default 1)
├── language (varchar 10, default "en")
├── lessonId (FK → Lesson, nullable)
├── teacherId (FK → AcademyMember, nullable)
├── status: enum ClassStatus
│   ("scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled")
├── scheduledAt (timestamptz)
├── durationMinutes (int, default 60)
├── cancellationMinutes (int, default 60)
├── cancelledAt (timestamptz, nullable)
├── cancelReason (text, nullable)
├── teacherToken (varchar 255, unique)
├── studentToken (varchar 255, unique)
├── roomId (FK → Room, nullable)
├── createdByUserId (FK → User)
├── createdAt (timestamptz)
├── updatedAt (timestamptz)
```

### Relations
- `ManyToOne → Academy`
- `ManyToOne → Lesson` (optional curriculum link)
- `ManyToOne → AcademyMember` as teacher
- `OneToOne → Room` (created on-demand when first participant joins)
- `OneToMany → ClassStudent`
- `ManyToOne → User` (created by)

### ClassStudent (enrollment join table)

```
ClassStudent
├── id (UUID, PK)
├── classId (FK → Class, CASCADE)
├── studentId (FK → Student)
├── status: enum ClassStudentStatus
│   ("enrolled" | "attended" | "no_show" | "cancelled")
├── createdAt (timestamptz)
```

Unique constraint: `(classId, studentId)`

### Room creation flow

1. Class is created with tokens but no Room
2. When teacher/student opens their link, the app:
   - Creates a LiveKit room
   - Creates a Room entity linked to the Class
   - Updates Class status to `in_progress`
3. When class ends, Room goes through post-class pipeline as before

---

## 4. API Endpoints

### Classes CRUD

**POST /api/v1/classes** — Create/book a class
```json
{
  "title": "English B1 - Lesson 3",
  "classType": "individual",
  "language": "en",
  "scheduledAt": "2026-03-15T10:00:00Z",
  "durationMinutes": 60,
  "maxStudents": 1,
  "lessonId": "uuid",
  "teacherId": "uuid",
  "studentEmails": ["student@example.com"],
  "cancellationMinutes": 60
}
```

Response (201):
```json
{
  "id": "class-uuid",
  "status": "scheduled",
  "studentUrl": "https://app/class/xxx?token=s_...",
  "teacherUrl": "https://app/class/xxx?token=t_...",
  "scheduledAt": "2026-03-15T10:00:00Z",
  "teacher": { "id": "...", "name": "..." }
}
```

**GET /api/v1/classes** — List classes
- Query params: `status`, `from`, `to` (date range), `teacherId`, `classType`, `limit`, `offset`
- Response: `{ data: [...], total, limit, offset }`

**GET /api/v1/classes/:id** — Get class detail
- Includes: teacher, students (with status), linked lesson, room info (if created)

**PATCH /api/v1/classes/:id** — Update class (before in_progress)
- Editable: title, description, scheduledAt, durationMinutes, lessonId, teacherId, maxStudents

**DELETE /api/v1/classes/:id** — Delete class (only if not started)

### Cancel

**POST /api/v1/classes/:id/cancel**
```json
{ "reason": "Student requested cancellation" }
```

Validates: `now + cancellationMinutes < scheduledAt`. If valid → status `cancelled`, sends notification emails.

### Teachers (Academy type only)

**GET /api/v1/teachers** — List members with teacher role
**POST /api/v1/teachers** — Invite teacher by email

---

## 5. Email Notifications (Resend)

### Service: `apps/web/src/lib/email.ts`

Lazy-initialized Resend client (follows existing SDK pattern):

```typescript
import { Resend } from "resend";

let resend: Resend | null = null;
export function getResend(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
```

### Email triggers

| Event | Recipients | Content |
|-------|-----------|---------|
| Class created | Teacher + students | Schedule details, room link, lesson info |
| Class cancelled | Teacher + students | Cancellation reason, rescheduling info |
| Class reminder | Teacher + students | 15min before (optional, phase 2) |
| Report ready | Students | Link to class report (phase 2) |

### Templates

Use inline HTML templates initially (no React Email dependency to keep it simple). Can migrate to React Email later.

---

## 6. Dashboard Pages

### /dashboard/classes — Calendar View

Uses **@fullcalendar/react** with plugins:
- `@fullcalendar/daygrid` — month view
- `@fullcalendar/timegrid` — day and week views

Features:
- Default view: week
- Toggle between day / week / month
- Each event shows: title, time, teacher name, class type badge
- Color coding by status:
  - Scheduled → blue
  - Confirmed → green
  - In progress → violet
  - Completed → gray
  - Cancelled → red (strikethrough)
- Click empty slot → create class modal
- Click event → class detail drawer/modal (edit, cancel, enter room)
- "New Class" button → full creation form

### /dashboard/teachers — Teacher Management [ACADEMY type only]

- List of members with `teacher` role
- Invite teacher form (email + name)
- Per-teacher stats: classes taught, hours, students
- Link to teacher's class schedule (filtered calendar)
- Hidden entirely for FREELANCE academy type

### Sidebar

```
── Global ──
   Overview          (LayoutDashboard)
   Usage             (BarChart3)

── Academy ──
   Classes           (Calendar)       → /dashboard/classes
   Learning Paths    (Route)          → /dashboard/learning-paths
   Lessons           (BookOpen)       → /dashboard/lessons
   Exercise Bank     (Dumbbell)       → /dashboard/exercises
   Teachers          (GraduationCap)  → /dashboard/teachers  [ACADEMY only]
   Students          (Users)          → /dashboard/students
   Reports           (FileText)       → /dashboard/reports
   API Keys          (Key)            → /dashboard/api-keys
```

"Rooms" is removed from the sidebar. Rooms are accessed through classes.

---

## 7. Migration Strategy

### Backwards compatibility
- Room entity remains unchanged
- Existing `/api/v1/rooms` endpoints continue working (deprecated)
- Existing rooms have no parent Class (orphaned but functional)

### AcademyMember migration
- `role` (enum) → `roles` (JSONB array)
- Migration maps: `owner` → `["owner"]`, `admin` → `["admin"]`, `teacher` → `["teacher"]`

### Academy migration
- Default `academyType = "academy"` for all existing academies

---

## 8. New Dependencies

```
resend                    — Email service
@fullcalendar/core        — Calendar engine
@fullcalendar/react       — React adapter
@fullcalendar/daygrid     — Month view
@fullcalendar/timegrid    — Day/week views
```

Add `resend` to `serverExternalPackages` in `next.config.ts`.

---

## 9. Implementation Phases

| Phase | Scope | Files |
|-------|-------|-------|
| 1 | Enums + Entities + DB sync | shared/types, entities, database.ts, db-sync.ts |
| 2 | Permissions system + Academy type | permissions.ts, Academy entity, AcademyMember migration |
| 3 | Class API (CRUD + cancel + booking) | /api/v1/classes/*, Class entity flow |
| 4 | Email service (Resend + templates) | email.ts, class creation/cancellation hooks |
| 5 | Dashboard calendar (FullCalendar) | /dashboard/classes, create/edit modals |
| 6 | Teachers page + sidebar update | /dashboard/teachers, sidebar.tsx |

---

## 10. Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `packages/shared/src/types/index.ts` | MODIFY — add AcademyType, ClassStatus, ClassType, ClassStudentStatus, AcademyPermission enums |
| 2 | `apps/web/src/entities/index.ts` | MODIFY — add academyType to Academy, roles to AcademyMember, add Class + ClassStudent entities |
| 3 | `apps/web/src/lib/database.ts` | MODIFY — register Class, ClassStudent |
| 4 | `apps/web/scripts/db-sync.ts` | MODIFY — register Class, ClassStudent |
| 5 | `apps/web/src/lib/permissions.ts` | NEW — Permission enum, ROLE_PERMISSIONS map, hasPermission() |
| 6 | `apps/web/src/lib/email.ts` | NEW — Resend client + sendClassScheduled, sendClassCancelled |
| 7 | `apps/web/src/app/api/v1/classes/route.ts` | NEW — GET (list) + POST (create/book) |
| 8 | `apps/web/src/app/api/v1/classes/[id]/route.ts` | NEW — GET + PATCH + DELETE |
| 9 | `apps/web/src/app/api/v1/classes/[id]/cancel/route.ts` | NEW — POST |
| 10 | `apps/web/src/app/api/v1/teachers/route.ts` | NEW — GET + POST (invite) |
| 11 | `apps/web/src/app/(dashboard)/dashboard/classes/page.tsx` | NEW — Calendar view with FullCalendar |
| 12 | `apps/web/src/app/(dashboard)/dashboard/teachers/page.tsx` | NEW — Teacher management |
| 13 | `apps/web/src/components/sidebar.tsx` | MODIFY — new nav structure, conditional Teachers link |
| 14 | `apps/web/next.config.ts` | MODIFY — add resend to serverExternalPackages |
| 15 | `apps/web/package.json` | MODIFY — add resend, @fullcalendar/* deps |
