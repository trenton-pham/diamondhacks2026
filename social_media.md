# Social Media Website Spec
## Product + UI Blueprint (Single-File React + Tailwind)

## 1. Purpose and Scope
This document is the implementation blueprint for the social media website UI as a single-file React component (`.jsx`) styled with Tailwind utility classes.

The website has 3 pages:
- `Posts`: human-only posting surface.
- `Messages`: connected users messaging with inline policy/status visibility.
- `Profile`: profile settings, privacy boundaries, and text-only uploads.

This blueprint inherits core constraints from the current planning docs:
- non-Fetch 4-agent architecture
- privacy-first policy enforcement (inbound and outbound)
- `max_messages = 150`
- `max_privacy_retries = 3`

## 2. Non-Negotiable Design Direction
Visual direction is locked:
- Bright, editorial, institutional dashboard aesthetic.
- Closer to Notion/Linear than dating/crypto UI.
- No dark mode.
- No purple gradients.
- No glassmorphism.
- No AI-startup visual cliches.
- Minimal decorative imagery; use subtle avatars/placeholders and lightweight icons.

Typography:
- Display headline font: Google Font `DM Serif Display`.
- Body font stack: clean neutral sans-serif (system-safe fallback).

Interaction and motion:
- Subtle transitions only (hover, focus, section fade).
- No flashy parallax, heavy animation, or floating neon effects.

## 3. Frontend Architecture (Single-File JSX)
Implementation target:
- One React component file (e.g., `SocialMediaDashboard.jsx`) containing:
  - page state
  - shared mock data/state
  - internal render helper functions for each major section

Core page state:
```js
const [activePage, setActivePage] = useState("posts"); // posts | messages | profile
```

Other required UI state:
- posts composer text and validation state
- selected message thread
- connection status (`not_connected | connected | paused`)
- message count + retry counters
- privacy topic lists (`allowed`, `sensitive`, `blocked`)
- upload status for `.txt` / `.md` / pasted text

Required helper render functions (inside same file):
- `renderLeftNav()`
- `renderPostsPage()`
- `renderMessagesPage()`
- `renderProfilePage()`
- `renderRightRail()`

## 4. Responsive Layout Contract
Layout behavior is locked:
- Desktop (`>= 1280px`): 3-column layout
  - left navigation
  - main content
  - right utility rail
- Tablet (`>= 768px` and `< 1280px`): 2-column layout
  - left nav collapses to compact icon rail
  - right utility rail moves below main content
- Mobile (`< 768px`): single-column stacked layout
  - sticky top tabs for `Posts | Messages | Profile`
  - utility widgets become collapsible sections

Touch and accessibility:
- minimum interactive target size `44px`
- visible keyboard focus states
- semantic headings and ARIA labels on nav/chat/actions
- color contrast must remain readable in bright mode

## 5. Design Tokens and Tailwind Style Rules
Use Tailwind utility classes with a neutral palette and restrained accent usage.

Token guidance:
- Backgrounds: off-white and white layers (`bg-stone-50`, `bg-white`)
- Borders: subtle gray borders (`border-stone-200`)
- Text:
  - primary: `text-stone-900`
  - secondary: `text-stone-600`
  - muted: `text-stone-500`
- Accent color: blue/slate only for key actions/status (not purple)
- Radius: medium/large cards (`rounded-xl`, `rounded-2xl`)
- Shadows: very subtle (`shadow-sm` only)

Typography rules:
- Display headline uses `DM Serif Display`.
- Body and UI labels use clean sans stack.
- Keep line length readable; avoid oversized marketing hero patterns.

## 6. Page Specifications
### 6.1 Posts Page (Human-Only Feed)
Goal:
- Provide a clean feed where only authenticated humans can publish posts.

Required sections:
- Post composer card:
  - textarea input
  - character counter
  - tags input (optional lightweight tags)
  - publish button
  - helper text: "Only human-authored posts are publishable."
- Feed list:
  - post card with author, timestamp, content, tags
  - actions: like, comment, save
  - optional "AI read-only" label on feed header
- Right rail widgets:
  - candidate quality signals summary
  - connection recommendations (policy-safe, non-sensitive)

Rules:
- no AI autopost action in UI
- if user is not authenticated, composer is read-only with sign-in CTA

### 6.2 Messages Page (Connected Users Only)
Goal:
- Support message exchange with transparent policy and state-machine visibility.

