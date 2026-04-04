# Social Media Frontend Runtime UX Addendum
## Optimized Runtime State Handling (Non-Fetch 4-Agent System)

This document defines frontend behavior for runtime optimization states so UI remains truthful and safe under load, fallback, or schema drift.

## 1. Messages Policy Rail: Queue and Backpressure Visibility
- The Messages policy rail must display queue health status from backend events:
  - `normal`
  - `queue_slowdown`
  - `degraded_mode`
- When backend emits `reason_code=queue_backpressure_degraded_mode`, show a warning chip and disable non-essential messaging actions until recovery.
- Backpressure status must be timestamped and tied to `event_id` for auditability.

## 2. Degraded-Mode Banner Rules
- Show a persistent banner when fallback, timeout pressure, or summary-only mode is active.
- Banner text requirements:
  - explain that system is running in reduced capability mode,
  - indicate whether recommendations are confidence-capped,
  - provide retry guidance without exposing internal model details.
- Banner clears only when backend emits recovery event and no active degraded flags remain.

## 3. Schema Mismatch Fallback
- If frontend receives an unknown `schema_version`, `stage`, `status`, or `reason_code`, it must:
  - render safe fallback text: “Temporarily unsupported event version,”
  - avoid crashing message timeline rendering,
  - log telemetry marker `schema_version_mismatch`,
  - keep session read-only until compatible payloads resume.

## 4. Confidence Transparency Labels
- Every report card must include explicit confidence provenance:
  - `Calibrated confidence` when calibration artifact is valid,
  - `Degraded confidence` when fallback model or degraded mode influenced output.
- If `degraded_confidence=true`, recommendation badge is visually downgraded and includes explanation tooltip.

## 5. UI Contract Mapping
- `queue_backpressure_degraded_mode` -> amber rail chip + degraded-mode banner.
- `fallback_quality_floor_not_met` -> red error chip + fail-closed session state.
- `schema_version_mismatch` -> neutral blocked card + read-only fallback UI.
- `timeout_stage_<stage_name>` -> warning chip with stage-specific message.

## 6. Acceptance Criteria (Frontend)
- Queue/backpressure state is visible in Messages rail at all times during active session.
- Degraded mode is clearly labeled and removed on recovery.
- Schema mismatch never crashes UI and always falls back safely.
- Confidence labels distinguish calibrated vs degraded outputs for every summary card.
