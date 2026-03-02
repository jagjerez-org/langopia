# Langopia Redesign - Complete Design Document

## Vision

Langopia is an API-first platform for language academies. Academies create video rooms via API or dashboard, get shareable links for teachers and students, and receive AI-generated post-class reports with per-student metrics, exercises, and homework suggestions.

## 1. Data Model

### User (account holder)
```
User
  ├── id (uuid)
  ├── email (unique)
  ├── passwordHash (nullable - for OAuth users)
  ├── name
  ├── profileImageUrl
  ├── plan: free | starter | professional | enterprise
  ├── stripeCustomerId
  ├── stripeSubscriptionId
  ├── isActive
  ├── lastLoginAt
  ├── createdAt / updatedAt
  └── academyMemberships[] (via academy_members)
```

### Academy
```
Academy
  ├── id (uuid)
  ├── name
  ├── slug (unique)
  ├── apiKey (unique, generated)
  ├── settings (jsonb)
  ├── createdAt / updatedAt
  ├── members[] (via academy_members)
  ├── students[]
  └── rooms[]
```

### AcademyMember (User ↔ Academy many-to-many)
```
AcademyMember
  ├── id (uuid)
  ├── userId
  ├── academyId
  ├── role: owner | admin | teacher
  ├── joinedAt
  └── unique(userId, academyId)
```

### Student (identified by email, no account needed)
```
Student
  ├── id (uuid)
  ├── academyId
  ├── email (unique per academy)
  ├── name
  ├── firstSeenAt
  ├── lastSeenAt
  ├── totalRooms (counter)
  ├── totalMinutes (counter)
  ├── cefrEstimate (updated per report)
  └── unique(academyId, email)
```

### Room (replaces Session)
```
Room
  ├── id (uuid)
  ├── academyId
  ├── createdByUserId
  ├── title
  ├── language
  ├── maxStudents (default: 1)
  ├── teacherToken (unique, for URL)
  ├── studentToken (unique, for URL)
  ├── slides (jsonb - array of URLs)
  ├── status: waiting | active | completed | cancelled
  ├── livekitRoomId
  ├── scheduledAt (nullable)
  ├── startedAt (nullable)
  ├── endedAt (nullable)
  ├── recordingUrl (nullable)
  ├── egressId (nullable)
  ├── whiteboardData (jsonb, nullable - tldraw state)
  ├── createdAt / updatedAt
  ├── participants[] (via room_participants)
  ├── chatMessages[]
  ├── notes (via room_notes)
  └── report (via class_report)
```

### RoomParticipant (tracks who joined)
```
RoomParticipant
  ├── id (uuid)
  ├── roomId
  ├── studentId (nullable - null for teacher)
  ├── userId (nullable - for teacher)
  ├── name
  ├── role: teacher | student
  ├── joinedAt
  ├── leftAt (nullable)
  ├── speakingTimeSeconds (updated on leave)
  └── unique(roomId, studentId) / unique(roomId, userId)
```

### RoomNotes (shared notes during class)
```
RoomNotes
  ├── id (uuid)
  ├── roomId (unique)
  ├── vocabulary (jsonb - [{word, definition, example}])
  ├── corrections (jsonb - [{error, correction, context}])
  ├── homework (text)
  ├── objectives (text)
  ├── updatedAt
```

### ChatMessage
```
ChatMessage
  ├── id (uuid)
  ├── roomId
  ├── senderName
  ├── senderRole: teacher | student
  ├── message (text)
  ├── createdAt
```

### ClassReport (AI-generated post-class)
```
ClassReport
  ├── id (uuid)
  ├── roomId (unique)
  ├── status: processing | completed | failed
  ├── summary (text)
  ├── classDuration (seconds)
  ├── tokensUsed (integer)
  ├── teacher: { name, speakingTime, speakingRatio }
  ├── studentReports (jsonb - array):
  │     [{
  │       studentId, name, email,
  │       speakingTime, speakingRatio, fillerWords,
  │       vocabulary: [{word, cefrLevel, context}],
  │       grammarErrors: [{text, correction, rule, explanation}],
  │       exercises: [{type, instruction, content, options, correctAnswer, explanation, cefrLevel}],
  │       homeworkSuggestions: [string]
  │     }]
  ├── createdAt / updatedAt
```

### Exercise
```
Exercise
  ├── id (uuid)
  ├── academyId
  ├── studentId (nullable - null for general exercises)
  ├── roomId (nullable - null for manually created)
  ├── type: fill_in_blank | multiple_choice | sentence_reorder | error_correction | free_response
  ├── targetSkill: vocabulary | grammar | reading | writing
  ├── topic (varchar - e.g. "past simple irregular verbs")
  ├── instruction (text)
  ├── content (text)
  ├── options (jsonb, nullable)
  ├── correctAnswer (text)
  ├── explanation (text)
  ├── cefrLevel (varchar)
  ├── studentAnswer (nullable)
  ├── isCompleted (boolean)
  ├── isCorrect (boolean, nullable)
  ├── source: ai_live | ai_report | manual
  ├── createdAt / updatedAt
```