Required sections:
- Thread list panel (left in desktop/tablet):
  - thread name
  - last message preview
  - connection status chip
- Active chat panel:
  - message bubbles
  - timestamp
  - send box with disabled states
- Inline policy rail (always visible on desktop):
  - privacy status chips (`pass`, `reject`, `redact`)
  - retry counter (`retry 0/3`, etc.)
  - message cap progress (`used/150`)
  - turn lifecycle chips (`draft`, `privacy_check`, `sent`, `dropped`)
  - most recent reason code mapped to human-readable message

Connection gating:
- `not_connected`: disable input; show "Connect to message" state
- `connected`: input enabled
- `paused`: input disabled; show paused reason

Counting behavior:
- approved sent/received messages increment `used_messages`
- rejected drafts do not increment message cap
- rejected/redacted events increment retry/process counters per turn

### 6.3 Profile Page
Goal:
- Central place for identity, privacy limits, and context uploads.

Required sections:
- Profile summary card:
  - avatar placeholder
  - display name
  - short bio
- Privacy boundaries editor:
  - editable topic chips/lists for `allowed`, `sensitive`, `blocked`
  - save button with inline confirmation state
- Upload + context section:
  - drag/drop or file picker for `.txt` and `.md` only
  - paste text box
  - file validation and rejection message for unsupported types
- Consent and retention section:
  - clear toggles for policy choices
  - retention labels:
    - raw text: 24h
    - derived reports: 7d
- Account safety section:
  - preferences stubs
  - "Delete my data" action stub (confirmation UI only in MVP)

## 7. Data Contracts and UI Mapping
The UI must reflect these types:
- `EvaluatorDecision`
- `TextDraft`
- `PrivacyCheckResult`
- `SummaryReport`
- `SessionLimits`

Client-visible event schema for message timeline/policy rail:
```ts
type UiEvent = {
  stage: "candidate_select" | "evaluator_decision" | "texting_draft" | "privacy_check_outbound" | "send" | "rewrite" | "drop" | "privacy_check_inbound" | "summary_update";
  status: "ok" | "warn" | "blocked";
  reason_code?: string;
  timestamp: string;
  turn_index: number;
};
```

Reason code display mapping (required):
- `blocked_topic:<topic>` -> "Blocked topic detected"
- `sensitive_topic_requires_generalization:<topic>` -> "Sensitive topic must be generalized"
- `policy_config_missing_or_invalid` -> "Privacy settings need attention"
- `retry_exhausted_drop` -> "Message dropped after max retries"
- `session_limit_reached` -> "Message cap reached"
- `timeout_stage_<stage_name>` -> "System timeout, please retry"

## 8. Component Map (Single File)
The single-file JSX should include internal sub-render functions by section:
- Navigation and shell
  - left nav / top tabs
  - page switch controls
- Posts page components
  - composer card
  - post card list
  - recommendation widget
- Messages page components
  - thread list
  - chat view
  - policy rail
- Profile page components
  - profile header card
  - privacy topic editor
  - upload panel
  - consent/retention panel
- Shared utility components (internal functions only)
  - status chip
  - section card wrapper
  - empty state block

## 9. Technical Optimization Plan
### 9.1 Frontend structure optimization
- Keep the single-file `.jsx` structure but enforce strict internal blocks:
  - `state`
  - `derivedState`
  - `actions`
  - `render helpers`
- Use one source of truth for:
  - `used_messages`
  - `turn_retry_used`
  - `connection_status`
- Add lightweight selector helpers to avoid duplicated condition logic across render functions.

### 9.2 Rendering optimization
- Memoize heavy UI regions (feed list, thread list, policy rail) to reduce unnecessary rerenders.
- Debounce high-frequency text input handlers (composer and message input).
- Avoid whole-page rerenders when only one region updates.
- Defer feed virtualization until volume exceeds threshold (100+ cards).

### 9.3 Data contract optimization
- Normalize API payloads into strict UI-safe shapes before rendering.
- Use one reason-code display map shared across chat rail, toasts, and event chips.
- Require stable `event_id` for timeline rendering keys.

### 9.4 Realtime optimization
- Use persistent WebSocket only on `Messages` page.
- Use REST/polling for `Posts` and `Profile`.
- Add bounded reconnect behavior with a visible degraded-state banner.
- Defer offline outgoing queue and replay logic to post-MVP.

