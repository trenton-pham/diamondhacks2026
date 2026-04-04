### Stack

#### Frontend
- **Framework**: Next.js 14 + TypeScript + Tailwind CSS
- **Key views**:
  - Onboarding quiz (personality + interests collection)
  - Consent center (per-category privacy toggles)
  - Agent timeline view (live A2A negotiation visualizer for judges)
  - Match report card (score, confidence, reasons, red flags)
- **Real-time**: WebSocket client for live agent event streaming from orchestrator

#### Orchestration Layer
- **Runtime**: Python FastAPI
- **Components**:
  - REST endpoints (agent provisioning, match requests, report retrieval)
  - WebSocket event bus (broadcasts live agent messages to frontend)
  - Session manager (tracks agent state, match session lifecycle)
  - Audit log writer (persists every allow/block PolicyDecision to Supabase)
- **Deployment**: Render (API server)

#### Fetch.ai Agent Runtime — Core Prize Layer
- **SDK**: uAgents Python library
- **Registration**: Agentverse cloud (agents hosted and discoverable)
- **Messaging**: A2A protocol over Agentverse mailbox/messaging
- **Agent roles** (see Section 3 for full topology):
  - Identity agent: register + advertise on Agentverse
  - Profile agent: trait vector builder from user input
  - Policy agent: consent enforcement + claim filtering
  - Negotiation agent: runs A2A compatibility protocol
  - Safety agent: toxicity + risk flag classification
  - Report agent: explainable output composition
- **Contracts enforced**: HandshakeRequest · TraitClaim · CompatibilityResult · PolicyDecision

#### LLM Layer — ASI:One Mini (Fetch.ai Native)
- **Model**: `asi1-mini`
- **API**: OpenAI-compatible interface at `https://api.asi1.ai/v1`
- **Use cases by agent**:
  - **Trait extraction** (Profile agent): parse onboarding answers into normalized trait vectors
  - **Safety classification** (Safety agent): detect sensitive content before outbound share
  - **Explanation generation** (Report agent): produce plain-language compatibility reasons
  - **Confidence scoring**: deterministic rule layer on top of LLM outputs for calibrated scores
- **Fallback**: Groq (swap `base_url` if ASI:One free-tier quota exhausted during demo)
  - Groq is API-compatible; no code changes beyond the base URL swap

#### Storage Layer
- **Provider**: Supabase (Postgres)
- **Tables**:
  - `user_sessions`: auth state, agent address, onboarding completion flag
  - `trait_vectors`: per-user normalized trait data (never exposed cross-user)
  - `policy_decisions`: full audit log of every allow/block/redact action with reason codes
  - `compatibility_results`: final scored reports, dimension breakdowns, confidence, flags
- **Security**: Row-level security (RLS) policies — users can only read their own rows

#### Auth
- **Provider**: Supabase Auth (email/password + OAuth)
- **Policy**: Row-level security enforced at DB layer; agent provisioning gated on auth token

#### Deployment
- **Frontend**: Vercel (Next.js)
- **API / Orchestrator**: Render
- **Agents**: Agentverse cloud (persistent agent hosting + discovery)