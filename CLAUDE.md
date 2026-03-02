# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Start all dev services (PostgreSQL, Redis, LiveKit, MinIO, Egress)
docker compose up -d

# Dev server (all workspaces via Turbo)
pnpm dev

# Build
pnpm build

# Lint & type-check
pnpm lint
pnpm type-check

# Run a single workspace
pnpm --filter @langopia/web dev
pnpm --filter @langopia/web build

# Database (from apps/web)
cd apps/web
pnpm db:sync          # Sync schema (dev only)
pnpm db:generate      # Generate migration
pnpm db:migrate       # Run migrations
pnpm db:revert        # Revert last migration
```

## Architecture

**Turborepo monorepo** with pnpm@9.15.4 workspaces:

- `apps/web` — Next.js 16 (App Router, Turbopack) main application
- `packages/shared` — Shared enums (`UserRole`, `SessionStatus`, `ClassroomType`, `Speaker`, `AcademyPlan`) and utils; imported as `@langopia/shared/types` and `@langopia/shared/utils`
- `packages/ai-pipeline` — OpenAI Whisper transcription + GPT-4o analysis; imported as `@langopia/ai-pipeline`

### Multi-tenancy

Academy-based row-level isolation. All entities have an `academyId` FK. Users belong to one academy.

### Auth

NextAuth.js v5 (beta.30) with JWT strategy (6h TTL). Providers: Credentials (bcrypt) and Google OAuth. Config in `apps/web/src/auth.ts`. Middleware in `apps/web/src/middleware.ts` protects routes and enforces role-based access (admin routes require `role === "admin"`).

Auth type augmentation uses `as` assertions in JWT/session callbacks — do NOT use TypeScript module augmentation for JWT types (breaks with pnpm hoisting).

### Database

TypeORM with PostgreSQL 16. DataSource singleton in `apps/web/src/lib/database.ts`.

**Critical**: All 9 entities are consolidated in `apps/web/src/entities/index.ts` (single file). This is intentional — splitting entities into separate files causes circular dependency issues with Turbopack. Do not refactor entities into separate files.

Entities: Academy, User, Classroom, ClassroomEnrollment, Session, Transcription, ClassReport, LearningProfile, ProgressReport.

### Next.js Configuration

`serverExternalPackages` in `next.config.ts` includes: typeorm, reflect-metadata, pg, livekit-server-sdk, openai, stripe, bcryptjs. Any new server-only SDK that uses Node.js APIs must be added here.

`transpilePackages`: @langopia/shared, @langopia/ai-pipeline.

### SDK Client Pattern

All external SDK clients (Stripe, OpenAI, LiveKit) use **lazy initialization** via getter functions (e.g., `getStripe()`, `getOpenAI()`). This avoids build-time errors when env vars are not available. Follow this pattern for any new SDK integrations.

### App Router Layout

- `(dashboard)` route group — sidebar layout for `/dashboard`, `/classroom`, `/reports`, `/settings`, `/profile`, `/admin`
- `(session)` route group — full-screen layout for `/session/[roomId]` (live video)
- `(auth)` route group — public pages for `/login`, `/register`

### Batch Processing Pipeline

Session end triggers: Stop Egress → Batch transcription (Whisper) → Batch analysis (GPT-4o-mini ClassReport + LearningProfile update). This is fire-and-forget — orchestrated in `apps/web/src/lib/batch-transcription.ts` and `apps/web/src/lib/batch-analysis.ts`.

### TypeScript

- `apps/web` tsconfig: `experimentalDecorators` + `emitDecoratorMetadata` enabled (TypeORM), `strictPropertyInitialization: false` (entity decorators), path alias `@/*` → `./src/*`
- ESLint uses flat config format (`eslint.config.mjs`)

### UI Stack

shadcn/ui (New York variant) + Tailwind CSS v4 + Lucide icons. Forms use React Hook Form + Zod. Video UI via `@livekit/components-react`. Whiteboard via `@tldraw/tldraw`.

### Docker Services (dev)

| Service | Port(s) | Credentials |
|---------|---------|-------------|
| PostgreSQL 16 | 5433 | langopia / langopia |
| Redis 7 | 6380 | — |
| LiveKit | 7880 (WS), 7881 (HTTP) | devkey / secret |
| MinIO | 9002 (API), 9003 (Console) | langopia / langopia123 |
| Egress | internal | — |

Env vars are documented in `apps/web/.env.example`.
