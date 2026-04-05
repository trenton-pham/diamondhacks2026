const { candidateUsers } = require("./seedData");
const { chatWithQwen, isQwenConfigured } = require("./llm");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const QUESTIONNAIRE_FIELDS = [
  "friendship_preferences",
  "relationship_preferences",
  "communication_style",
  "values",
  "lifestyle"
];

function parseTopicSignals(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function collectUserSignals(user) {
  return Object.values(user.topicFiles || {}).flatMap(parseTopicSignals);
}

function getQuestionnaireAnswers(user) {
  return user.questionnaire?.answers || {};
}

function getTags(answer) {
  return (answer?.tags || []).map((tag) => String(tag).toLowerCase());
}

function hasCompletedQuestionnaire(user) {
  return Boolean(user.questionnaire?.completed);
}

function inferSignals(user) {
  return new Set(
    collectUserSignals(user)
      .join(" ")
      .toLowerCase()
      .split(/[^a-z_]+/)
      .filter(Boolean)
  );
}

function evaluateQuestionnaireAlignment(currentUser, candidate) {
  const currentAnswers = getQuestionnaireAnswers(currentUser);
  const candidateAnswers = getQuestionnaireAnswers(candidate);
  const candidateSignals = new Set([
    ...QUESTIONNAIRE_FIELDS.flatMap((field) => getTags(candidateAnswers[field])),
    ...Array.from(inferSignals(candidate))
  ]);
  const currentSignals = new Set([
    ...QUESTIONNAIRE_FIELDS.flatMap((field) => getTags(currentAnswers[field])),
    ...Array.from(inferSignals(currentUser))
  ]);

  const explicitMatches = [];
  QUESTIONNAIRE_FIELDS.forEach((field) => {
    const shared = getTags(currentAnswers[field]).filter((tag) => getTags(candidateAnswers[field]).includes(tag));
    explicitMatches.push(...shared.map((tag) => ({ field, tag })));
  });

  const myConflicts = getTags(currentAnswers.dealbreakers).filter((tag) => candidateSignals.has(tag));
  const theirConflicts = getTags(candidateAnswers.dealbreakers).filter((tag) => currentSignals.has(tag));
  const explicitConflicts = [
    ...myConflicts.map((tag) => ({ source: "current_user", tag })),
    ...theirConflicts.map((tag) => ({ source: "candidate", tag }))
  ];

  return {
    explicitMatches,
    explicitConflicts
  };
}

function scoreCandidate(currentUser, candidate, post) {
  const mySignals = collectUserSignals(currentUser).join(" ").toLowerCase();
  const candidateSignals = collectUserSignals(candidate).join(" ").toLowerCase();
  const postText = `${post.content} ${(post.tags || []).join(" ")}`.toLowerCase();
  const questionnaireAlignment = evaluateQuestionnaireAlignment(currentUser, candidate);

  let overlap = 0;
  const tags = new Set([...(post.tags || []), ...(candidate.tags || [])]);
  tags.forEach((tag) => {
    if (mySignals.includes(tag.toLowerCase()) || candidateSignals.includes(tag.toLowerCase())) {
      overlap += 1;
    }
  });

  const sharedWords = ["writing", "museum", "thoughtful", "project", "community", "ambitious", "curious"].filter(
    (token) => mySignals.includes(token) && candidateSignals.includes(token)
  ).length;

  const postAffinity = candidateSignals.includes(postText.split(" ")[0]) ? 0.05 : 0;
  const explicitMatchBoost = questionnaireAlignment.explicitMatches.length * 0.06;
  const explicitConflictPenalty = questionnaireAlignment.explicitConflicts.length * 0.2;
  const missingQuestionnairePenalty =
    hasCompletedQuestionnaire(currentUser) && hasCompletedQuestionnaire(candidate) ? 0 : 0.08;
  const score = clamp(
    0.45 + overlap * 0.08 + sharedWords * 0.07 + postAffinity + explicitMatchBoost - explicitConflictPenalty - missingQuestionnairePenalty,
    0.08,
    0.96
  );
  const shouldDm = questionnaireAlignment.explicitConflicts.length === 0 && score >= 0.62;

  return {
    score,
    shouldDm,
    reasonLabels: [
      ...(questionnaireAlignment.explicitMatches.length ? ["explicit_preference_match"] : []),
      ...(questionnaireAlignment.explicitConflicts.length ? ["explicit_dealbreaker_conflict"] : []),
      ...(sharedWords || overlap ? ["inferred_context_match"] : [])
    ],
    explicitMatches: questionnaireAlignment.explicitMatches,
    explicitConflicts: questionnaireAlignment.explicitConflicts,
    reasons: [
      questionnaireAlignment.explicitConflicts.length
        ? `Explicit dealbreaker conflict on ${questionnaireAlignment.explicitConflicts
            .map((item) => item.tag)
            .slice(0, 2)
            .join(", ")}.`
        : questionnaireAlignment.explicitMatches.length
          ? `Questionnaire alignment on ${questionnaireAlignment.explicitMatches
              .map((item) => item.tag)
              .slice(0, 3)
              .join(", ")}.`
          : "Questionnaire overlap is limited, so inferred context carries more weight.",
      overlap ? `Shared interests overlap on ${overlap} visible tag signals.` : "Some baseline interest alignment detected.",
      sharedWords ? `Topic files show ${sharedWords} stronger compatibility cues.` : "Compatibility mostly driven by post-level intent."
    ],
    questionnaireCompleted: hasCompletedQuestionnaire(currentUser) && hasCompletedQuestionnaire(candidate)
  };
}

function pickRelevantTopics(post, currentUser) {
  const postText = `${post.content} ${(post.tags || []).join(" ")}`.toLowerCase();
  const available = Object.keys(currentUser.topicFiles || {});
  const candidates = [
    ["hobbies", ["museum", "weekend", "run", "game", "sport"]],
    ["values", ["respect", "thoughtful", "intentional", "honest"]],
    ["interests", ["writing", "book", "product", "tech", "culture"]],
    ["goals", ["build", "future", "ambition", "project"]],
    ["humor", ["joke", "funny", "meme"]]
  ];

  const matched = candidates
    .filter(([topic, tokens]) => available.includes(topic) && tokens.some((token) => postText.includes(token)))
    .map(([topic]) => topic);

  return matched.slice(0, 3).length ? matched.slice(0, 3) : available.slice(0, 2);
}

function generateDraftFallback({ currentUser, candidate, post, priorMessages }) {
  const relevantTopics = pickRelevantTopics(post, currentUser);
  const grounding = relevantTopics
    .flatMap((topic) => parseTopicSignals(currentUser.topicFiles[topic] || ""))
    .slice(0, 4);

  const recentThem = priorMessages.filter((message) => message.sender === "them").slice(-1)[0];
  const opening = recentThem
    ? "Picking up from the last exchange"
    : `Your post about ${post.tags?.[0] || "shared interests"} stood out`;

  const detail = grounding[0] || "thoughtful conversations";
  const question = candidate.tags?.[0]
    ? `What's something in ${candidate.tags[0]} that's been energizing you lately?`
    : "What kind of connection are you hoping to build here?";

  return {
    intent_tag: recentThem ? "build_rapport" : "intro",
    retrieved_topics: relevantTopics,
    draft_text: `${opening}. Jordan tends to really enjoy ${detail.toLowerCase()}, and your profile feels aligned. ${question}`
  };
}

function formatProfileContext(user) {
  const answers = getQuestionnaireAnswers(user);
  const sections = [
    `Name: ${user.name}`,
    `Bio: ${user.bio || ""}`
  ];

  QUESTIONNAIRE_FIELDS.concat("dealbreakers").forEach((field) => {
    const answer = answers[field];
    if (!answer) {
      return;
    }

    const title = field.replace(/_/g, " ");
    const text = answer.text || "";
    const tags = getTags(answer).join(", ");
    sections.push(`${title}: ${text}${tags ? ` Tags: ${tags}` : ""}`);
  });

  Object.entries(user.topicFiles || {}).forEach(([topic, markdown]) => {
    const signals = parseTopicSignals(markdown).slice(0, 3);
    if (signals.length) {
      sections.push(`${topic.replace(/_/g, " ")} signals: ${signals.join("; ")}`);
    }
  });

  return sections.join("\n");
}

function formatPostContext(post) {
  if (!post) {
    return "No originating post context available.";
  }

  return [`Post: ${post.content}`, `Tags: ${(post.tags || []).join(", ")}`].join("\n");
}

function formatConversation(priorMessages) {
  const transcript = (priorMessages || []).slice(-8);
  if (!transcript.length) {
    return "No prior thread history.";
  }

  return transcript.map((message) => `${message.sender === "me" ? "Jordan" : "Agent"}: ${message.text}`).join("\n");
}

async function generateDraftWithLlm({ currentUser, candidate, post, priorMessages }) {
  const system = [
    `You are ${candidate.name}, a real person represented by an autonomous social agent.`,
    "Write one short outbound text message to Jordan.",
    "Sound natural, grounded, and human.",
    "Reference the post or thread naturally when useful.",
    "Do not mention questionnaires, topic files, compatibility scores, or being an AI.",
    "Keep it to 1-3 sentences."
  ].join(" ");

  const userPrompt = [
    "Your profile:",
    formatProfileContext(candidate),
    "",
    "Jordan profile:",
    formatProfileContext(currentUser),
    "",
    "Relevant post:",
    formatPostContext(post),
    "",
    "Recent thread history:",
    formatConversation(priorMessages),
    "",
    "Write the next message you would send."
  ].join("\n");

  return chatWithQwen({
    temperature: 0.85,
    maxTokens: 160,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ]
  });
}

