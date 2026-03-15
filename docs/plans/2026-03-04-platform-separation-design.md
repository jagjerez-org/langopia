# Platform Separation: NestJS API + Next.js Web + Expo Mobile

**Date:** 2026-03-04
**Status:** Approved

## Motivation

Three drivers for separating the current monolithic `apps/web` (Next.js with API routes + dashboard + landing):

1. **Mobile app** — Build a native Expo app for students and teachers
2. **Independent scaling** — Deploy backend (K3s), frontend (Vercel/CDN), and mobile independently
3. **Team boundaries** — Clean separation for backend, frontend, and mobile developers

## Architecture Overview

```
                    ┌─────────────┐
                    │   Landing   │  Next.js (SSG/SSR)
                    │  SEO pages  │  langopia.com
                    └──────┬──────┘
                           │ (links to app.langopia.com)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐   ┌───────▼──────┐   ┌───────▼──────┐
│  Web (Next)  │   │ Mobile (Expo)│   │  Public API  │
│  SaaS Dash   │   │  Students +  │   │  (3rd party) │
│  + App       │   │  Teachers    │   │  integrations│
└───────┬──────┘   └───────┬──────┘   └───────┬──────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │ REST / WebSocket
                    ┌──────▼──────┐
                    │  NestJS API │
                    │  (backend)  │
                    ├─────────────┤
                    │ Auth (JWT)  │
                    │ TypeORM     │
                    │ AI Pipeline │
                    │ WebSockets  │
                    │ S3/MinIO    │
                    │ Stripe      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐  ┌────▼───┐  ┌─────▼────┐
         │ PG 16  │  │ Redis  │  │  MinIO   │
         │pgvector│  │ cache  │  │  storage │
         └────────┘  └────────┘  └──────────┘
```

**Principles:**
- NestJS API is the single source of truth. All apps are pure clients.
- Landing is fully independent — own app, SSG/SSR, deployable on Vercel. No shared SaaS code.
- Web dashboard becomes a pure client (Next.js for routing/hosting, no API routes).
- Expo mobile consumes the same REST API as web.
- `packages/shared` is shared between API, web, and mobile (types, enums, constants).

## Monorepo Structure

```
langopia/
├── apps/
│   ├── api/              # NestJS backend (all API endpoints)
│   ├── web/              # Next.js SaaS dashboard + student/teacher app
│   ├── landing/          # Next.js landing + SEO (SSG/SSR)
│   └── mobile/           # Expo React Native app
├── packages/
│   ├── shared/           # Types, enums, constants (@langopia/shared)
│   ├── api-client/       # Type-safe API client (@langopia/api-client)
│   └── ai-pipeline/      # AI processing library (@langopia/ai-pipeline)
└── turbo.json
```

## Authentication

NestJS handles all auth centrally:
- **JWT strategy** — For web and mobile users (login, register, Google OAuth)
- **API-key strategy** — For 3rd party integrations (existing academy apiKey)
- JWT issued by NestJS, stored in localStorage (web) / SecureStore (mobile)
- Refresh token rotation for long-lived sessions
- NextAuth is removed from web; replaced by JWT flow against NestJS `/auth/*`

## Web App Route Groups

```
apps/web/
├── (auth)/           # /login, /register (public)
├── (dashboard)/      # /dashboard/* (admin, content_creator, planner)
│   ├── academy settings, manage teachers
│   ├── exercise bank, media library
│   ├── lesson builder, learning paths
│   ├── API keys, usage, billing
│   └── reports
└── (app)/            # /app/* (student, teacher)
    ├── my classes (schedule)
    ├── join class (video room)
    ├── do exercises
    ├── my progress / reports
    ├── profile
    └── notifications
```

- `(dashboard)` — Academy management (admin roles only, web-only)
- `(app)` — Student/teacher experience. **This is what mobile replicates.**
- Mobile and web share the same API calls via `@langopia/api-client`
- UI is platform-specific: shadcn/ui on web, NativeWind on mobile

## NestJS Backend Structure

