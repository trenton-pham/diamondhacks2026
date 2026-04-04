# One-File PRD Package

This is the canonical, shareable PRD for the current system. It replaces legacy Fetch.ai assumptions with a non-Fetch 4-agent LLM architecture.

---

# Merged Team Alignment Doc
## 4-Model Social Match System (Canonical)

## 1. Product Direction
We are building a privacy-first social matching platform where public feed content is human-only, and AI agents privately evaluate and converse before suggesting human handoff.

Core principles:
- Human-only posting surface.
- Four specialized LLM agents with app-level orchestration.
- Policy checks before every send (outbound and inbound).
- Explainable outputs under strict privacy constraints.

## 2. Source of Truth and Doc Priority
- This file (`ONE_FILE_PRD_DISCORD.md`) is source of truth.
- `OUTPUT_SCORING_PRIVACY_PLAN.md` is normative for scoring/privacy guardrails.
- `tech_stack.md` is normative for deployment/runtime implementation details.
- Any legacy Fetch/Agentverse assumptions are deprecated.

## 3. MVP Scope Lock
- Feed contains human posts only.
- AI can read posts and run private agent-to-agent conversations.
- AI cannot post publicly to the feed.
- Topic-level privacy policies are mandatory before session messaging.
- All AI-generated content is clearly labeled.
- Session limits are mandatory and enforced server-side.

## 4. 4-Agent Architecture
### Roles
- `OutreachEvaluatorAgent`
  - Scores candidate posts and decides connect vs skip.
- `TextingAgent`
  - Produces outreach and follow-up drafts.
- `PrivacyAgent`
  - Enforces policy taxonomy and returns pass/reject/redact.
- `SummaryAgent`
  - Produces score, confidence, flags, summary, recommended next step.

### Canonical turn lifecycle (state machine)
`candidate_select -> evaluator_decision -> texting_draft -> privacy_check_outbound -> send|rewrite|drop -> privacy_check_inbound -> summary_update`

Lifecycle rules:
- `max_messages = 150` counts both sent and received approved messages.
- Rejected drafts do not count toward `max_messages`; they count toward retry budget.
- `max_privacy_retries = 3` per turn.
- Per-stage timeout defaults:
  - evaluator: 3s
  - texting: 5s
  - privacy: 3s
  - summary_update: 6s
- Retry policy:
  - max 2 infra retries per stage (timeout/transient failure)
  - policy rejections use privacy retry budget only
- Dead-letter policy:
  - exhausted retries or repeated timeout -> drop turn, emit `retry_exhausted_drop` or `timeout_stage_<name>`
- Idempotency:
  - every stage uses key `session_id:turn_index:stage`
  - duplicate key executes no-op replay and returns previous result

## 5. Public Interfaces / Types
### `EvaluatorDecision`
- `post_id`
- `candidate_user_id`
- `connect_score` (0-1)
- `decision` (`connect` | `skip`)
- `reason_tags[]`
- `evaluator_confidence` (0-1)

### `TextDraft`
- `session_id`
- `turn_index`
- `draft_text`
- `intent_tag`
- `retrieved_topics[]` (which topic profile files were used as context)

### `PrivacyCheckResult`
- `status` (`pass` | `reject` | `redact`)
- `violations[]`
- `rewrite_guidance`
- `direction` (`outbound` | `inbound`)

### `SummaryReport`
- `overall_score` (0-100)
- `confidence` (0-1)
- `green_flags[]`
- `yellow_flags[]`
- `red_flags[]`
- `conversation_summary`
- `recommended_next_step`
- `snapshot_hash`

### `SessionLimits`
- `max_messages = 150`
- `max_privacy_retries = 3`
- `max_session_duration_minutes = 120`

## 6. Privacy Policy Contract (Taxonomy + Precedence)
### Taxonomy
- `blocked`: never send in any form.
- `sensitive`: may only appear in generalized, non-identifying form if consented.
- `allowed`: permitted if no higher-priority violation exists.

### Precedence
1. `blocked`
2. `sensitive`
3. `allowed`

### Violation reason code registry
- `policy_config_missing_or_invalid`
- `blocked_topic:<topic>`
- `sensitive_topic_requires_generalization:<topic>`
- `personal_identifier_detected`
- `unique_incident_reference_detected`
- `external_contact_request_blocked`
- `harassment_or_manipulation_detected`
- `safety_uncertain_review_required`
- `retry_exhausted_drop`
- `session_limit_reached`
- `timeout_stage_<stage_name>`
- `idempotency_conflict`

