# Langopia - Technology Recommendation Plan

## 1. Project Overview

| Attribute | Detail |
|---|---|
| **Product** | SaaS for language academies |
| **Core Features** | Streaming classrooms (1:1 + group), transcription, AI learning reports |
| **Initial Scale** | 1-5 academies, ~10-50 classes/day |
| **Languages** | Global (99+ languages) |
| **Hosting Strategy** | Hybrid: self-host core + cloud APIs for AI services |
| **Tech Stack** | TypeScript + Next.js |
| **UI Tooling** | shadcn/ui + Tailwind CSS + 21st.dev Magic MCP |

## 2. Recommended Architecture

```
                        +------------------+
                        |   Next.js App    |
                        |  (Frontend + API)|
                        +--------+---------+
                                 |
              +------------------+------------------+
              |                  |                  |
     +--------v------+  +-------v-------+  +-------v-------+
     |   LiveKit      |  |  PostgreSQL   |  |  Object Store |
     | (Streaming)    |  |  (Database)   |  |  (S3/MinIO)   |
     +--------+-------+  +---------------+  +---------------+
              |
     +--------v-----------+
     |  AI Pipeline        |
     |  - Deepgram (live)  |
     |  - WhisperX (batch) |
     |  - LLM Analysis     |
     +---------------------+
```

## 3. Core Technology Stack

### 3.1 Frontend & Backend - Next.js (App Router)

| Component | Technology | Why |
|---|---|---|
| **Framework** | Next.js 15+ (App Router) | Full-stack TypeScript, SSR, API routes, great SaaS ecosystem |
| **UI Library** | shadcn/ui + Tailwind CSS | Rapid UI development, professional look, fully customizable |
| **UI Generation** | 21st.dev Magic MCP | AI-powered beautiful component creation |
| **State Management** | Zustand or Jotai | Lightweight, TypeScript-native |
| **Real-time UI** | LiveKit React Components (`@livekit/components-react`) | Pre-built video/audio UI components |
| **Forms** | React Hook Form + Zod | Type-safe validation |
| **Charts/Reports** | Recharts or Tremor | Dashboard visualizations for learning analytics |

### 3.2 Database

| Component | Technology | Why |
|---|---|---|
| **Primary DB** | PostgreSQL | Reliable, feature-rich, excellent JSON support for flexible data |
| **ORM** | Prisma or Drizzle ORM | Type-safe database queries, migrations, great DX |
| **Cache** | Redis (via Upstash) | Session management, real-time state, job queues |

### 3.3 Authentication & Multi-tenancy

| Component | Technology | Why |
|---|---|---|
| **Auth** | NextAuth.js (Auth.js v5) or Clerk | Multi-provider auth (email, Google, SSO) |
| **Multi-tenancy** | Row-level isolation with `academy_id` | Simple, scales well for MVP |
| **Roles** | Academy Admin, Teacher, Student | Built into auth layer |

### 3.4 Payments

| Component | Technology | Why |
|---|---|---|
| **Payments** | Stripe | Industry standard for SaaS subscriptions |
| **Billing Model** | Per-academy subscription + usage-based add-ons | Flexible pricing |

### 3.5 File Storage

| Component | Technology | Why |
|---|---|---|
| **Storage** | AWS S3 or MinIO (self-hosted) | Class recordings, materials, transcription files |
| **CDN** | CloudFront or Cloudflare R2 | Fast delivery of recordings and materials |

### 3.6 Deployment

| Component | Technology | Why |
|---|---|---|
| **App Hosting** | Vercel (Next.js) or Docker + VPS | Vercel for simplicity; VPS for cost control |
| **LiveKit Server** | Docker on VPS (Hetzner/OVH) | Cost-effective for MVP, ~$20-40/month |
| **CI/CD** | GitHub Actions | Free for public/private repos |
| **Monitoring** | Sentry (errors) + Posthog (analytics) | Free tiers available |

## 4. Video Streaming - LiveKit (Open Source)

### Why LiveKit over alternatives

| Solution | Verdict |
|---|---|
| **LiveKit** | **RECOMMENDED** - Modern SFU, Apache 2.0, excellent SDKs, built-in recording, AI Agents framework |
| Jitsi Meet | Good but hard to customize UI, recording (Jibri) is expensive to scale |
| BigBlueButton | Best education features but monolithic, hard to integrate into modern SaaS |
| MediaSoup | Too low-level, massive development effort required |
| OpenVidu | Built on LiveKit anyway, adds limits on free tier |

### LiveKit Key Features for Langopia

- **1-to-1 and group video** with adaptive quality
- **Recording** via Egress service (saves to S3/MinIO)
- **AI Agents** framework for building pronunciation bots and conversation partners
- **Screen sharing** for teaching materials
- **Data channels** for real-time chat
- **Self-host or migrate to LiveKit Cloud** with zero code changes