```
apps/api/
├── src/
│   ├── main.ts                    # Bootstrap, CORS, Swagger
│   ├── app.module.ts
│   │
│   ├── auth/                      # AuthModule
│   │   ├── auth.controller.ts     # /auth/login, /auth/register, /auth/refresh, /auth/google
│   │   ├── auth.service.ts        # JWT issuance, bcrypt, Google OAuth verify
│   │   ├── jwt.strategy.ts        # Passport JWT strategy
│   │   ├── api-key.strategy.ts    # Passport API-key strategy
│   │   └── guards/                # JwtAuthGuard, ApiKeyGuard, RolesGuard
│   │
│   ├── users/                     # UsersModule
│   ├── academies/                 # AcademiesModule (+ members, roles)
│   ├── students/                  # StudentsModule
│   │
│   ├── classes/                   # ClassesModule
│   │   ├── classes.controller.ts  # CRUD + cancel + schedule
│   │   └── classes.service.ts     # Business logic, email triggers
│   │
│   ├── rooms/                     # RoomsModule
│   │   ├── rooms.controller.ts    # Create, join, end
│   │   ├── rooms.gateway.ts       # WebSocket gateway (chat, notes)
│   │   └── rooms.service.ts       # LiveKit token gen, recording
│   │
│   ├── exercises/                 # ExercisesModule
│   │   ├── exercises.controller.ts
│   │   └── exercises.service.ts   # AI generation, embeddings, dedup
│   │
│   ├── lessons/                   # LessonsModule
│   ├── learning-paths/            # LearningPathsModule
│   ├── media/                     # MediaModule
│   ├── reports/                   # ReportsModule
│   │
│   ├── ai/                        # AIModule (wraps @langopia/ai-pipeline)
│   │   ├── ai.service.ts          # Whisper, GPT-4o, embeddings
│   │   └── tts.service.ts         # ElevenLabs TTS
│   │
│   ├── billing/                   # BillingModule
│   │   ├── billing.controller.ts  # Stripe checkout, portal
│   │   └── stripe-webhook.ctrl.ts
│   │
│   ├── storage/                   # StorageModule (S3/MinIO)
│   ├── email/                     # EmailModule (Resend)
│   ├── usage/                     # UsageModule (metering + plan limits)
│   │
│   ├── common/                    # Shared decorators, pipes, filters
│   │   ├── decorators/            # @CurrentUser(), @Academy(), @Roles()
│   │   ├── pipes/                 # ValidationPipe
│   │   ├── filters/               # HttpExceptionFilter
│   │   └── interceptors/          # AcademyScopeInterceptor (multi-tenancy)
│   │
│   └── database/
│       ├── database.module.ts     # TypeORM config
│       └── entities/              # 20 entities (can split into files in NestJS)
│
├── test/                          # E2E tests
├── nest-cli.json
└── package.json
```

**Key design decisions:**
- Multi-tenancy via `AcademyScopeInterceptor` — injects `academyId` in all queries automatically
- Entities can be split into separate files (no Turbopack circular dep issue in NestJS)
- WebSocket gateway in `rooms.gateway.ts` replaces HTTP polling for chat/notes
- `@langopia/ai-pipeline` is imported directly — not rewritten

## Shared API Client

```
packages/api-client/               # @langopia/api-client
├── src/
│   ├── client.ts                  # createApiClient() factory
│   ├── types.ts                   # Re-exports from @langopia/shared
│   │
│   ├── auth.ts                    # login(), register(), refreshToken(), loginWithGoogle()
│   ├── classes.ts                 # getMyClasses(), getClass(), joinClass()
│   ├── rooms.ts                   # getRoomToken(), endRoom()
│   ├── exercises.ts               # getExercises(), submitAnswer(), getNextExercise()
│   ├── lessons.ts                 # getLessons(), getLesson(), getLessonExercises()
│   ├── learning-paths.ts          # getPaths(), getPath(), getPathProgress()
│   ├── reports.ts                 # getMyReports(), getClassReport()
│   ├── media.ts                   # uploadMedia(), getMedia(), searchMedia()
│   ├── profile.ts                 # getProfile(), updateProfile()
│   ├── students.ts                # getStudents(), getStudent()
│   ├── notifications.ts           # getNotifications(), markRead()
│   │
│   ├── admin/                     # Admin-only (used by web dashboard only)
│   │   ├── academies.ts
│   │   ├── teachers.ts
│   │   ├── exercise-bank.ts
│   │   ├── billing.ts
│   │   └── api-keys.ts
│   │
│   └── index.ts
└── package.json
```

