# Handoff: AI-Mediated Matching Platform

Handoff is an AI-enabled social matching demo that simulates how autonomous agents can evaluate compatibility, start conversations, and keep messaging policy-safe in real time.  
The system combines a React frontend, a Node orchestration backend, live event streaming, and reliability guardrails for production-style behavior.  
It is designed as an end-to-end CS/AI project: from model prompting and safety checks to API contracts, session state, and user-facing decision UX.

## Project Overview

Handoff models a multi-stage communication flow:

```text
Post/Profile Context
  -> Candidate Evaluation
  -> Draft/Reply Generation
  -> Privacy Check (approve/rewrite/block)
  -> Send + Session/Event Updates
  -> Compatibility Summary + Recommendation Surface
```

The product experience is split into three surfaces:
- **Posts**: create and rank potential outreach opportunities
- **Messages**: real-time conversation view with policy timeline
- **Profile**: privacy boundaries and preference context controls

## Core Engineering Highlights

- **AI orchestration pipeline**
  - Multi-step backend flow for scoring, drafting, privacy validation, and summary updates (`my-app/backend/server.js`, `my-app/backend/lib/agents.js`).
  - Structured stage/status events to make runtime behavior observable.

- **Safety and policy controls**
  - Reason-coded privacy checks with rewrite/block behavior before messages are sent.
  - Fail-safe behavior for degraded responses and guarded fallback output paths.

- **Reliability guardrails**
  - Duplicate message suppression in the backend send path.
  - Idempotent resend behavior via `client_message_id` caching.
  - Per-thread send locking to prevent race-condition double sends.

- **Real-time system integration**
  - Server-Sent Events stream for thread event updates (`/api/threads/{id}/events`).
  - Frontend event deduplication and session-state reconciliation (`my-app/src/features/messages/useMessagesSession.js`).

## What I Built

- Implemented backend session/message orchestration for AI + human messaging flows.
- Integrated policy-safe messaging with reason-code surfaced states in the UI.
- Built compatibility and recommendation update loops that react to conversation state.
- Added runtime protections for duplicate sends and unstable retry behavior.
- Connected frontend pages to live backend APIs and event streams.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js (HTTP server), SSE for live updates
- **AI Layer**: OpenAI-compatible model adapter + prompt-contract message generation
- **Data Layer**: file-backed demo store for users, threads, sessions, events, and recommendations

## Testing and Quality Checks

Run from `my-app/`:

```bash
npm install
npm run build
node --check backend/server.js
node --check backend/lib/agents.js
```

These checks validate frontend build integrity and backend orchestration syntax.

## Interview Talking Points

- How to design a safe LLM messaging pipeline with explicit policy gates.
- Tradeoffs between deterministic safeguards and model flexibility in real-time chat.
- How idempotency, dedupe, and send locks improve reliability in evented systems.
- How to represent backend state transitions clearly in a live frontend UX.
- How to evolve a demo store into production-ready persistence and observability.

## Current Limitations / Next Steps

- Persistence is demo-oriented (file-backed) and should migrate to a managed database.
- Evaluation and safety metrics can be formalized further with automated regression suites.
- Multi-provider failover and deeper monitoring dashboards are natural next upgrades.

## Quick Start

```bash
cd /Users/jadenwu/Desktop/Hackathon/my-app
npm install
npm run server   # backend on localhost:8787
npm run dev      # frontend on localhost:5173
```

For local implementation details, see `my-app/README.md`.