### LiveKit Integration Example

```typescript
import { AccessToken } from 'livekit-server-sdk';

function createToken(roomName: string, participantName: string) {
  const token = new AccessToken('api-key', 'api-secret', {
    identity: participantName,
  });
  token.addGrant({ roomJoin: true, room: roomName });
  return token.toJwt();
}
```

### What to build on top of LiveKit

- Whiteboard: integrate **tldraw** (open source)
- Chat: use LiveKit data channels or build custom
- Breakout rooms: manage via LiveKit room API
- Lesson materials: shared document viewer

## 5. AI Transcription - Hybrid Architecture

### Tier 1: Live Transcription (During Class) - Deepgram Nova-3

| Attribute | Detail |
|---|---|
| **Purpose** | Real-time subtitles during live classes |
| **Latency** | Sub-300ms |
| **Languages** | 36+ languages (expanding) |
| **Cost** | ~$0.46/hour of streaming audio |
| **Integration** | WebSocket API, connects to LiveKit audio tracks |
| **MVP Cost** | ~$200-400/month at 10-50 classes/day |

### Tier 2: Post-Class Analysis (After Class) - WhisperX

| Attribute | Detail |
|---|---|
| **Purpose** | Detailed analysis with word-level timestamps + speaker diarization |
| **Accuracy** | Whisper Large V3 quality (~7.4% WER) |
| **Languages** | 99+ languages |
| **Key Feature** | Separates teacher vs student speech (pyannote diarization) |
| **Cost** | Self-hosted GPU ~$276/month, or OpenAI Whisper API ($0.006/min) for MVP |
| **Processing** | Async queue - processes recordings after class ends |

### Transcription Pipeline

```
Live Class
    |
    +--> [Deepgram Nova-3] --> Real-time subtitles in UI
    |
    +--> [Audio Recording] --> saved to S3
                                  |
                                  v
                          [WhisperX Pipeline] (async)
                              |
                              +--> Word-level timestamps
                              +--> Speaker diarization (teacher/student)
                              +--> Stored in PostgreSQL
                              |
                              v
                        [AI Analysis Pipeline]
```

### MVP Simplification

For the MVP, use **OpenAI Whisper API** ($0.006/min) for batch processing. Migrate to self-hosted WhisperX when volume exceeds ~500+ hours/month.

## 6. AI Learning Reports

### Analysis Pipeline

| Analysis | Tool | Purpose |
|---|---|---|
| **Vocabulary extraction** | spaCy + CEFR word lists | Identify new words, map to CEFR level (A1-C2) |
| **Grammar detection** | LanguageTool (open source) | Detect grammar mistakes in 30+ languages |
| **Speaking time** | pyannote diarization | Measure student vs teacher talk time |
| **Session summary** | GPT-4o mini / Gemini Flash | Generate class summary and highlights |
| **Improvement areas** | GPT-4o mini / Gemini Flash | Identify weak points, suggest exercises |
| **Progress reports** | GPT-4o / Claude Sonnet | Weekly/monthly deep analysis across sessions |

### LLM Cost Strategy

| Use Case | Volume | Model | Cost/month |
|---|---|---|---|
| Per-class analysis | Every class | GPT-4o mini ($0.15/1M input) | ~$15-30 |
| Exercise generation | On-demand | GPT-4o mini | ~$20-50 |
| Progress reports | Weekly/monthly | GPT-4o ($2.50/1M input) | ~$50-100 |
| **Total LLM costs** | | | **~$85-180/month** |

### Report Features

**Per-Class Report (auto-generated):**
- Class summary (3-5 key points)
- New vocabulary with CEFR levels
- Grammar mistakes with explanations
- Speaking time ratio (student vs teacher)
- Fluency indicators (pauses, filler words)

**Progress Report (weekly/monthly):**
- Vocabulary growth over time
- Grammar improvement trends
- Speaking confidence metrics
- CEFR level progression estimate
- Personalized study recommendations

## 7. Database Schema (Key Entities)

```
Academy
  +-- id, name, plan, settings
  +-- Users (teachers, students, admins)
  |     +-- id, email, role, academy_id
  |     +-- profile, language_preferences
  +-- Classrooms
  |     +-- id, name, type (1:1 | group)
  |     +-- teacher_id, schedule
  |     +-- Sessions[]
  |           +-- id, started_at, ended_at
  |           +-- recording_url, livekit_room_id
  |           +-- Transcriptions[]
  |           |     +-- speaker, text, timestamp
  |           |     +-- word_timestamps (JSON)
  |           +-- ClassReport
  |           |     +-- summary, vocabulary, grammar_errors
  |           |     +-- speaking_metrics, suggestions
  |           +-- Participants[]
  +-- LearningProfiles (per student)
        +-- vocabulary_bank, grammar_patterns
        +-- cefr_level_estimate
        +-- ProgressReports[]
```

