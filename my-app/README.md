# Handoff App Runbook (Technical)

Recruiter-facing project overview: **`/Users/jadenwu/Desktop/Hackathon/README.md`**

This file is the implementation runbook for local development of the app bundle in `my-app/`.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js HTTP server (`backend/server.js`)
- Runtime model adapter: OpenAI-compatible provider configuration via backend env

## Implemented Product Surfaces
- **Posts**: create and shortlist candidate outreach opportunities
- **Messages**: live thread view with policy/event timeline and SSE updates
- **Profile**: privacy buckets + questionnaire/topic context management

## Local Run
```bash
cd /Users/jadenwu/Desktop/Hackathon/my-app
npm install
npm run server
npm run dev
```

Default local ports:
- Backend: `http://localhost:8787`
- Frontend (Vite): `http://localhost:5173`

## Key Commands
```bash
# frontend production build check
npm run build

# backend syntax checks
node --check backend/server.js
node --check backend/lib/agents.js
```

## Runtime Notes
- Message orchestration, scoring updates, and policy reason codes are server-authoritative.
- SSE endpoint: `/api/threads/{id}/events`
- Duplicate send suppression and idempotent resend behavior are handled in backend send flow.

## Directory Snapshot
```text
/my-app
├── /backend         # orchestration server + scoring/privacy logic + store
├── /demo-review     # seeded profiles and demo assets
├── /src             # React pages/components/hooks/services/utils
├── package.json
└── README.md
```