### UsageRecord (tracking per user, per academy)
```
UsageRecord
  ├── id (uuid)
  ├── userId
  ├── academyId
  ├── period (varchar - "YYYY-MM")
  ├── metric: rooms_created | class_minutes | ai_reports | ai_tokens | storage_bytes
  ├── value (bigint)
  └── unique(userId, academyId, period, metric)
```

## 2. Plans and Limits

Plans are per user. Limits checked across all user's academies.

| Resource | Free | Starter | Professional | Enterprise |
|----------|------|---------|-------------|------------|
| Academies | 1 | 3 | 10 | Unlimited |
| Rooms/month | 10 | 50 | 200 | Unlimited |
| Class hours/month | 5h | 25h | 100h | Unlimited |
| AI reports/month | 5 | 50 | 200 | Unlimited |
| Max students/room | 2 | 8 | 25 | 50 |
| Storage | 1GB | 10GB | 50GB | 500GB |

## 3. Public API (v1)

Authentication: `Authorization: Bearer <academy_api_key>`

### Rooms
```
POST   /api/v1/rooms              Create room
GET    /api/v1/rooms              List rooms (pagination, filters)
GET    /api/v1/rooms/:id          Get room details
DELETE /api/v1/rooms/:id          Close/cancel room
```

**Create room request:**
```json
{
  "title": "English B2 - Lesson 14",
  "language": "en",
  "maxStudents": 8,
  "slides": [
    "https://docs.google.com/presentation/d/...",
    "https://www.youtube.com/watch?v=..."
  ],
  "scheduledAt": "2026-03-02T15:00:00Z"
}
```

**Create room response:**
```json
{
  "id": "room_abc123",
  "teacherUrl": "https://app.langopia.com/room/abc123?token=t_xxx",
  "studentUrl": "https://app.langopia.com/room/abc123?token=s_yyy",
  "status": "waiting",
  "maxStudents": 8,
  "createdAt": "2026-03-01T...",
  "expiresAt": "2026-03-02T..."
}
```

### Reports
```
GET    /api/v1/rooms/:id/report   Get AI report for room
GET    /api/v1/rooms/:id/chat     Get chat messages
GET    /api/v1/rooms/:id/notes    Get shared notes
```

**Report response:**
```json
{
  "id": "report_xyz",
  "roomId": "room_abc123",
  "status": "completed",
  "summary": "...",
  "classDuration": 3600,
  "teacher": {
    "name": "Prof. López",
    "speakingTime": 470,
    "speakingRatio": 0.39
  },
  "students": [
    {
      "name": "Ana García",
      "email": "ana@email.com",
      "speakingTime": 420,
      "speakingRatio": 0.35,
      "fillerWords": 2,
      "vocabulary": [{"word": "...", "cefrLevel": "B2", "context": "..."}],
      "grammarErrors": [{"text": "...", "correction": "...", "rule": "..."}],
      "exercises": [...],
      "homeworkSuggestions": ["..."]
    }
  ],
  "tokensUsed": 2100,
  "generatedAt": "..."
}
```

### Students
```
GET    /api/v1/students                List students in academy
GET    /api/v1/students/:id            Student details + stats
GET    /api/v1/students/:id/history    All rooms and reports
GET    /api/v1/students/:id/exercises  Student's exercises
```

### Exercises
```
POST   /api/v1/exercises/generate      AI generate by topic
GET    /api/v1/exercises               List exercise bank
GET    /api/v1/exercises/:id           Exercise detail
```

**Generate exercises request:**
```json
{
  "topic": "past simple irregular verbs",
  "cefrLevel": "B1",
  "count": 5,
  "types": ["fill_in_blank", "multiple_choice"],
  "studentId": "optional - for personalized exercises"
}
```

### Usage
```
GET    /api/v1/usage                Current period usage
GET    /api/v1/usage/history        Monthly usage history
```

## 4. Room Experience

### Entry Flow

**Teacher:** Clicks teacherUrl → enters room directly (authenticated via token in URL)

