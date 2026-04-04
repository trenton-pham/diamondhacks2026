# One-File PRD Package

This document combines the merged PRD and all four role specs in one place for team sharing.

---

# Merged Team Alignment Doc
## 4-Model Social Match System (No Fetch.ai)

## 1. Big Picture (Unified Product Direction)
We are building a privacy-first social matching platform where only humans post publicly, and AI agents read those posts and run private agent-to-agent conversations before recommending human handoff.

Unified product thesis:
- Keep the public feed human-only.
- Use four specialized LLM agents with strict orchestration contracts.
- Enforce privacy and consent through platform policy checks before each outbound message.
- Deliver explainable outputs in under 30 seconds during demos.

Primary target:
- Build a reliable, judge-friendly multi-agent MVP with strong privacy controls.

Secondary targets:
- Best Interactive AI
- Best AI/ML Hack
- Wildcard

## 2. Source Documents Considered
- `MERGED_TEAM_ALIGNMENT_DOC.md` (this file, now source of truth)
- `FETCHAI_AGENT_NETWORK_PRD.md` (legacy reference only)
- `OUTPUT_SCORING_PRIVACY_PLAN.md` (normative for scoring/privacy guardrails)
- `tech_stack.md`
- `Hackathon Design Idea Doc.pdf` (manually provided text summary)

## 3. Product and UX Alignment
### MVP scope lock
- Public social feed includes human posts only.
- AI agents can read posts and message counterpart agents; AI does not publish feed posts.
- User-configured privacy boundaries are required before messaging.
- Live timeline + safe report + audit panel in UI.
- All AI-generated interactions are visibly labeled as agent-generated.

### End-to-end user flow
1. Human users create profiles and set privacy/topic boundaries.
2. Evaluator Agent reads human posts and scores connection-worthiness.
3. If score threshold is met, Texting Agent drafts an outreach message.
4. Privacy Agent reviews each draft and returns pass, redact, or reject with rewrite guidance.
5. If rejected/redacted, Texting Agent rewrites and retries (up to max retry limit).
6. Approved messages are sent to counterpart agent.
7. Summary Agent continuously updates conversation analysis and produces final report.

## 4. 4-Agent Architecture (Implementation-Ready)
### Agent roles
- `OutreachEvaluatorAgent`
  - Reads human posts and decides whether a connection attempt is warranted.
  - Outputs `EvaluatorDecision`.
- `TextingAgent`
  - Generates conversation turns and outreach replies.
  - Must follow session constraints and privacy rewrite guidance.
- `PrivacyAgent`
  - Applies user-defined topic/sensitivity limits to every outbound message.
  - Blocks sensitive content and requests compliant rewrites.
- `SummaryAgent`
  - Produces conversation analysis, score, confidence, flags, and recommended next step.

### Agent loop contract
`post_candidate -> evaluator_decision -> texting_draft -> privacy_check -> send|rewrite -> summary_update`

Operational defaults:
- `max_messages = 150` total exchanged messages per session.
- `max_privacy_retries = 3` per turn.
- If retries are exhausted, drop message and log reason code.
- Summary updates on each approved send and on session close.

## 5. Public Interfaces / Types
### `EvaluatorDecision`
- `post_id`
- `candidate_user_id`
- `connect_score` (0-1)
- `decision` (`connect` | `skip`)
- `reason_tags[]`

### `TextDraft`
- `session_id`
- `turn_index`
- `draft_text`
- `intent_tag`

### `PrivacyCheckResult`
- `status` (`pass` | `reject` | `redact`)
- `violations[]`
- `rewrite_guidance`

### `SummaryReport`
- `overall_score` (0-100)
- `confidence` (0-1)
- `green_flags[]`
- `yellow_flags[]`
- `red_flags[]`
- `conversation_summary`
- `recommended_next_step`

### `SessionLimits`
- `max_messages = 150`
- `max_privacy_retries = 3`
- `max_session_duration_minutes = 120`

## 6. Model Role Specs
Each agent uses a dedicated prompt/spec markdown file:
- `evaluator_agent.md`
- `texting_agent.md`
- `privacy_agent.md`
- `summary_agent.md`

Each spec must define:
- Mission
- Allowed inputs
- Disallowed behavior
- Output schema
- Refusal behavior

## 7. Training and Tuning Strategy
### Option A (MVP default): Prompt-only + eval harness
- Use role-specific prompt cards in 4 markdown files.
- Enforce strict JSON schemas for structured outputs.
- Add offline and online eval harness with pass/fail metrics.
- No mandatory fine-tuning for hackathon MVP.

### Option B: Hybrid (post-MVP hardening)
- Keep Texting + Summary prompt-only.
- Add light supervised fine-tuning (SFT) for Evaluator + Privacy models on labeled internal data.

### Option C: Full SFT (post-hackathon scale)
- Fine-tune all 4 agents with versioned datasets and checkpoints.
- Higher performance ceiling but larger ops and data burden.

### Recommended training workflow
1. Start with Option A and frozen schemas.
2. Build a labeled eval set for evaluator decisions, privacy violations, and summary quality.
3. Track precision/recall (evaluator), violation catch rate (privacy), and report consistency (summary).
4. Promote prompt/model updates only if eval metrics improve and regressions are absent.
5. Consider Option B only after stable baseline and enough high-quality labeled failures.

## 8. Runtime Model Policy
- Per-role model routing is allowed (cost/latency optimized).
- Example default routing:
  - Evaluator: lower-cost fast model.
  - Texting: balanced conversational model.
  - Privacy: stricter model or stricter temperature/settings.
  - Summary: higher-quality reasoning model.
