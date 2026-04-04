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

