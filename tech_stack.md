### Stack

#### Frontend
- **Framework**: Next.js 14 + TypeScript + Tailwind CSS
- **Key views**:
  - Human-only feed (AI read-only)
  - Consent center (topic policy builder: allowed/sensitive/blocked)
  - Agent timeline view (turn-by-turn state machine events)
  - Match report card (score, confidence, green/yellow/red flags)
- **Real-time**: WebSocket client for live orchestration events

#### Orchestration Layer
- **Runtime**: Python FastAPI
- **Components**:
  - REST endpoints (candidate evaluation, session start/stop, report retrieval)
  - WebSocket event bus (state transitions + audit-safe events)
  - Session manager (message cap, retry cap, timeout/dead-letter handling)
  - Policy engine adapter (inbound/outbound privacy checks + redaction)
  - Audit log writer (reason-coded decisions + config snapshots)
- **Deployment**: Render

#### Multi-Model Agent Runtime (Non-Fetch)
- **Pattern**: app-level orchestration of 4 LLM roles, each with role-specific prompts
- **Roles**:
  - `OutreachEvaluatorAgent`
  - `TextingAgent`
  - `PrivacyAgent`
  - `SummaryAgent`
- **Turn contract**:
  - `candidate_select -> evaluator_decision -> texting_draft -> privacy_check -> send|rewrite|drop -> summary_update`
- **Reliability controls**:
  - Idempotency key per stage (`session_id:turn_index:stage`)
  - Per-stage timeout and bounded retry
  - Dead-letter queue for exhausted retries/timeouts

#### Model Layer
- **Primary providers**: OpenAI-compatible APIs for Qwen/Claude-class models
- **Routing policy**:
  - Evaluator: low-latency model
  - Texting: balanced quality/cost model
  - Privacy: stricter model configuration (lower temperature)
  - Summary: higher-quality model
- **Fallback order**: provider A -> provider B -> fail-closed
- **Circuit breaker**:
  - trip after rolling error threshold
  - cooldown window before re-enable
- **Deterministic run snapshot**:
  - model ID/version per role
  - prompt version/hash per role
  - schema version/hash
  - runtime params (`temperature`, `top_p`, `max_tokens`)

#### Storage Layer
- **Provider**: Supabase (Postgres)
- **Core tables**:
  - `sessions` (lifecycle, limits, status)
  - `turn_events` (state transitions, idempotency keys, timing)
  - `message_attempts` (draft, privacy result, retries, final action)
  - `policy_decisions` (status, violation codes, rewrite guidance hash)
  - `summary_reports` (score, confidence, flags, report snapshot hash)
  - `config_snapshots` (model/prompt/schema/runtime versions)
- **Security**:
  - Row-level security (RLS)
  - encrypted at rest
  - no sensitive plaintext in audit logs

#### User Profile Topic Store (Read-Only Context)
- **Format**: Per-user directory of topic-specific markdown files
- **Storage**: File-based (Supabase Storage or local filesystem), one directory per `user_id`
- **Directory structure**:
  ```
  profiles/{user_id}/
    hobbies.md
    values.md
    interests.md
    humor.md
    dealbreakers.md
    communication_style.md
    lifestyle.md
    goals.md
  ```
- **Write path (ingestion only)**: During onboarding, the user uploads their text message history (iMessage, WhatsApp, SMS backup, etc.). The **Text Sorter** (`text_sorter.md`) parses, classifies, summarizes, and privacy-reviews the chat logs, then generates the corresponding markdown files. **No agent writes to these files at runtime.**
- **Read path**: The Texting Agent retrieves 1-3 topic files per turn based on conversation context (RAG-like selection) to use as grounding context for draft generation
- **Constraints**:
  - Files are immutable after ingestion (read-only at runtime)
  - Each file includes metadata: `generated_at`, `source_message_count`
  - Topic files are subject to the same retention/deletion TTLs as other user data
  - Hard delete of a user removes their entire profile directory
  - User can re-upload chat logs to regenerate topic files

#### Auth
- **Provider**: Supabase Auth
- **Policy**: session creation and privacy policy changes require authenticated user context

#### Deployment
- **Frontend**: Vercel
- **API/Orchestrator**: Render
- **Database/Auth**: Supabase

#### Performance Budgets (MVP Defaults)
- **Latency (p95)**:
  - Evaluator <= 1200ms
  - Texting <= 1800ms
  - Privacy <= 1000ms
  - Summary update <= 2200ms
- **Token budgets (per turn)**:
  - Evaluator <= 700 input / 120 output
  - Texting <= 1400 input / 220 output
  - Privacy <= 900 input / 140 output
  - Summary <= 1800 input / 260 output
