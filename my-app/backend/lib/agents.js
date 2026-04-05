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

function humanizeLabel(tag) {
  return String(tag || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mentionsRequiredConcept(text, requiredConcept) {
  const normalizedText = normalizeText(text);
  return normalizeText(requiredConcept)
    .split(" ")
    .filter(Boolean)
    .some((token) => normalizedText.includes(token));
}

function usesAvoidedPhrase(text, avoidPhrases = []) {
  const normalizedText = normalizeText(text);
  return avoidPhrases.some((phrase) => normalizedText.includes(normalizeText(phrase)));
}

function enforceDemoVariation(text, { requiredConcept = "", avoidPhrases = [], role = "opener" } = {}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return trimmed;
  }

  const needsRewrite = usesAvoidedPhrase(trimmed, avoidPhrases);
  const missingConcept = requiredConcept && !mentionsRequiredConcept(trimmed, requiredConcept);

  if (!needsRewrite && !missingConcept) {
    return trimmed;
  }

  if (role === "reply") {
    return `That makes sense. I keep coming back to ${requiredConcept}, which is probably why this conversation caught my attention.`;
  }

  return `Your post caught me because it made me think about ${requiredConcept}. I am curious what that looks like for you in real life.`;
}

function analyzeConversationDynamics(messages = [], currentUser, candidate) {
  const transcript = (messages || []).slice(-12);
  if (!transcript.length) {
    return {
      scoreDelta: 0,
      positiveSignals: [],
      cautionSignals: []
    };
  }

  const joined = transcript.map((message) => String(message.text || "")).join(" ").toLowerCase();
  const myMessages = transcript.filter((message) => message.sender === "me");
  const theirMessages = transcript.filter((message) => message.sender === "them");
  const myText = myMessages.map((message) => String(message.text || "")).join(" ").toLowerCase();
  const theirText = theirMessages.map((message) => String(message.text || "")).join(" ").toLowerCase();

  const positiveSignals = [];
  const cautionSignals = [];
  let scoreDelta = 0;

  const sharedTopicKeywords = [
    "museum",
    "book",
    "books",
    "bookstore",
    "coffee",
    "walk",
    "design",
    "project",
    "build",
    "gallery",
    "conversation",
    "writing"
  ];
  const sharedTopicCount = sharedTopicKeywords.filter((keyword) => myText.includes(keyword) && theirText.includes(keyword)).length;
  if (sharedTopicCount >= 2) {
    scoreDelta += Math.min(0.08, sharedTopicCount * 0.02);
    positiveSignals.push("Conversation shows repeated overlap in what both people naturally engage with");
  }

  const questionCount = transcript.filter((message) => String(message.text || "").includes("?")).length;
  if (questionCount >= 3) {
    scoreDelta += 0.04;
    positiveSignals.push("Both sides are sustaining curiosity instead of letting the thread flatten");
  }

  const affirmationKeywords = ["same", "exactly", "me too", "that makes sense", "agreed", "i am into that", "perfect"];
  const affirmationCount = affirmationKeywords.filter((phrase) => joined.includes(phrase)).length;
  if (affirmationCount >= 2) {
    scoreDelta += 0.03;
    positiveSignals.push("The exchange has clear signs of mutual affirmation and easy rapport");
  }

  const planKeywords = ["coffee", "dinner", "meet", "hang", "compare notes", "first meetup", "walk", "sometime"];
  if (planKeywords.some((keyword) => joined.includes(keyword))) {
    scoreDelta += 0.03;
    positiveSignals.push("The thread is moving toward concrete shared plans");
  }

  const mismatchKeywords = ["hate", "probably where we differ", "we differ", "we split", "not the same wavelength", "opposite", "mismatch"];
  const mismatchCount = mismatchKeywords.filter((phrase) => joined.includes(phrase)).length;
  if (mismatchCount > 0) {
    scoreDelta -= Math.min(0.12, mismatchCount * 0.04);
    cautionSignals.push("The conversation directly names meaningful mismatch or incompatibility");
  }

  const rejectionKeywords = [
    "i dont like you",
    "i don't like you",
    "not into you",
    "not feeling this",
    "this is not working",
    "we should stop talking",
    "i am not interested",
    "i'm not interested",
    "you are annoying",
    "you seem mean"
  ];
  const rejectionCount = rejectionKeywords.filter((phrase) => myText.includes(phrase) || theirText.includes(phrase)).length;
  if (rejectionCount > 0) {
    scoreDelta = Math.min(scoreDelta, 0) - Math.min(0.42, rejectionCount * 0.28);
    cautionSignals.push("A direct negative or rejecting message materially lowers the compatibility signal");
  }

  const pushyKeywords = ["come over", "send pics", "give me your number", "why are you ignoring", "answer me", "be honest right now"];
  const pushyCount = pushyKeywords.filter((phrase) => myText.includes(phrase)).length;
  if (pushyCount > 0) {
    scoreDelta -= Math.min(0.18, pushyCount * 0.08);
    cautionSignals.push("Jordan's messages are reading as pushier than this match is likely to enjoy");
  }

  const intensityKeywords = ["obsessed", "love you", "soulmate", "marry", "need you", "all day every day"];
  const intensityCount = intensityKeywords.filter((phrase) => myText.includes(phrase)).length;
  if (intensityCount > 0) {
    scoreDelta -= Math.min(0.12, intensityCount * 0.06);
    cautionSignals.push("The tone is getting more intense than the thread has earned");
  }

  const lowResponseSignal =
    myMessages.length >= 3 &&
    theirMessages.length > 0 &&
    theirMessages.length / Math.max(myMessages.length, 1) < 0.5;
  if (lowResponseSignal) {
    scoreDelta -= 0.04;
    cautionSignals.push("Reply cadence suggests the energy may be less mutual than the profile match looked");
  }

  const candidateAnswers = getQuestionnaireAnswers(candidate);
  const candidateStyleTags = new Set(getTags(candidateAnswers.communication_style));
  const candidateLifestyleTags = new Set(getTags(candidateAnswers.lifestyle));

  if (
    (candidateStyleTags.has("balanced_pace") || candidateStyleTags.has("steady") || candidateStyleTags.has("high_context")) &&
    (myText.includes("u up") || myText.includes("wyd") || myText.includes("pull up"))
  ) {
    scoreDelta -= 0.08;
    cautionSignals.push("The message style is clashing with the slower, more thoughtful pacing this match prefers");
  }

  if (
    (candidateLifestyleTags.has("low_chaos") || candidateLifestyleTags.has("quiet_weekends")) &&
    (myText.includes("club") || myText.includes("party all night") || myText.includes("crazy night"))
  ) {
    scoreDelta -= 0.06;
    cautionSignals.push("Recent messages are leaning into plans this match usually does not prefer");
  }

  return {
    scoreDelta: clamp(scoreDelta, -0.5, 0.18),
    positiveSignals,
    cautionSignals
  };
}

function scoreCandidate(currentUser, candidate, post, messages = []) {
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
  const conversationDynamics = analyzeConversationDynamics(messages, currentUser, candidate);
  const score = clamp(
    0.45 +
      overlap * 0.08 +
      sharedWords * 0.07 +
      postAffinity +
      explicitMatchBoost -
      explicitConflictPenalty -
      missingQuestionnairePenalty +
      conversationDynamics.scoreDelta,
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
      sharedWords ? `Topic files show ${sharedWords} stronger compatibility cues.` : "Compatibility mostly driven by post-level intent.",
      ...conversationDynamics.positiveSignals,
      ...conversationDynamics.cautionSignals
    ],
    positiveSignals: conversationDynamics.positiveSignals,
    cautionSignals: conversationDynamics.cautionSignals,
    conversationScoreDelta: conversationDynamics.scoreDelta,
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

function extractFinalReply(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return "";
  }

  const explicitMarker = text.match(/FINAL_REPLY:\s*([\s\S]*)/i);
  if (explicitMarker?.[1]) {
    return explicitMarker[1].trim().replace(/^["']|["']$/g, "");
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\d+\./.test(line))
    .filter((line) => !/^[-*]/.test(line))
    .filter((line) => !/^(analyze|analysis|reasoning|persona|context|constraint|values)\b/i.test(line));

  if (!lines.length) {
    return text;
  }

  return lines[lines.length - 1].replace(/^["']|["']$/g, "");
}

function looksLikeReasoningDump(text) {
  const lower = String(text || "").toLowerCase();
  return (
    lower.includes("analyze") ||
    lower.includes("analysis") ||
    lower.includes("constraint") ||
    lower.includes("persona:") ||
    lower.includes("context:") ||
    /^\d+\.\s+\*\*/m.test(String(text || "")) ||
    lower.includes("evaluate the plan")
  );
}

async function rewriteModelOutputToMessage(rawOutput) {
  const response = await chatWithQwen({
    temperature: 0.2,
    maxTokens: 120,
    stopSequences: ["\n"],
    messages: [
      {
        role: "system",
        content:
          "Convert internal analysis into one natural DM reply. Output exactly one line in this format and nothing else: FINAL_REPLY: <message>"
      },
      {
        role: "user",
        content: `Turn this into a short natural message and remove all analysis:\n\n${rawOutput}`
      },
      { role: "assistant", content: "FINAL_REPLY: " }
    ]
  });

  return extractFinalReply(response);
}

async function generateDraftWithLlm({
  currentUser,
  candidate,
  post,
  priorMessages,
  variationHint = "",
  demoNonce = "",
  avoidPhrases = [],
  requiredConcept = ""
}) {
  const system = [
    `You are ${candidate.name}, a real person represented by an autonomous social agent.`,
    "Write one short outbound text message to Jordan.",
    "Sound natural, grounded, and human.",
    "Reference the post or thread naturally when useful.",
    "Do not mention questionnaires, topic files, compatibility scores, or being an AI.",
    ...(avoidPhrases.length ? [`Do not use or closely paraphrase these exact phrases: ${avoidPhrases.join(" | ")}`] : []),
    "Keep it to 1-3 sentences.",
    "Output exactly one line in this format and nothing else: FINAL_REPLY: <message>"
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
    variationHint ? `Conversation variation hint: ${variationHint}` : "",
    demoNonce ? `Run marker: ${demoNonce}` : "",
    "",
    requiredConcept ? `For this run, explicitly anchor the message in this concept: ${requiredConcept}` : "",
    "Write the next message you would send."
  ].join("\n");

  const response = await chatWithQwen({
    temperature: 0.85,
    maxTokens: 160,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
      { role: "assistant", content: "FINAL_REPLY: " }
    ],
    stopSequences: ["\n"]
  });

  const finalReply = extractFinalReply(response);
  if (looksLikeReasoningDump(finalReply)) {
    return rewriteModelOutputToMessage(finalReply);
  }

  return finalReply;
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

async function generateReplyWithLlm({
  currentUser,
  candidate,
  inboundText,
  priorMessages = [],
  post = null,
  variationHint = "",
  demoNonce = "",
  avoidPhrases = [],
  requiredConcept = ""
}) {
  const system = [
    `You are ${candidate.name}, a real person represented by an autonomous social agent on DiamondHacks.`,
    "Reply as this person would in a DM with Jordan.",
    "First answer Jordan's exact latest message directly.",
    "Be conversational, grounded, and specific.",
    "Use profile context only when it actually helps answer the message.",
    "Do not ignore invitations, suggestions, yes/no questions, or concrete plans.",
    "Do not mention questionnaires, topic files, compatibility scoring, or being an AI.",
    ...(avoidPhrases.length ? [`Do not use or closely paraphrase these exact phrases: ${avoidPhrases.join(" | ")}`] : []),
    "Keep the reply to 1-4 sentences.",
    "Output exactly one line in this format and nothing else: FINAL_REPLY: <message>"
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
    variationHint ? `Conversation variation hint: ${variationHint}` : "",
    demoNonce ? `Run marker: ${demoNonce}` : "",
    "",
    requiredConcept ? `For this run, keep the reply grounded in this concept when natural: ${requiredConcept}` : "",
    "Write your reply."
  ].join("\n");

  const response = await chatWithQwen({
    temperature: 0.9,
    maxTokens: 220,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
      { role: "assistant", content: "FINAL_REPLY: " }
    ],
    stopSequences: ["\n"]
  });

  const finalReply = extractFinalReply(response);
  if (looksLikeReasoningDump(finalReply)) {
    return rewriteModelOutputToMessage(finalReply);
  }

  return finalReply;
}

async function generateDraft(options = {}) {
  if (!isQwenConfigured()) {
    if (options.requireLlm) {
      throw new Error("qwen_not_configured");
    }
    return generateDraftFallback(options);
  }

  try {
    const draftText = await generateDraftWithLlm(options);
    return {
      intent_tag: options.priorMessages?.length ? "build_rapport" : "intro",
      retrieved_topics: pickRelevantTopics(options.post, options.currentUser),
      draft_text: enforceDemoVariation(draftText, {
        requiredConcept: options.requiredConcept,
        avoidPhrases: options.avoidPhrases,
        role: "opener"
      })
    };
  } catch (error) {
    if (options.requireLlm) {
      throw error;
    }
    return generateDraftFallback(options);
  }
}

async function generateReply(options = {}) {
  if (!isQwenConfigured()) {
    if (options.requireLlm) {
      throw new Error("qwen_not_configured");
    }
    return generateReplyFallback(options);
  }

  try {
    const replyText = await generateReplyWithLlm(options);
    return enforceDemoVariation(replyText, {
      requiredConcept: options.requiredConcept,
      avoidPhrases: options.avoidPhrases,
      role: "reply"
    });
  } catch (error) {
    if (options.requireLlm) {
      throw error;
    }
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

function pickConversationTopics(messages = [], post = null) {
  const text = [...messages.map((message) => message.text), post?.content || ""].join(" ").toLowerCase();
  const topicSignals = [
    {
      label: "Shared interest in culture, books, or places with texture",
      keywords: ["museum", "book", "bookstore", "poetry", "design", "city", "art", "gallery"]
    },
    {
      label: "Mutual curiosity around projects, products, or how ideas get made",
      keywords: ["project", "product", "build", "constraints", "ai", "tool", "startup"]
    },
    {
      label: "Similar preference for thoughtful pacing and longer conversations",
      keywords: ["linger", "slow", "pace", "conversation", "thoughtful", "weekend", "steady"]
    },
    {
      label: "Discussion around social energy, hosting, or the kind of plans that feel natural",
      keywords: ["dinner", "community", "host", "event", "afterparty", "gallery", "plans"]
    },
    {
      label: "Possible mismatch around nightlife, chaos, or spontaneity",
      keywords: ["loud", "nightlife", "chaos", "spontaneous", "party", "last-minute"]
    },
    {
      label: "Direct conversation about consistency, effort, and emotional steadiness",
      keywords: ["consistent", "follow-through", "effort", "honesty", "steady", "emotional", "depth"]
    }
  ];

  return topicSignals
    .filter((topic) => topic.keywords.some((keyword) => text.includes(keyword)))
    .map((topic) => topic.label)
    .slice(0, 3);
}

function gatherStrengths(user) {
  const answers = getQuestionnaireAnswers(user);
  const orderedFields = ["friendship_preferences", "relationship_preferences", "communication_style", "values", "lifestyle"];
  const seen = new Set();
  const strengths = [];

  orderedFields.forEach((field) => {
    getTags(answers[field]).forEach((tag) => {
      if (seen.has(tag)) {
        return;
      }
      seen.add(tag);
      strengths.push(humanizeLabel(tag));
    });
  });

  return strengths.slice(0, 4);
}

function gatherConcerns(currentUser, candidate, evaluator) {
  const currentAnswers = getQuestionnaireAnswers(currentUser);
  const candidateAnswers = getQuestionnaireAnswers(candidate);
  const currentConcerns = [];
  const candidateConcerns = [];

  evaluator.explicitConflicts.forEach((conflict) => {
    const label = humanizeLabel(conflict.tag);
    if (conflict.source === "current_user") {
      currentConcerns.push(`May run into Jordan's dealbreaker around ${label.toLowerCase()}`);
    } else {
      candidateConcerns.push(`May run into ${candidate.name}'s dealbreaker around ${label.toLowerCase()}`);
    }
  });

  const currentLifestyle = new Set(getTags(currentAnswers.lifestyle));
  const candidateLifestyle = new Set(getTags(candidateAnswers.lifestyle));
  const currentCommunication = new Set(getTags(currentAnswers.communication_style));
  const candidateCommunication = new Set(getTags(candidateAnswers.communication_style));

  if (
    currentLifestyle.has("quiet_weekends") &&
    (candidateLifestyle.has("social") || candidateLifestyle.has("nightlife") || candidateLifestyle.has("host"))
  ) {
    currentConcerns.push("Jordan tends to prefer quieter plans than this match's default social rhythm");
  }

  if (
    candidateLifestyle.has("low_accountability") ||
    candidateLifestyle.has("convenience_first") ||
    candidateCommunication.has("low_investment")
  ) {
    currentConcerns.push("Signals lower follow-through than Jordan usually wants");
  }

  if (
    candidateCommunication.has("fast_reply") &&
    (currentCommunication.has("balanced_pace") || currentCommunication.has("steady"))
  ) {
    candidateConcerns.push("Jordan's pace is more measured than this match's ideal response rhythm");
  }

  if (
    candidateLifestyle.has("social") &&
    (currentLifestyle.has("low_chaos") || currentLifestyle.has("quiet_weekends"))
  ) {
    candidateConcerns.push("Jordan is lower-chaos and more selective about plans than this match may expect");
  }

  (evaluator.cautionSignals || []).forEach((signal) => {
    currentConcerns.push(signal);
  });

  return {
    currentConcerns: [...new Set(currentConcerns)].slice(0, 3),
    candidateConcerns: [...new Set(candidateConcerns)].slice(0, 3)
  };
}

function compatibilityLabel(score) {
  if (score >= 0.82) {
    return "High";
  }
  if (score >= 0.66) {
    return "Promising";
  }
  if (score >= 0.5) {
    return "Mixed";
  }
  return "Low";
}

function buildThreadSummary({ thread, currentUser, candidate, messages = [], evaluator, recommendation, post }) {
  const keyPoints = pickConversationTopics(messages, post);
  const jordanPositives = gatherStrengths(currentUser);
  const candidatePositives = gatherStrengths(candidate);
  const concerns = gatherConcerns(currentUser, candidate, evaluator);
  const score = Number((recommendation?.score ?? evaluator.score).toFixed(2));

  return {
    threadId: thread.id,
    candidateId: candidate.id,
    candidateName: candidate.name,
    compatibility: {
      score,
      label: compatibilityLabel(score),
      rationale: recommendation?.rationale || evaluator.reasons.join(" ")
    },
    keyPoints: keyPoints.length ? keyPoints : ["The conversation is still light, so the signal is mostly coming from profile and post alignment."],
    jordan: {
      positives: jordanPositives.length ? jordanPositives : ["Thoughtful communication", "Clear intent"],
      concerns: concerns.currentConcerns.length ? concerns.currentConcerns : ["No major concerns surfaced yet."]
    },
    counterpart: {
      name: candidate.name,
      positives: candidatePositives.length ? candidatePositives : ["Clear communication", "Some profile alignment"],
      concerns: concerns.candidateConcerns.length ? concerns.candidateConcerns : ["No major concerns surfaced yet."]
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
  buildThreadSummary,
  findCandidateByAuthor
};