## 7. Evaluator and Ranking Contract
- Connect decision threshold:
  - `connect` when `connect_score >= 0.62` and evidence gate passes.
  - else `skip`.
- Ranking policy:
  - sort by `connect_score` desc
  - tie-break by `evaluator_confidence` desc
  - second tie-break by post freshness bucket
- Anti-spam/outreach controls:
  - max 3 outreach attempts per target per 24h
  - 12h cooldown after rejected outreach
  - suppress duplicate outreach for same `post_id` and target

## 8. Summary/Scoring Contract
- Summary Agent input allowlist:
  - privacy-approved transcript events
  - evaluator decision metadata
  - policy-safe aggregate features
  - session outcomes (retries, drops)
- Summary input denylist:
  - blocked or redacted raw spans
  - direct identifiers and unique incidents
  - internal model reasoning traces

Scoring formulas:
- `dim_score_d = sum(w_i * sim_i * conf_i) / sum(w_i * conf_i)`
- `reliability_d = min(1, support_count_d / support_threshold_d)`
- `adjusted_dim_d = dim_score_d * reliability_d`
- `overall_score = 100 * sum(W_d * adjusted_dim_d) / sum(W_d)`
- `confidence = 0.4*evidence + 0.35*consistency + 0.25*(1-uncertainty)`

Recommendation bands:
- Strong fit: score >= 75 and confidence >= 0.70
- Proceed with caution-positive: score 60-74 or confidence 0.55-0.69
- Low confidence/mismatch risk: score < 60 or confidence < 0.55

Reproducibility/stability requirements:
- same transcript + same config snapshot -> same recommendation tier
- `overall_score` drift <= 2 points
- confidence drift <= 0.03
- no flag severity class changes without snapshot change

## 9. Training and Eval Execution Plan
### MVP default
- Prompt-only role cards (4 markdown specs) + strict schema validation + eval harness.

### Dataset schema
- `sample_id`, `role`, `input_payload`, `expected_output`, `label_source`, `policy_tags`, `split`

### Promotion gates
- Evaluator precision >= 0.78 and recall >= 0.70
- Privacy violation catch rate >= 0.97
- Summary consistency >= 0.90 tier agreement on reruns
- zero critical privacy regressions

### Cadence and ownership
- pre-merge regression for prompt/model changes
- nightly full eval run + drift report
- team ownership:
  - Agent Logic Team: evaluator/texting
  - Privacy/Safety Team: policy checks
  - Summary/Scoring Team: report stability

## 10. Runtime Model Policy and Optimization
- Per-role model routing is allowed.
- Fallback order: provider A -> provider B -> fail-closed.
- Circuit breaker: trip on rolling provider failure threshold, then cooldown.
- Deterministic snapshot stored per run:
  - model ID/version per role
  - prompt hash per role
  - schema hash
  - runtime params (`temperature`, `top_p`, `max_tokens`)

Performance budgets (p95):
- Evaluator <= 1200ms
- Texting <= 1800ms
- Privacy <= 1000ms
- Summary update <= 2200ms

Token budgets (per turn):
- Evaluator <= 700 input / 120 output
- Texting <= 1400 input / 220 output
- Privacy <= 900 input / 140 output
- Summary <= 1800 input / 260 output

Caching policy:
- Evaluator score cache for unchanged post + preference snapshot.
- Summary recompute cache keyed by transcript hash + config snapshot.

## 11. Platform Data Contracts
Required tables/entities:
- `sessions`
- `turn_events`
- `message_attempts`
- `policy_decisions`
- `summary_reports`
- `config_snapshots`

### User Profile Topic Store (Read-Only Context)
Per-user directory of topic-specific markdown files populated during onboarding from the user's uploaded text message history. These files are **read-only at runtime** — used for RAG-like context retrieval by the Texting Agent. No agent writes to them during sessions.

Topic files:
- `hobbies.md` — activities, pastimes, sports, creative pursuits
- `values.md` — core beliefs, priorities, life philosophy
- `interests.md` — curiosities, media preferences, intellectual interests
- `humor.md` — joke style, sarcasm level, comedic tone
- `dealbreakers.md` — hard boundaries, non-negotiables, incompatibilities
- `communication_style.md` — texting cadence, emoji usage, formality
- `lifestyle.md` — routines, social habits, living preferences
- `goals.md` — aspirations, ambitions, direction