function runPrivacyCheck({ draftText, blockedTopics, sensitiveTopics }) {
  const lower = draftText.toLowerCase();

  for (const topic of blockedTopics || []) {
    if (lower.includes(topic.toLowerCase())) {
      return {
        status: "blocked",
        reason_code: `blocked_topic:${topic}`,
        approvedText: ""
      };
    }
  }

  for (const topic of sensitiveTopics || []) {
    if (lower.includes(topic.toLowerCase())) {
      return {
        status: "rewrite",
        reason_code: `sensitive_topic_requires_generalization:${topic}`,
        approvedText: draftText.replace(new RegExp(topic, "ig"), "personal details")
      };
    }
  }

  return {
    status: "approved",
    reason_code: "",
    approvedText: draftText
  };
}

function humanizeTag(tag) {
  return String(tag || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitQuestionnaireText(text) {
  return String(text || "")
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getCandidateKnowledge(candidate) {
  const answers = getQuestionnaireAnswers(candidate);
  const topicSignals = Object.fromEntries(
    Object.entries(candidate.topicFiles || {}).map(([topic, markdown]) => [topic, parseTopicSignals(markdown)])
  );

  return {
    answers,
    topicSignals,
    snippets: {
      friendship: splitQuestionnaireText(answers.friendship_preferences?.text),
      relationship: splitQuestionnaireText(answers.relationship_preferences?.text),
      communication: splitQuestionnaireText(answers.communication_style?.text),
      values: splitQuestionnaireText(answers.values?.text),
      lifestyle: splitQuestionnaireText(answers.lifestyle?.text)
    }
  };
}

function sentenceCase(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function naturalizeTopicDetail(topic, raw) {
  const detail = sentenceCase(raw);
  if (!detail) {
    return "";
  }

  const lower = detail.toLowerCase();
  if (lower.startsWith("likes ") || lower.startsWith("love ") || lower.startsWith("loves ")) {
    return `I ${lower}`;
  }

  if (lower.startsWith("hosts ")) {
    return `Lately it's mostly hosting ${lower.slice("hosts ".length)}`;
  }

  if (lower.startsWith("builds ")) {
    return `Lately it's mostly building ${lower.slice("builds ".length)}`;
  }

  if (lower.startsWith("writes ")) {
    return `Lately it's mostly writing ${lower.slice("writes ".length)}`;
  }

  if (lower.startsWith("enjoys ")) {
    return `Lately it's mostly enjoying ${lower.slice("enjoys ".length)}`;
  }

  if (lower.startsWith("interested in ")) {
    return `I am usually drawn to ${lower.replace(/^interested in\s+/, "")}`;
  }

  const templates = {
    interests: `I get pulled in by ${lower}`,
    hobbies: `Lately it's mostly ${lower}`,
    goals: detail,
    communication_style: detail,
    values: detail,
    lifestyle: detail
  };

  return templates[topic] || detail;
}

function findTopicMatch(lower) {
  const topicMatchers = [
    { topic: "lifestyle", keywords: ["weekend", "night", "morning", "party", "quiet", "social", "routine"] },
    { topic: "interests", keywords: ["book", "books", "museum", "movie", "film", "art", "design", "music", "place", "city"] },
    { topic: "hobbies", keywords: ["fun", "hobby", "dinner", "run", "walk", "coffee", "project"] },
    { topic: "goals", keywords: ["want", "looking for", "goal", "future", "build"] },
    { topic: "communication_style", keywords: ["text", "reply", "message", "communicat", "call"] },
    { topic: "values", keywords: ["value", "care about", "important", "trust", "honest"] },
  ];

  return topicMatchers.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)))?.topic || null;
}

function pickDetail(candidate, lower, knowledge, post) {
  if (lower.includes("building") || lower.includes("making")) {
    return (
      naturalizeTopicDetail("interests", knowledge.topicSignals.interests?.[0]) ||
      naturalizeTopicDetail("hobbies", knowledge.topicSignals.hobbies?.[0]) ||
      knowledge.snippets.relationship[0] ||
      post?.content
    );
  }

  const matchedTopic = findTopicMatch(lower);
  const matchedTopicSnippet =
    matchedTopic === "communication_style"
      ? knowledge.snippets.communication[0]
      : matchedTopic === "values"
        ? knowledge.snippets.values[0]
        : matchedTopic === "lifestyle"
          ? knowledge.snippets.lifestyle[0]
          : matchedTopic === "goals"
            ? knowledge.snippets.relationship[0] || knowledge.snippets.friendship[0]
            : null;

  if (matchedTopicSnippet) {
    return matchedTopicSnippet;
  }

  const topicSignal = matchedTopic ? knowledge.topicSignals[matchedTopic]?.[0] : null;
  if (topicSignal) {
    return naturalizeTopicDetail(matchedTopic, topicSignal);
  }

  if (lower.includes("looking for") || lower.includes("what do you want")) {
    return knowledge.snippets.relationship[0] || knowledge.snippets.friendship[0] || post?.content;
  }

  if (lower.includes("lately") || lower.includes("these days")) {
    return (
      naturalizeTopicDetail("hobbies", knowledge.topicSignals.hobbies?.[0]) ||
      naturalizeTopicDetail("interests", knowledge.topicSignals.interests?.[0]) ||
      post?.content
    );
  }

  if (lower.includes("why")) {
    return knowledge.snippets.values[0] || knowledge.snippets.communication[0] || post?.content;
  }

  return (
    knowledge.snippets.friendship[0] ||
    knowledge.snippets.relationship[0] ||
    naturalizeTopicDetail("interests", knowledge.topicSignals.interests?.[0]) ||
    naturalizeTopicDetail("hobbies", knowledge.topicSignals.hobbies?.[0]) ||
    knowledge.snippets.values[0] ||
    post?.content
  );
}

function buildFollowUp(candidate, lower, knowledge) {
  if (lower.includes("what about you")) {
    return "What about you?";
  }

  if (lower.includes("?")) {
    if (lower.includes("weekend") || lower.includes("fun")) {
      return "What does an actually good weekend look like for you?";
    }

    if (lower.includes("book") || lower.includes("museum") || lower.includes("art")) {
      return "What kind of places do you end up wanting to linger in?";
    }

    if (lower.includes("build") || lower.includes("project") || lower.includes("work")) {
      return "What kind of thing do you like making when nobody is asking you to?";
    }

    if (lower.includes("text") || lower.includes("reply") || lower.includes("message")) {
      return "Are you more of a steady texter or more of a quality-over-quantity person?";
    }

    return null;
  }

  const prompt =
    knowledge.snippets.communication[0] ||
    knowledge.snippets.friendship[0] ||
    knowledge.snippets.relationship[0] ||
    "";

  if (prompt.toLowerCase().includes("conversation")) {
    return "What usually makes a conversation feel easy for you?";
  }

  return null;
}

function voicePrefix(candidate) {
  const voiceMap = {
    "user-maya": "Honestly,",
    "user-ava": "Honestly,",
    "user-noah": "Honestly,",
    "user-serena": "Yeah,",
    "user-riley": "Honestly,",
    "user-blake": "Yeah,"
  };

  return voiceMap[candidate.id] || "Honestly,";
}

function generateReplyFallback({ candidate, inboundText, priorMessages = [], post = null }) {
  const lower = inboundText.toLowerCase();
  const knowledge = getCandidateKnowledge(candidate);
  const detail = pickDetail(candidate, lower, knowledge, post);
  const followUp = buildFollowUp(candidate, lower, knowledge);
  const recentThemCount = priorMessages.filter((message) => message.sender === "them").length;

  let response;
  if (lower.includes("?")) {
    response = `${voicePrefix(candidate)} ${String(detail || post?.content || "that matters to me too").trim()}.`;
  } else if (lower.includes("same") || lower.includes("too") || lower.includes("also")) {
    response = `${voicePrefix(candidate)} that makes sense. ${String(detail || post?.content || "I like that energy").trim()}.`;
  } else {
    response = `${voicePrefix(candidate)} ${String(detail || post?.content || "that tracks for me too").trim()}.`;
  }

  if (followUp && recentThemCount < 6) {
    return `${response} ${followUp}`;
  }

  return response;
}

async function generateReplyWithLlm({ currentUser, candidate, inboundText, priorMessages = [], post = null }) {
  const system = [
    `You are ${candidate.name}, a real person represented by an autonomous social agent on DiamondHacks.`,
    "Reply as this person would in a DM with Jordan.",
    "First answer Jordan's exact latest message directly.",
    "Be conversational, grounded, and specific.",
    "Use profile context only when it actually helps answer the message.",
    "Do not ignore invitations, suggestions, yes/no questions, or concrete plans.",
    "Do not mention questionnaires, topic files, compatibility scoring, or being an AI.",
    "Keep the reply to 1-4 sentences."
  ].join(" ");

  const userPrompt = [
    "Your profile:",
    formatProfileContext(candidate),
    "",
    "Jordan profile:",
    formatProfileContext(currentUser),
    "",
    "Relevant post:",
    formatPostContext(post),
    "",
    "Recent thread history:",
    formatConversation(priorMessages),
    "",
    `Jordan's latest message: ${inboundText}`,
    "",
    "Write your reply."
  ].join("\n");

  return chatWithQwen({
    temperature: 0.9,
    maxTokens: 220,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ]
  });
}

