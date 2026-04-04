# Plan Update: Scoring, Privacy, and Runtime Guardrails (Non-Fetch)

## Summary
This document defines the canonical scoring/privacy contract for the 4-agent LLM system.  
It replaces legacy protocol-signature assumptions with app-level orchestration controls, strict policy enforcement, and reproducibility requirements.

## 1. Runtime Integrity Contract
- **State-machine integrity**:
  - every stage emits an immutable event with idempotency key
  - retries are bounded and explicitly reason-coded
- **Config snapshot integrity**:
  - each run stores model/prompt/schema/runtime hashes
  - scoring and summary are only valid with complete snapshot metadata
- **Fail-closed behavior**:
  - if policy state, snapshot state, or session state is invalid, no outbound send

## 2. Privacy Policy Taxonomy and Precedence
### Policy classes
- `blocked`: never allowed to be transmitted.
- `sensitive`: allowed only in generalized, non-identifying form and only if user permits.
- `allowed`: acceptable within consented conversation context.

### Precedence rules
1. `blocked` overrides all.
2. `sensitive` overrides `allowed` when detail level creates identification risk.
3. `allowed` applies only when no higher-priority violation exists.

### Check directions
- **Outbound checks**: all `TextDraft` messages must pass policy before send.
- **Inbound checks**: incoming counterpart messages are scanned before entering shared conversation context.
- **Redaction standard**: remove unsafe spans and preserve conversational intent if possible.

## 3. Reason-Code Registry (`violations[]`)
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

Rules:
- Use compact reason codes only; never include sensitive plaintext in violation fields.
- Multiple violations may be returned in one check; highest-precedence violation drives final action.

## 4. Scoring and Summary Contract
### Input allowlist for Summary Agent
- privacy-approved transcript events only
- policy-safe aggregate features
- evaluator decision metadata
- session limits/outcomes (retry exhaustion, dropped turns)

### Input denylist for Summary Agent
- blocked or redacted raw content
- direct identifiers (names, handles, exact timestamps, URLs)
- internal model chain-of-thought traces

### Scoring formulas
- `dim_score_d = sum(w_i * sim_i * conf_i) / sum(w_i * conf_i)`
- `reliability_d = min(1, support_count_d / support_threshold_d)`
- `adjusted_dim_d = dim_score_d * reliability_d`
- `overall_score = 100 * sum(W_d * adjusted_dim_d) / sum(W_d)`
- `confidence = 0.4*evidence + 0.35*consistency + 0.25*(1-uncertainty)`

### Recommendation bands
- `Strong fit`: score >= 75 and confidence >= 0.70
- `Proceed with caution-positive`: score 60-74 or confidence 0.55-0.69
- `Low confidence/mismatch risk`: score < 60 or confidence < 0.55

### Reproducibility and stability
- same transcript + same config snapshot must produce same recommendation tier
- acceptable tolerance:
  - `overall_score` drift <= 2 points
  - confidence drift <= 0.03
  - no flag severity class change without snapshot change

## 5. Evaluator and Ranking Rules
- **Decision thresholds**:
  - `connect` requires `connect_score >= 0.62` and minimum evidence gate pass
  - otherwise `skip`
- **Ranking**:
  - rank by `connect_score` descending, then by higher evaluator confidence, then by newer post freshness bucket
- **Anti-spam limits**:
  - max 3 outreach attempts per target per 24h
  - cooldown of 12h after a rejected outreach
  - suppress duplicate outreach if same `post_id` was already attempted

## 6. Training, Eval, and Promotion Gates
### Dataset schema (minimum)
- `sample_id`, `role`, `input_payload`, `expected_output`, `label_source`, `policy_tags`, `split`

### Annotation rubrics
- Evaluator: relevance, matchworthiness, evidence sufficiency
- Privacy: correct class (`pass/reject/redact`), violation code precision, rewrite quality
- Summary: score plausibility, flag quality, privacy-safe language

### Promotion gates (MVP defaults)
- Evaluator precision >= 0.78 and recall >= 0.70 on validation split
- Privacy violation catch rate >= 0.97 on seeded sensitive set
- Summary consistency >= 0.90 exact tier agreement on reruns
- No critical regressions on privacy/safety suite

### Cadence and ownership
- pre-merge regression suite for all prompt/model changes
- nightly full eval run with drift report
- ownership:
  - Agent Logic Team: evaluator/texting evals
  - Privacy/Safety Team: policy and violation evals
  - Summary/Scoring Team: summary/scoring stability evals

## 7. Test Additions (Required)
- Cross-doc consistency test: no active spec references deprecated Fetch runtime.
- State-machine determinism: retry/drop/summary transitions are reproducible.
- Policy precedence test: mixed violations produce correct final status.
- Inbound/outbound privacy tests: both paths enforce identical taxonomy.
- Evaluator tuning test: outreach volume does not exceed anti-spam policy.
- Snapshot reproducibility test: same input + same snapshot => stable output band.
- Latency/cost budget test at target concurrency.

## Assumptions/Defaults
- Non-Fetch LLM orchestration is the locked architecture.
- Dual opt-in, topic-level consent, and fail-closed policy remain mandatory.
- Prompt-only MVP remains default; SFT is optional after baseline quality is proven.