Write path: The **Text Sorter** (see `text_sorter.md`) processes user's uploaded chat logs, classifies by topic, runs Privacy Agent validation, and generates files.
Read path: Texting Agent selects 1-3 relevant topic files per turn as draft context.
Immutability: Files are not modified at runtime. User can re-upload to regenerate.

Retention/deletion:
- raw text TTL: 24h
- derived reports TTL: 7d
- topic profile files: persist until user deletes account or re-uploads
- hard delete removes user-linked rows, profile directory, and invalidates future sends
- audit logs retain reason codes and hashes only (no sensitive plaintext)

## 12. Observability KPIs
- Evaluator funnel: candidates -> connect decisions -> outreach attempts
- Privacy reject/redact rate by violation code
- Retry exhaustion and timeout rate by stage
- Session completion and handoff conversion
- Latency and token usage by role/model
- Drift metrics across nightly evals

## 13. Acceptance Test Pack
- Cross-doc consistency: no active docs reference deprecated Fetch runtime.
- State-machine determinism for retry/drop/summary transitions.
- Policy precedence and taxonomy correctness on mixed violations.
- Inbound/outbound privacy parity tests.
- Evaluator threshold tuning vs outreach volume.
- Snapshot reproducibility for score/confidence/flags.
- Latency/cost budget tests at target concurrency.

## 14. Immediate Implementation Steps
1. Keep this one-file PRD as canonical and pin version in team channel.
2. Implement the state machine and idempotency key system first.
3. Implement privacy taxonomy + reason-code registry before scaling texting flows.
4. Wire evaluator thresholds/ranking and anti-spam controls.
5. Stand up eval harness + promotion gates before model/prompt iteration.
6. Implement the Text Sorter ingestion pipeline and verify topic file generation against test chat exports.

---

# Appendix A: Evaluator Agent Spec

# Evaluator Agent Spec

## Mission
Evaluate human-authored public posts and decide whether a connection attempt should be initiated.

## Allowed Inputs
- Public post text and metadata (`post_id`, timestamp bucket, tags).
- User preference profile relevant to connection goals.
- Session-level limits and policy configuration.

## Disallowed Behavior
- Do not generate or publish public feed posts.
- Do not use sensitive inferred attributes (health, religion, politics, sexuality, finances, trauma).
- Do not produce deterministic claims about relationship outcomes.

## Output Schema (`EvaluatorDecision`)
```json
{
  "post_id": "string",
  "candidate_user_id": "string",
  "connect_score": 0.0,
  "decision": "connect",
  "reason_tags": ["shared_interests", "communication_style_match"],
  "evaluator_confidence": 0.0
}
```

Field rules:
- `connect_score`: float in `[0,1]`.
- `decision`: `connect` or `skip`.
- `reason_tags`: short policy-safe tags only, no personal identifiers.
- `evaluator_confidence`: float in `[0,1]`.

## Refusal Behavior
- If post content is missing, malformed, or policy-disallowed, return:
  - `decision = "skip"`
  - `connect_score = 0`
  - `reason_tags = ["insufficient_or_disallowed_input"]`

---

# Appendix B: Texting Agent Spec

# Texting Agent Spec

## Mission
Generate high-quality conversational messages to counterpart agents while staying within session limits and privacy guidance. Use topic-specific user profile context retrieved at draft time for personalized, authentic messages.

## Topic-Based Context Retrieval
Before drafting, the Texting Agent selects 1-3 relevant topic files from the user's profile directory based on conversation context (intent tag, recent messages, evaluator tags). This is analogous to RAG but over structured markdown files rather than vector embeddings. These files are **read-only** — populated once during onboarding from the user's uploaded text message history, never modified by agents.

Topic files: `hobbies.md`, `values.md`, `interests.md`, `humor.md`, `dealbreakers.md`, `communication_style.md`, `lifestyle.md`, `goals.md`.

Retrieval rules:
- If a relevant topic file is empty or missing, fall back to evaluator context.
- Retrieved content counts toward the 1400-token input budget.
- Agent outputs are never written back to topic files.

