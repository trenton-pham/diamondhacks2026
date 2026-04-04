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