- Every run must store deterministic config snapshot:
  - model ID/version per role
  - prompt version/hash per role
  - schema version/hash
  - runtime parameters (temperature/top_p/max_tokens)

## 9. Privacy, Safety, and Platform Policy Enforcement
- Policy checks occur before any outbound agent message.
- Users configure topic-level boundaries (allowed / blocked / sensitive).
- Sensitive violations never pass through raw to counterpart agent.
- Privacy outcomes:
  - `pass`: send message.
  - `redact`: remove unsafe spans and revalidate.
  - `reject`: require rewrite by Texting Agent.
- Keep audit logs with reason codes, but avoid storing sensitive plaintext in logs.
- Retention defaults:
  - raw text TTL: 24 hours
  - derived claims/reports TTL: 7 days
  - hard delete supported

## 10. Scoring and Summary Output Rules
- Keep existing scoring contract from `OUTPUT_SCORING_PRIVACY_PLAN.md`:
  - dimension scoring with reliability gates
  - confidence-gated recommendations
  - uncertainty-first fallback when evidence is weak
- Summary Agent outputs:
  - score + confidence
  - green/yellow/red flags
  - concise conversation analysis
  - recommended next step
- Explanations must be pattern-level only (no direct identifiers or unique incidents).

## 11. Test and Acceptance Criteria
- Evaluator quality:
  - precision/recall on labeled “worthy to connect” posts.
- Privacy loop:
  - seeded sensitive-topic draft is blocked and rewritten before send.
- Retry exhaustion:
  - after 3 failed rewrites, message is dropped and reason logged.
- Limit enforcement:
  - session stops sending at exactly 150 total messages.
- Summary consistency:
  - same transcript + same config snapshot -> stable score band and flag categories.
- Safety regression:
  - prompts attempting policy bypass are consistently rejected/redacted.

## 12. Team Work Split
- Agent Logic Team:
  - Evaluator and Texting behavior, turn orchestration, retries/limits.
- Privacy/Safety Team:
  - policy boundary engine, violation taxonomy, audit reason codes.
- Summary/Scoring Team:
  - analysis synthesis, flags, score/confidence computation.
- Frontend/Platform Team:
  - feed UX, consent/privacy controls, live timeline, report card, audit panel.

## 13. Immediate Next Steps
1. Treat this merged doc as implementation source of truth.
2. Freeze all public interfaces in Section 5 before parallel coding.
3. Finalize role prompt files (`evaluator_agent.md`, `texting_agent.md`, `privacy_agent.md`, `summary_agent.md`).
4. Stand up eval harness and baseline metrics before tuning changes.

## 14. Resolution Policy for Future Conflicts
- If this doc conflicts with legacy Fetch.ai docs, this doc wins.
- If scoring/privacy details conflict, `OUTPUT_SCORING_PRIVACY_PLAN.md` guardrails win.
- If runtime/tooling conflicts arise, `tech_stack.md` wins unless it violates privacy policy.


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
  "reason_tags": ["shared_interests", "communication_style_match"]
}
```

Field rules:
- `connect_score`: float in `[0,1]`.
- `decision`: `connect` or `skip`.
- `reason_tags`: short policy-safe tags only, no personal identifiers.

## Refusal Behavior
- If post content is missing, malformed, or policy-disallowed, return:
  - `decision = "skip"`
  - `connect_score = 0`
  - `reason_tags = ["insufficient_or_disallowed_input"]`


---

# Appendix B: Texting Agent Spec

# Texting Agent Spec

## Mission
Generate high-quality conversational messages to counterpart agents while staying within session limits and privacy guidance.

## Allowed Inputs
- Current session context (`session_id`, `turn_index`, prior safe messages).
- Evaluator decision context and intent tags.
- Rewrite guidance from Privacy Agent.
- Session limits (`max_messages`, `max_privacy_retries`, tone settings).

## Disallowed Behavior
- Do not bypass Privacy Agent.
- Do not mention or reveal blocked sensitive topics.
- Do not generate spam, harassment, or manipulative pressure language.
- Do not exceed hard conversation cap.

## Output Schema (`TextDraft`)
```json
{
  "session_id": "string",
  "turn_index": 12,
  "draft_text": "string",
  "intent_tag": "build_rapport"
}
```

Field rules:
- `draft_text` must be plain text safe for privacy review.
- `intent_tag` should be from a controlled set (e.g., `intro`, `ask_question`, `build_rapport`, `handoff_prompt`).

## Refusal Behavior
- If context is insufficient or hard limits are reached, return no draft and reason:
```json
{
  "session_id": "string",
  "turn_index": 12,
  "draft_text": "",
  "intent_tag": "refuse_limit_or_context"
}
```



---

# Appendix C: Privacy Agent Spec

# Privacy Agent Spec

## Mission
Enforce user-defined topic boundaries and sensitive-information policy on every outbound message.

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
  "rewrite_guidance": "Keep the same conversational goal but remove health-related references."
}
```

Field rules:
- `status`: `pass`, `reject`, or `redact`.
- `violations[]`: compact reason codes, no sensitive plaintext.
- `rewrite_guidance`: actionable and minimal.

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
  "recommended_next_step": "Move to a short human-intro call."
}
```

Field rules:
- `overall_score`: integer in `[0,100]`.
- `confidence`: float in `[0,1]`.
- Flags must remain advisory.
- Summary text must be generalized and privacy-safe.

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