### 9.5 Privacy/safety optimization
- Always sanitize violation text through template mapping.
- Never render raw sensitive content in UI diagnostics.
- Keep policy rail concise by default: current status + latest reason code.

## 10. High-Value Cuts (Optimal MVP Options)
- **Cut A (Optimal): Realtime scope**
  - WebSocket only on `Messages`.
  - REST/polling on `Posts` and `Profile`.
- **Cut B (Optimal): Utility rail scope**
  - Keep right rail lightweight and page-specific.
  - Collapse/hide by default on tablet/mobile.
- **Cut C (Optimal): Policy diagnostics density**
  - Show current status + latest reason code inline.
  - Move full timeline into an expandable drawer.
- **Cut D (Optimal): Navigation persistence**
  - Use `localStorage` only in MVP (no URL hash sync).
- **Cut E (Optimal): Data preloading**
  - Disable predictive prefetch for MVP; load on demand.
- **Cut F (Optimal): Reconnect queue**
  - Defer offline/reconnect message queue to v2.
- **Cut G (Optimal): Feed virtualization**
  - Defer until 100+ feed cards.
- **Cut H (Optimal): Recommendation widgets**
  - Keep one compact recommendation summary card.
  - Defer richer analytics/recommendation panels.

## 11. Accessibility, UX, and Content Rules
- Use descriptive labels and helper text on all form controls.
- Provide clear empty states for no posts, no messages, no uploads.
- Never expose sensitive raw content in policy/status widgets.
- Keep copy concise and institutional (not playful/romantic).
- Ensure keyboard navigation across tabs, thread list, and form controls.

## 12. Must-Have vs Defer
### Must-have (MVP)
- Core 3 pages (`Posts`, `Messages`, `Profile`) with responsive behavior.
- Policy gating and transparent status in Messages.
- Correct counters/limits (`max_messages = 150`, retry behavior).
- Text-only uploads and privacy topic editor.
- Accessibility baseline (focus, touch target, semantic structure).
- Design compliance with locked visual rules.

### Defer (Post-MVP)
- Advanced predictive prefetching.
- Offline outgoing queue/replay.
- Dense analytics widgets in right rail.
- Early feed virtualization for small/medium lists.
- Rich media-heavy post creation workflows.

## 13. Test and Acceptance Criteria
### Functional
- Posts page accepts human-authored post creation only.
- Messages page blocks sending when connection status is not `connected`.
- Policy rail updates correctly for pass/reject/redact + retry updates.
- Profile uploads accept `.txt` and `.md`, reject unsupported file types.

### State and contract
- `max_messages = 150` counter behavior matches contract.
- Retry exhaustion displays dropped turn state with correct reason code.
- Reason code rendering uses approved mapping only.
- `used_messages` increments only on approved sent/received messages.
- Rejected/redacted drafts do not consume message cap.

### Responsive
- Desktop: 3-column works at full width.
- Tablet: 2-column collapse behaves as specified.
- Mobile: single-column with sticky page tabs is usable and readable.
- Right rail is collapsed/hidden by default on tablet/mobile.

### Design compliance
- No dark mode.
- No purple gradients.
- No glassmorphism.
- No AI-startup visual tropes.
- Minimal imagery usage.

### Accessibility
- focus visibility passes keyboard-only walkthrough
- touch target sizing meets minimum
- semantic structure supports screen readers

### Performance and rendering checks
- No persistent socket connection on `Posts` and `Profile`.
- Interactions remain stable on low-end mobile for tab switch, compose, and send flows.
- Policy rail updates without full chat rerender.
- Messages page reconnect state shows degraded banner and recovers without data corruption.

## 14. Locked Defaults
- Visual direction: Notion-like editorial.
- Layout: 3-column desktop.
- Messages diagnostics: inline policy rail.
- Upload scope: text-only (`.txt`, `.md`, paste).
- Headline font: `DM Serif Display`.
- MVP post actions: like/comment/save.
- Media-heavy posting and advanced attachments are out of MVP scope.
- Optimal cut defaults are locked:
  - WebSocket only on Messages
  - page-specific lightweight right rail
  - compact policy diagnostics with expandable full timeline
  - `localStorage` nav persistence only
  - no predictive prefetch
  - no offline outgoing queue
  - no early feed virtualization before threshold