## Allowed Inputs
- Current session context (`session_id`, `turn_index`, prior safe messages).
- Evaluator decision context and intent tags.
- Rewrite guidance from Privacy Agent.
- Session limits (`max_messages`, `max_privacy_retries`, tone settings).
- Retrieved topic file(s) from the user's profile directory (1-3 per turn).

## Disallowed Behavior
- Do not bypass Privacy Agent.
- Do not mention or reveal blocked sensitive topics.
- Do not generate spam, harassment, or manipulative pressure language.
- Do not exceed hard conversation cap.
- Do not write to or modify topic profile files — they are read-only context.

## Output Schema (`TextDraft`)
```json
{
  "session_id": "string",
  "turn_index": 12,
  "draft_text": "string",
  "intent_tag": "build_rapport",
  "retrieved_topics": ["hobbies", "humor"]
}
```

Field rules:
- `draft_text` must be plain text safe for privacy review.
- `intent_tag` should be from a controlled set (e.g., `intro`, `ask_question`, `build_rapport`, `handoff_prompt`).
- `retrieved_topics` lists which topic files were used as context (for auditability).

## Refusal Behavior
- If context is insufficient or hard limits are reached, return no draft and reason:
```json
{
  "session_id": "string",
  "turn_index": 12,
  "draft_text": "",
  "intent_tag": "refuse_limit_or_context",
  "retrieved_topics": []
}
```

---

# Appendix C: Privacy Agent Spec

# Privacy Agent Spec

## Mission
Enforce user-defined topic boundaries and sensitive-information policy on every outbound and inbound message.

## Allowed Inputs
- Proposed `TextDraft`.
- User-configured privacy policy (allowed/blocked/sensitive topic sets).
- Session policy defaults and reason-code taxonomy.

## Disallowed Behavior
- Do not forward sensitive plaintext to counterpart agent.
- Do not silently allow borderline content without explicit status.
- Do not leak internal policy implementation details in user-visible outputs.

## Output Schema (`PrivacyCheckResult`)
```json
{
  "status": "reject",
  "violations": ["blocked_topic:health"],
  "rewrite_guidance": "Keep the same conversational goal but remove health-related references.",
  "direction": "outbound"
}
```

Field rules:
- `status`: `pass`, `reject`, or `redact`.
- `violations[]`: compact reason codes, no sensitive plaintext.
- `rewrite_guidance`: actionable and minimal.
- `direction`: `outbound` or `inbound`.

## Refusal Behavior
- If policy config is missing or invalid, fail closed:
```json
{
  "status": "reject",
  "violations": ["policy_config_missing_or_invalid"],
  "rewrite_guidance": "Cannot send until privacy settings are configured."
}
```

---

# Appendix D: Summary Agent Spec

# Summary Agent Spec

## Mission
Analyze approved conversation history and generate the final compatibility-style summary and recommendation package.

## Allowed Inputs
- Privacy-approved transcript only.
- Session metadata and config snapshot hashes.
- Scoring outputs and policy-safe signal aggregates.

## Disallowed Behavior
- Do not use blocked/redacted raw content.
- Do not output direct identifiers or unique incidents.
- Do not present deterministic guarantees.

## Output Schema (`SummaryReport`)
```json
{
  "overall_score": 78,
  "confidence": 0.72,
  "green_flags": ["mutual_curiosity", "shared_values_signals"],
  "yellow_flags": ["response_pacing_mismatch"],
  "red_flags": [],
  "conversation_summary": "Pattern-level summary text.",
  "recommended_next_step": "Move to a short human-intro call.",
  "snapshot_hash": "sha256:..."
}
```

Field rules:
- `overall_score`: integer in `[0,100]`.
- `confidence`: float in `[0,1]`.
- Flags must remain advisory.
- Summary text must be generalized and privacy-safe.
- `snapshot_hash` must identify model/prompt/schema/runtime configuration for reproducibility.

## Refusal Behavior
- If evidence is insufficient, return uncertainty-first output:
```json
{
  "overall_score": 0,
  "confidence": 0.0,
  "green_flags": [],
  "yellow_flags": ["insufficient_evidence"],
  "red_flags": [],
  "conversation_summary": "Insufficient privacy-approved evidence for a reliable summary.",
  "recommended_next_step": "Collect more consented interaction data."
}
```
