# Plan Update: Flaw-Resistant Protocols + Privacy/Data Ethics Addendum

## Summary
Expand `OUTPUT_SCORING_PRIVACY_PLAN.md` with a formal **Flaw -> Protocol** control layer so each known multi-agent failure mode has prevention, detection, and fallback behavior.

Design rationale:
- Prioritize controls enforceable at the protocol layer (not only prompt behavior).
- Add privacy and data-ethics constraints so safety cannot be bypassed for performance.
- Fail closed when uncertain or incompatible.

## 1. Flaw Register With Protocol Controls

### A. Strategic self-presentation / gaming
Protocols:
- `Cross-Evidence Consistency Check`: compare declared traits with behavior-derived traits; compute contradiction score.
- `Contradiction Penalty`: reduce dimension score and confidence when contradiction score exceeds threshold.
- `Stability Window`: require consistency across multiple evidence clusters before high-impact claims can be shared.

Prevention:
- Require support from at least `k=3` independent evidence clusters for high-impact claims.
- Penalize unstable claims across repeated windows.

Detection:
- Track contradiction rate and variance by category.

Fallback behavior:
- Downgrade to uncertainty-first output and suppress strong recommendations.

Privacy and data ethics:
- Report contradiction only as uncertainty, never accusation.
- Do not expose raw evidence to counterpart user.

### B. Sparse, noisy, or low-quality inputs
Protocols:
- `Minimum Evidence Gate`: do not publish dimension scores without minimum support count.
- `Uncertainty-First Mode`: return “insufficient shareable evidence” instead of forced judgment.
- `Data Quality Score`: reduce confidence when data is short, repetitive, or synthetic-like.

Prevention:
- Enforce minimum artifact and token thresholds.

Detection:
- Quality heuristics: duplication ratio, lexical diversity, context depth.

Fallback behavior:
- Output limited report with missing-evidence guidance and no deterministic label.

Privacy and data ethics:
- Never request sensitive categories to increase confidence.
- Avoid coercive nudges; users keep upload scope control.

### C. Agent disagreement or protocol drift
Protocols:
- `Protocol Version Handshake`: reject negotiation when protocol versions are incompatible.
- `Deterministic Resolver`: canonical tie-break using fixed similarity functions and static weights.
- `Signed Message Envelope`: attach schema hash + policy hash + signature to every claim.

Prevention:
- Require explicit version and schema compatibility before first claim exchange.

Detection:
- Verify signature/hash integrity on every message.

Fallback behavior:
- Fail closed (no sharing), return compatibility-unavailable status, log reason code.

Privacy and data ethics:
- No sharing on mismatch.
- Log metadata only; avoid plaintext sensitive payloads.

### D. Bias amplification / unfair outcomes
Protocols:
- `Sensitive Feature Firewall`: block protected/sensitive attributes from scoring path.
- `Fairness Calibration Pass`: compare score distributions and error rates across predefined cohorts before release.
- `Bias Drift Monitor`: alert when mismatch/flag rates diverge over time.

Prevention:
- Remove direct and proxy sensitive features from feature registry.

Detection:
- Weekly fairness regression checks and drift thresholds.

Fallback behavior:
- Freeze model/policy version when drift exceeds threshold; revert to last safe baseline.

Privacy and data ethics:
- Do not infer sensitive traits through proxies intentionally.
- Publish transparency note on limitations and residual risk.

### E. Privacy leakage through explanations
Protocols:
- `Explanation Linter`: block quotes, timestamps, handles, links, and unique-event references.
- `k-Support Rule`: each explanation claim must map to >= `k` evidence clusters.
- `Identifiability Scoring`: redact claims when re-identification risk exceeds threshold.

Prevention:
- Template-first explanation generation from policy-approved claim abstractions.

Detection:
- Regex + entity + uniqueness checks before render.

Fallback behavior:
- Replace unsafe explanation text with reason code and safe paraphrase.

Privacy and data ethics:
- Explain generalized patterns only, never incidents.
- Show blocked reason code without sensitive plaintext.

### F. Overconfident recommendations
Protocols:
- `Confidence Gate`: recommendation tier cannot exceed confidence band.
- `Calibration Curve`: map raw model certainty to calibrated confidence.
- `High-Variance Clamp`: if dimensions conflict strongly, downgrade recommendation.