**Student:** Clicks studentUrl → enters name + email → joins room. System auto-creates or recognizes Student record by email within the academy.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Video Grid (adaptive - LiveKit handles layout)     │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Teacher  │  │ Student1│  │ Student2│            │
│  └─────────┘  └─────────┘  └─────────┘            │
│                                                     │
│  [Live subtitles - Whisper in 5s chunks]           │
├─────────────────────────────────────────────────────┤
│ 🎤 📷 🖥️ CC │ Slides │ Board │ Chat │ Notes │ Exercises │
└─────────────────────────────────────────────────────┘
```

### Side Panel Tools

**Slides:**
- List of embedded URLs (Google Slides, YouTube, any URL via iframe)
- Teacher navigates between slides → synced to all students via LiveKit data channel
- Students see current slide (read-only navigation)

**Board (Whiteboard):**
- tldraw collaborative whiteboard
- Both teacher and students can draw
- Teacher can clear board
- Whiteboard state persisted to Room.whiteboardData on room close
- Accessible post-class for review

**Chat:**
- Real-time messages via LiveKit data channels
- Persisted to database (ChatMessage entity)
- Accessible post-class via API

**Notes (teacher-editable, student read-only):**
- Vocabulary: Teacher adds words with definitions during class
- Corrections: Teacher notes student errors in real time
- Homework: Teacher writes assignments
- Objectives: What the class covers
- Saved in real-time (debounced) to RoomNotes entity
- Fed to AI report generation for better context

**Exercises (live, in-class):**
- Teacher opens exercise panel
- Can generate with AI (enter topic → GPT-4o-mini generates instantly)
- Can pick from academy exercise bank
- Teacher sends exercise → overlay appears on student screen
- Student answers → teacher sees response in real time
- Results saved to Exercise entity (source: ai_live)

**CC (Subtitles):**
- Whisper API in 5-second audio chunks
- Semi-transparent overlay on video area
- Toggle on/off from toolbar

### Teacher vs Student Permissions

| Feature | Teacher | Student |
|---------|---------|---------|
| Video/Audio | Full control | Full control |
| Screen share | Always | If teacher permits |
| Slides navigation | Controls for all | View only |
| Whiteboard | Draw + clear | Draw only |
| Chat | Read + write | Read + write |
| Notes | Edit all sections | Read only |
| Exercises | Create + send | Answer |
| CC toggle | Yes | Yes |

## 5. Post-Class Pipeline

```
Room closes
  │
  ├── Stop LiveKit Egress → save recording to MinIO/S3
  ├── Save whiteboard state to Room.whiteboardData
  ├── Save final notes to RoomNotes
  │
  └── Fire-and-forget pipeline:
        │
        ├── Whisper API → full transcription
        │
        ├── AI Diarization (GPT-4o-mini)
        │   └── Map speech segments to participants by name
        │       (uses RoomParticipant names from LiveKit)
        │
        ├── Per-student analysis (GPT-4o-mini):
        │   ├── Speaking metrics (time, ratio, filler words)
        │   ├── Vocabulary extraction with CEFR levels
        │   ├── Grammar error detection with corrections
        │   ├── Personalized exercises based on errors
        │   └── Homework suggestions
        │
        ├── Class summary (GPT-4o-mini)
        │
        ├── Save ClassReport (status: completed)
        ├── Save generated Exercises (source: ai_report)
        ├── Update Student records (totalRooms, totalMinutes, cefrEstimate)
        └── Increment UsageRecord (ai_reports, ai_tokens)
```

## 6. Dashboard SaaS

### Sidebar Navigation
```
📊 Overview          Global metrics across all academies
🏫 Academies         List/create academies
🔑 API Keys          API keys per academy
📈 Usage             Consumption vs plan limits
💳 Billing           Plan management, Stripe
⚙️ Settings          Profile, password

── [Selected Academy] ──
🎥 Rooms             Rooms list, create room
📋 Reports           AI reports with student breakdown
👥 Students          Student directory with history
📝 Exercises         Exercise bank (AI + manual)
```

### Overview Page
- Total rooms, class hours, reports, AI tokens (cards)
- Activity chart last 30 days (rooms created per day)
- Breakdown table by academy (academy → rooms → hours → reports)
- Plan limit alerts ("You've used 8/10 rooms on Free plan")

### Academy Page
- List of user's academies with quick stats
- "Create Academy" button (validated against plan limit)
- Each academy: name, API key (partial), active rooms, total hours

### Rooms Page (per academy)
- Table: title, date, duration, students joined, status, report link
- "Create Room" button (form: title, language, maxStudents, slides URLs)
- Shows teacherUrl + studentUrl with copy buttons after creation
- Filters: by status, date range

### Reports Page (per academy)
- List of reports with status (processing/completed/failed)
- Click to view full report with per-student breakdown
- Re-generate button for failed reports

### Students Page (per academy)
- Directory: name, email, total rooms, total hours, CEFR estimate, last seen
- Click student → full history: all rooms attended, all reports, exercise results
- CEFR progression chart over time

### Exercises Page (per academy)
- Filter by: student, topic, type, CEFR level, source (ai_live/ai_report/manual)
- Generate new exercises by topic
- Stats: completion rate, accuracy by student

### Usage Page
- Progress bars: rooms/limit, hours/limit, reports/limit, tokens/limit
- Monthly history table
- Breakdown by academy
- AI token cost estimate

### Billing Page
- Current plan with limits
- Upgrade/downgrade buttons
- Stripe customer portal link
- Invoice history

## 7. Key Technical Decisions

- **API keys per academy** (not per user) for isolation
- **Student identity by email** within academy scope (no account needed)
- **Room URLs with tokens** - no auth required for room entry
- **LiveKit data channels** for real-time sync (slides, exercises, whiteboard)
- **Whisper API** for both live subtitles and batch transcription (no Deepgram)
- **GPT-4o-mini** for per-class analysis and exercises, **GPT-4o** for progress reports
- **Fire-and-forget pipeline** for post-class processing
- **UsageRecord table** for metered billing and limit enforcement
- **tldraw** for collaborative whiteboard with JSON persistence