## 8. Estimated Monthly Costs (MVP)

| Service | Cost | Notes |
|---|---|---|
| Vercel (Next.js hosting) | $20 | Pro plan |
| VPS for LiveKit | $20-40 | Hetzner/OVH |
| PostgreSQL (managed) | $15-25 | Supabase, Neon, or Railway |
| Redis (Upstash) | $0-10 | Free tier may suffice |
| Deepgram (live transcription) | $200-400 | ~10-50 classes/day x 1hr |
| OpenAI Whisper API (batch) | $50-100 | Post-class processing |
| LLM APIs (reports) | $85-180 | GPT-4o mini + GPT-4o |
| S3 Storage | $10-30 | Recordings and materials |
| Stripe | 2.9% + $0.30 | Per transaction |
| Sentry + Posthog | $0 | Free tiers |
| **Total** | **~$400-800/month** | Excluding Stripe fees |

## 9. Project Structure

```
langopia/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router
│       │   ├── (auth)/         # Login, register
│       │   ├── (dashboard)/    # Academy dashboard
│       │   ├── classroom/      # Video classroom UI
│       │   ├── reports/        # Learning reports
│       │   └── api/            # API routes
│       ├── components/         # UI components (shadcn/ui + 21st.dev)
│       ├── lib/                # Utilities, DB client
│       └── prisma/             # Database schema
├── packages/
│   ├── ai-pipeline/            # Transcription + analysis workers
│   │   ├── transcription/      # Deepgram + WhisperX integration
│   │   ├── analysis/           # NLP + LLM analysis
│   │   └── reports/            # Report generation
│   └── shared/                 # Shared types, utils
├── docker/
│   ├── livekit/                # LiveKit server config
│   └── workers/                # AI pipeline workers
├── docs/                       # Documentation (this file)
├── turbo.json                  # Turborepo config
└── package.json
```

## 10. Development Phases

### Phase 1 - Foundation (Weeks 1-4)
- [ ] Install 21st.dev Magic MCP + set up dev environment
- [ ] Initialize Next.js + Turborepo monorepo
- [ ] Set up PostgreSQL + Prisma schema
- [ ] Implement auth (NextAuth.js) with roles
- [ ] Build academy/user management CRUD
- [ ] Deploy LiveKit server (Docker)

### Phase 2 - Streaming Classroom (Weeks 5-8)
- [ ] Build classroom UI with LiveKit React components + 21st.dev Magic
- [ ] Implement 1-to-1 and group room creation
- [ ] Add screen sharing and basic chat
- [ ] Set up recording (LiveKit Egress -> S3)
- [ ] Integrate tldraw whiteboard

### Phase 3 - Transcription (Weeks 9-12)
- [ ] Set up post-class transcription pipeline (Whisper API)
- [ ] Build transcription storage and viewer
- [ ] Implement speaker diarization (teacher vs student)

### Phase 4 - AI Reports (Weeks 13-16)
- [ ] Build vocabulary extraction pipeline (spaCy)
- [ ] Integrate LanguageTool for grammar analysis
- [ ] Implement LLM-powered session summaries
- [ ] Build per-class report UI with 21st.dev Magic
- [ ] Create student learning profile and progress tracking

### Phase 5 - Polish & Launch (Weeks 17-20)
- [ ] Integrate Stripe subscriptions
- [ ] Build academy admin dashboard
- [ ] Add progress reports (weekly/monthly)
- [ ] Performance optimization and testing
- [ ] Deploy to production

## 11. Technology Summary

| Area | Technology | License | Cost Model |
|---|---|---|---|
| **Frontend** | Next.js + shadcn/ui + Tailwind | MIT | Free |
| **UI Generation** | 21st.dev Magic MCP | API | API key required |
| **Backend** | Next.js API Routes + tRPC | MIT | Free |
| **Database** | PostgreSQL + Prisma | Open Source | Managed ~$15-25/mo |
| **Auth** | NextAuth.js (Auth.js) | ISC | Free |
| **Streaming** | LiveKit | Apache 2.0 | Self-hosted |
| **Live Transcription** | Deepgram Nova-3 | Cloud API | ~$0.46/hr |
| **Batch Transcription** | OpenAI Whisper API -> WhisperX | MIT | API or self-hosted |
| **Speaker Diarization** | pyannote | CC-BY-4.0 | Self-hosted |
| **Grammar Check** | LanguageTool | LGPL | Self-hosted |
| **NLP** | spaCy | MIT | Free |
| **LLM Analysis** | GPT-4o mini + GPT-4o | Cloud API | Pay per token |
| **Payments** | Stripe | N/A | 2.9% + $0.30 |
| **Storage** | S3 / MinIO | Apache 2.0 | Pay per GB |
| **Monorepo** | Turborepo | MIT | Free |