Prevention:
- Require confidence floor for “strong fit” outputs.

Detection:
- Monitor calibration error (e.g., ECE) and variance spikes.

Fallback behavior:
- Replace deterministic labels with “uncertain / needs more evidence.”

Privacy and data ethics:
- Explicitly disclose uncertainty and non-deterministic nature.
- Ban deterministic language (e.g., “soulmate,” “guaranteed fit”).

### G. Safety false positives / false negatives
Protocols:
- `Dual-Model Safety Voting`: require model consensus for high-severity red flags.
- `Flag Severity + Confidence`: expose both values in outputs.
- `Appeal Path`: user-triggered re-run with clarified, consented data.

Prevention:
- Classifier threshold tuning with safety-focused validation set.

Detection:
- Monitor disagreement and re-run outcomes.

Fallback behavior:
- Convert high-severity uncertain flags to “review required” advisory state.

Privacy and data ethics:
- Avoid stigmatizing language.
- Keep flags advisory, not punitive.

## 2. Privacy and Data Ethics Framework (Protocolized)
- `Dual Opt-In + Category Consent`: no session starts without both users and selected categories.
- `Purpose-Locked Processing`: compatibility-only use; no ad targeting or profile resale/reuse.
- `Data Minimization`: process only user-uploaded artifacts and explicitly allowed categories.
- `Retention Policy`:
  - Raw text TTL: 24 hours (default demo).
  - Derived claims TTL: 7 days.
  - Hard delete on user request.
- `Access Control`: user sees safe summaries and policy outcomes only.
- `Revocation Semantics`: consent withdrawal invalidates pending/future sharing immediately.
- `Auditability`: immutable decision log with reason codes, hashes, and timestamps (no sensitive plaintext).
- `Security`: encrypt in transit and at rest; role-based access to logs.

## 3. Chatlog Visibility Policy (Ethics-Preserving)

### User-visible
- Consent handshake result and allowed categories.
- Claim metadata: category, confidence band, allow/block/redact status.
- Dimension scores, overall score, recommendation, and safe explanation text.
- Aggregate audit metrics and reason-code counts.

### Not user-visible
- Raw uploaded chats/posts from either party.
- Blocked sensitive claim plaintext.
- Model internal reasoning traces that may contain private tokens.
- Re-identifying source details: exact timestamps, handles, URLs, message IDs.

### Admin-restricted (break-glass + audited)
- Hashed evidence IDs.
- Schema and policy hashes.
- Envelope integrity and signature verification logs.

## 4. Scoring Output Rules (Updated)
- Dimension score requires:
  - policy-approved claims,
  - minimum support gate,
  - reliability multiplier.
- Overall score requires at least 3 valid dimensions; otherwise return “insufficient evidence.”
- Recommendation requires score band + confidence band + safety cap.
- Explanations and conversation starters must be generated only from non-sensitive overlap/mismatch themes.

### Suggested scoring formulas
- `dim_score_d = sum(w_i * sim_i * conf_i) / sum(w_i * conf_i)`
- `reliability_d = min(1, support_count_d / support_threshold_d)`
- `adjusted_dim_d = dim_score_d * reliability_d`
- `overall_score = 100 * sum(W_d * adjusted_dim_d) / sum(W_d)`
- `confidence = 0.4*evidence + 0.35*consistency + 0.25*(1-uncertainty)`

### Recommendation bands
- `Strong fit`: score >= 75 and confidence >= 0.70
- `Proceed with caution-positive`: score 60-74 or confidence 0.55-0.69
- `Low confidence / mismatch risk`: score < 60 or confidence < 0.55

## 5. Test Additions
- Adversarial gaming test: contradictory persona increases contradiction penalty and lowers confidence.
- Explanation leakage test: seeded quote/timestamp/handle/link always blocked by linter.
- Revocation test: consent withdrawal halts outbound sharing immediately.
- Fairness sanity test: no systematic score inflation/deflation across predefined cohorts.
- Determinism test: same protocol version + same input -> same output envelope.
- Signature integrity test: tampered payload fails envelope verification and is rejected.

## Assumptions/Defaults
- Fetch.ai is the primary sponsor target.
- Dual opt-in and per-category consent are non-negotiable defaults.
- Safety and ethics take precedence over producing a score in ambiguous cases.
- Inputs are user-uploaded only.
- Fallback behavior is fail-closed by default.