**Usage pattern:**

```ts
// Base client — pure TypeScript, no React/RN deps
const api = createApiClient({
  baseUrl: "https://api.langopia.com",
  getToken: () => /* platform-specific token retrieval */,
  onTokenExpired: () => /* platform-specific redirect to login */,
});

// Same calls from web or mobile
const classes = await api.classes.getMyClasses();
const exercises = await api.exercises.getExercises(lessonId);
```

Web uses `localStorage` for token storage; mobile uses `expo-secure-store`.

## Migration Plan

### Phase 1: NestJS API (coexistence)

Both NestJS and current Next.js API routes run against the same database.

**Tasks:**
1. Scaffold `apps/api` with NestJS + TypeORM (same DB, same entities)
2. Migrate module by module: Auth → Users → Academies → Classes → Rooms → Exercises → Lessons → Media → Reports → Billing
3. Each module gets e2e tests against the shared DB
4. `apps/web` keeps working with its existing API routes throughout
5. Auto-generated Swagger from NestJS decorators

**Done when:** All `/api/v1/*` endpoints replicated in NestJS with passing tests.

### Phase 2: Web client migration

**Tasks:**
1. Create `packages/api-client` with typed modules
2. Replace `fetch("/api/v1/...")` → `api.exercises.list()` in every dashboard page
3. Replace NextAuth with JWT flow against NestJS `/auth/*`
4. Create `(app)/` route group with student/teacher pages
5. Delete all API routes from `apps/web` (becomes a pure client)

**Done when:** `apps/web` has zero files in `src/app/api/`. Everything goes through `@langopia/api-client`.

### Phase 3: Landing separation (parallel with Phase 2)

**Tasks:**
1. Scaffold `apps/landing` with clean Next.js
2. Move landing page, pricing, features to new app
3. Domain setup: `langopia.com` → landing, `app.langopia.com` → web
4. Landing links to `app.langopia.com/login` and `/register`

**Done when:** Landing independently deployable with zero imports from `@langopia/api-client` or entities.

### Phase 4: Expo Mobile

**Tasks:**
1. Scaffold `apps/mobile` with Expo Router
2. Auth flow: login → SecureStore token → api-client
3. Screens: Classes → Exercises → Reports → Profile
4. Video: `@livekit/react-native` for live rooms
5. Push notifications via Expo + NestJS notifications module
6. Offline: cache exercises with MMKV/SQLite local

**Done when:** App publishable on TestFlight / Play Store internal track.

### Phase dependency graph

```
Phase 1 (NestJS API)
    ↓
Phase 2 (Web client) ──── Phase 3 (Landing) [parallel]
    ↓
Phase 4 (Expo Mobile)
```

## Domain & Deployment

| App | Domain | Deploy target |
|-----|--------|---------------|
| Landing | `langopia.com` | Vercel (SSG/SSR) |
| Web SaaS | `app.langopia.com` | Vercel or K3s |
| API | `api.langopia.com` | K3s (existing cluster) |
| Mobile | App Store / Play Store | EAS Build |

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | NestJS | Module system, decorators, Swagger, guards/interceptors, TypeORM native support |
| Auth | JWT from NestJS | Single auth source for all clients, no NextAuth dependency |
| Code sharing | `@langopia/api-client` (pure TS) | Same API calls from web and mobile, no framework coupling |
| UI sharing | Separate per platform | shadcn/ui on web, NativeWind on mobile. Business logic shared, UI is not |
| Migration | Incremental (4 phases) | App stays live throughout, each phase is independently deployable |
| Landing | Separate Next.js app | Independent SEO optimization, no SaaS dependencies, separate deploy cycle |
| Entities in NestJS | Split into files | No Turbopack issue in NestJS — entities can be individual files |
| Real-time (rooms) | NestJS WebSocket Gateway | Native support, replaces HTTP polling for chat/notes |
