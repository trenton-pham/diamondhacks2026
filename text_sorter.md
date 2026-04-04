# Text Sorter Spec

## Mission
Transform a user's raw text message exports into topic-specific markdown profile files. This is the ingestion pipeline that runs during onboarding — it reads unstructured chat logs, classifies message content by topic, and produces the structured files the Texting Agent later uses as context.

## When It Runs
- **Onboarding**: When a user first uploads their text history.
- **Re-upload**: When a user provides updated or additional chat exports. Previous topic files are overwritten with the new output.

The Text Sorter does **not** run during live sessions. It is a preprocessing step only.

## Allowed Inputs
- Raw text message exports in supported formats:
  - iMessage (`.db` or chat.db export)
  - WhatsApp (`.txt` or `.zip` export)
  - SMS/MMS backup (XML or CSV)
  - Generic chat log (newline-delimited, `timestamp | sender | message` format)
- User ID for output directory targeting.
- User-configured privacy policy (blocked/sensitive/allowed topic sets) for pre-filtering.

## Processing Pipeline

### Step 1: Parse
- Normalize all input formats into a unified intermediate representation:
```json
{
  "messages": [
    {
      "timestamp": "ISO-8601",
      "sender": "user" | "other",
      "text": "string"
    }
  ]
}
```
- Strip media attachments (images, audio, video) — text content only.
- Discard system messages (e.g., "You added X to the group", "Encryption notice").

### Step 2: Filter to User Messages
- Retain only messages where `sender == "user"` — we are building a profile of the user, not their contacts.
- Discard empty messages and messages under 4 words (too short to extract signal).

### Step 3: Classify by Topic
- For each user message, classify it into one or more of the target topics:

| Topic | Classification Signals |
|---|---|
| `hobbies` | Activities, sports, games, creative projects, weekend plans, "I've been doing…" |
| `values` | Beliefs, priorities, moral stances, "I think…", "what matters to me…" |
| `interests` | Curiosity, media (books/movies/music/podcasts), "I've been into…", recommendations |
| `humor` | Jokes, sarcasm, memes, teasing, comedic tone, reaction style |
| `dealbreakers` | Hard no's, pet peeves, relationship boundaries, "I can't stand…", "never" |
| `communication_style` | Meta-texting patterns: emoji frequency, message length, response timing, formality |
| `lifestyle` | Routines, diet, fitness, social habits, work references, living situation |
| `goals` | Ambitions, plans, aspirations, career direction, "I want to…", "someday I'll…" |

- A single message may map to multiple topics (e.g., "I want to run a marathon" → `hobbies` + `goals`).
- Messages that don't clearly map to any topic are discarded — do not force classification.

### Step 4: Extract and Summarize
- For each topic, collect all classified messages and extract:
  - **Key Signals**: Direct, specific observations (e.g., "Plays basketball weekly", "Watches horror movies").
  - **Patterns**: Recurring themes across multiple messages (e.g., "Frequently references outdoor activities", "Consistently dry/sarcastic humor").
- Summarize — do not copy raw messages verbatim. The output should be distilled observations, not a transcript.

### Step 5: Privacy Review
- Before writing files, run the extracted content through the Privacy Agent's policy check.
- Strip any content that triggers `blocked_topic` or `personal_identifier_detected` violations.
- Generalize content that triggers `sensitive_topic_requires_generalization` (e.g., "works in healthcare" instead of specific employer).
- If a topic file would be empty after privacy review, do not create it.

### Step 6: Write Topic Files
- Write each topic file to `profiles/{user_id}/{topic}.md` in the following format:

```markdown
# {Topic Name}
<!-- generated_at: ISO-8601 timestamp -->
<!-- source_message_count: number of user messages classified under this topic -->

## Key Signals
- Specific observation 1
- Specific observation 2
- ...

## Patterns
- Recurring theme 1
- Recurring theme 2
- ...
```

## Output Schema (`TextSorterResult`)
```json
{
  "user_id": "string",
  "files_generated": ["hobbies", "values", "humor"],
  "files_skipped": ["dealbreakers"],
  "skip_reasons": {
    "dealbreakers": "insufficient_data"
  },
  "total_messages_processed": 4820,
  "total_messages_classified": 1237,
  "privacy_redactions": 3,
  "generated_at": "ISO-8601"
}
```

Field rules:
- `files_generated`: list of topic names that produced a non-empty file.
- `files_skipped`: topics with insufficient data or fully redacted content.
- `skip_reasons`: one of `insufficient_data`, `fully_redacted`, `parse_error`.
- `privacy_redactions`: count of content items removed or generalized during privacy review.

## Disallowed Behavior
- Do not store raw message text in the output files — only distilled observations and patterns.
- Do not include messages from other senders in the user's profile.
- Do not classify messages that are ambiguous — prefer skipping over misclassification.
- Do not bypass the Privacy Agent review step.
- Do not run during live sessions — this is an offline preprocessing step only.

## Refusal Behavior
- If the uploaded file is empty, corrupt, or in an unsupported format:
```json
{
  "user_id": "string",
  "files_generated": [],
  "files_skipped": [],
  "skip_reasons": {},
  "total_messages_processed": 0,
  "total_messages_classified": 0,
  "privacy_redactions": 0,
  "generated_at": "ISO-8601",
  "error": "unsupported_format | empty_input | parse_failure"
}
```

## Performance Budget
- Target: process 10,000 messages in under 60 seconds.
- Classification may be batched (e.g., 50 messages per LLM call) to stay within cost/latency targets.
- Summarization runs once per topic after all messages are classified — not per-message.
