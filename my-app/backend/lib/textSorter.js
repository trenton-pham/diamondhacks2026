const { TOPIC_NAMES } = require("./seedData");

const topicMatchers = {
  hobbies: ["hike", "run", "gym", "museum", "cook", "painting", "yoga", "game", "weekend", "sport", "bookstore"],
  values: ["value", "believe", "important", "honest", "kind", "curious", "respect", "integrity", "care"],
  interests: ["podcast", "movie", "book", "music", "design", "tech", "startup", "history", "science"],
  humor: ["lol", "haha", "meme", "joke", "funny", "sarcasm", "tease"],
  dealbreakers: ["never", "can't stand", "dealbreaker", "won't", "hate when", "hard no"],
  communication_style: ["text", "reply", "message", "call", "emoji", "communicate", "check in"],
  lifestyle: ["morning", "night", "routine", "work", "travel", "dinner", "week", "home", "coffee"],
  goals: ["want to", "goal", "plan", "someday", "dream", "building", "career", "future"]
};

const blockedMatchers = {
  health: ["diagnosis", "hospital", "illness", "medication", "surgery", "therapy"],
  finances: ["salary", "debt", "credit score", "rent amount", "bank account"]
};

const sensitiveMatchers = {
  identity: ["passport", "social security", "license number", "address", "employer", "full name"]
};

function normalizeLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function classifyTopics(text) {
  const lower = text.toLowerCase();
  return TOPIC_NAMES.filter((topic) => (topicMatchers[topic] || []).some((token) => lower.includes(token)));
}

function privacyReview(signal, blockedTopics) {
  const lower = signal.toLowerCase();
  for (const topic of blockedTopics) {
    const tokens = blockedMatchers[topic] || [];
    if (tokens.some((token) => lower.includes(token))) {
      return { action: "drop", reason: `blocked_topic:${topic}` };
    }
  }

  for (const [topic, tokens] of Object.entries(sensitiveMatchers)) {
    if (tokens.some((token) => lower.includes(token))) {
      return {
        action: "generalize",
        reason: `sensitive_topic_requires_generalization:${topic}`,
        value: signal
          .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "contact detail")
          .replace(/\b\d{3}[-.\s]?\d{2,4}[-.\s]?\d{4}\b/g, "private identifier")
      };
    }
  }

  return { action: "keep", value: signal };
}

function buildMarkdown(topic, signals, sourceCount) {
  const title = topic
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const keySignals = signals.slice(0, 4);
  const patterns = signals.slice(4, 7);

  return [
    `# ${title}`,
    `<!-- generated_at: ${new Date().toISOString()} -->`,
    `<!-- source_message_count: ${sourceCount} -->`,
    "",
    "## Key Signals",
    ...(keySignals.length ? keySignals.map((item) => `- ${item}`) : ["- No stable signal extracted."]),
    "",
    "## Patterns",
    ...(patterns.length ? patterns.map((item) => `- ${item}`) : ["- Not enough repeated behavior yet."]),
    ""
  ].join("\n");
}

function runTextSorter({ userId, text, privacy }) {
  if (!text || !text.trim()) {
    return {
      user_id: userId,
      files_generated: [],
      files_skipped: [],
      skip_reasons: {},
      total_messages_processed: 0,
      total_messages_classified: 0,
      privacy_redactions: 0,
      generated_at: new Date().toISOString(),
      error: "empty_input"
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const usableMessages = lines.filter((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length >= 3) {
      const sender = parts[1].toLowerCase();
      const messageText = parts.slice(2).join(" | ");
      return sender === "user" && messageText.split(/\s+/).length >= 4;
    }

    return line.split(/\s+/).length >= 4;
  });

  const buckets = Object.fromEntries(TOPIC_NAMES.map((topic) => [topic, []]));
  let totalClassified = 0;
  let redactions = 0;

  usableMessages.forEach((line) => {
    const textBody = line.includes("|") ? line.split("|").slice(2).join(" | ").trim() : line;
    const topics = classifyTopics(textBody);
    if (!topics.length) {
      return;
    }

    totalClassified += 1;
    topics.forEach((topic) => {
      const review = privacyReview(textBody, privacy.blocked || []);
      if (review.action === "drop") {
        redactions += 1;
        return;
      }

      const signal = review.action === "generalize" ? review.value : textBody;
      if (review.action === "generalize") {
        redactions += 1;
      }

      if (!buckets[topic].includes(signal)) {
        buckets[topic].push(signal);
      }
    });
  });

  const filesGenerated = [];
  const filesSkipped = [];
  const skipReasons = {};
  const topicFiles = {};

  TOPIC_NAMES.forEach((topic) => {
    const signals = buckets[topic];
    if (!signals.length) {
      filesSkipped.push(topic);
      skipReasons[topic] = "insufficient_data";
      return;
    }

    filesGenerated.push(topic);
    topicFiles[topic] = buildMarkdown(topic, signals, signals.length);
  });

  return {
    user_id: userId,
    files_generated: filesGenerated,
    files_skipped: filesSkipped,
    skip_reasons: skipReasons,
    total_messages_processed: lines.length,
    total_messages_classified: totalClassified,
    privacy_redactions: redactions,
    generated_at: new Date().toISOString(),
    topicFiles
  };
}

module.exports = {
  runTextSorter
};