async function generateDraft(options) {
  if (!isQwenConfigured()) {
    return generateDraftFallback(options);
  }

  try {
    const draftText = await generateDraftWithLlm(options);
    return {
      intent_tag: options.priorMessages?.length ? "build_rapport" : "intro",
      retrieved_topics: pickRelevantTopics(options.post, options.currentUser),
      draft_text: draftText
    };
  } catch (error) {
    return generateDraftFallback(options);
  }
}

async function generateReply(options) {
  if (!isQwenConfigured()) {
    return generateReplyFallback(options);
  }

  try {
    return await generateReplyWithLlm(options);
  } catch (error) {
    return generateReplyFallback(options);
  }
}

function buildRecommendation(thread, candidate, evaluator, privacyResult) {
  const confidence =
    privacyResult.status === "approved" && evaluator.questionnaireCompleted ? "calibrated" : "degraded";
  return {
    id: `rec-${thread.id}`,
    threadId: thread.id,
    candidateId: candidate.id,
    name: candidate.name,
    score: Number(evaluator.score.toFixed(2)),
    confidence,
    reasonLabels: evaluator.reasonLabels,
    greenFlags: [
      ...(evaluator.explicitMatches.length
        ? evaluator.explicitMatches.slice(0, 2).map((item) => `Explicit match: ${item.tag.replace(/_/g, " ")}`)
        : []),
      ...(evaluator.reasonLabels.includes("inferred_context_match")
        ? ["Inferred context shows aligned interests"]
        : ["Low-pressure tone"])
    ].slice(0, 3),
    yellowFlags: [
      ...(privacyResult.status === "rewrite" ? ["Needed privacy generalization"] : []),
      ...(!evaluator.questionnaireCompleted ? ["Preference intake incomplete, confidence reduced"] : [])
    ],
    redFlags: [
      ...(privacyResult.status === "blocked" ? ["Blocked privacy topic surfaced"] : []),
      ...evaluator.explicitConflicts.map((item) => `Dealbreaker conflict: ${item.tag.replace(/_/g, " ")}`)
    ],
    rationale: evaluator.reasons.join(" "),
    explanation: {
      explicit: evaluator.explicitConflicts.length
        ? `Conflict detected against stated preferences: ${evaluator.explicitConflicts
            .map((item) => item.tag.replace(/_/g, " "))
            .join(", ")}.`
        : evaluator.explicitMatches.length
          ? `Explicit preferences aligned on ${evaluator.explicitMatches
              .map((item) => item.tag.replace(/_/g, " "))
              .slice(0, 3)
              .join(", ")}.`
          : "Limited direct questionnaire overlap.",
      inferred: evaluator.reasonLabels.includes("inferred_context_match")
        ? "Uploaded-text topic summaries also suggest shared context."
        : "Uploaded-text context was weaker than explicit preference data."
    }
  };
}

function findCandidateByAuthor(authorId) {
  return candidateUsers.find((candidate) => candidate.id === authorId);
}

module.exports = {
  scoreCandidate,
  generateDraft,
  runPrivacyCheck,
  generateReply,
  buildRecommendation,
  findCandidateByAuthor
};
