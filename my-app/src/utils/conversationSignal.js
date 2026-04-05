function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getConversationScoreDelta(messages = []) {
  const transcript = (messages || []).slice(-12);
  if (!transcript.length) {
    return 0;
  }

  const joined = transcript.map((message) => String(message.text || "")).join(" ").toLowerCase();
  const myMessages = transcript.filter((message) => message.sender === "me");
  const theirMessages = transcript.filter((message) => message.sender === "them");
  const myText = myMessages.map((message) => String(message.text || "")).join(" ").toLowerCase();
  const theirText = theirMessages.map((message) => String(message.text || "")).join(" ").toLowerCase();

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
  }

  const questionCount = transcript.filter((message) => String(message.text || "").includes("?")).length;
  if (questionCount >= 3) {
    scoreDelta += 0.04;
  }

  const affirmationKeywords = ["same", "exactly", "me too", "that makes sense", "agreed", "i am into that", "perfect"];
  const affirmationCount = affirmationKeywords.filter((phrase) => joined.includes(phrase)).length;
  if (affirmationCount >= 2) {
    scoreDelta += 0.03;
  }

  const planKeywords = ["coffee", "dinner", "meet", "hang", "compare notes", "first meetup", "walk", "sometime"];
  if (planKeywords.some((keyword) => joined.includes(keyword))) {
    scoreDelta += 0.03;
  }

  const mismatchKeywords = ["hate", "probably where we differ", "we differ", "we split", "not the same wavelength", "opposite", "mismatch"];
  const mismatchCount = mismatchKeywords.filter((phrase) => joined.includes(phrase)).length;
  if (mismatchCount > 0) {
    scoreDelta -= Math.min(0.12, mismatchCount * 0.04);
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
  }

  const pushyKeywords = ["come over", "send pics", "give me your number", "why are you ignoring", "answer me", "be honest right now"];
  const pushyCount = pushyKeywords.filter((phrase) => myText.includes(phrase)).length;
  if (pushyCount > 0) {
    scoreDelta -= Math.min(0.18, pushyCount * 0.08);
  }

  const intensityKeywords = ["obsessed", "love you", "soulmate", "marry", "need you", "all day every day"];
  const intensityCount = intensityKeywords.filter((phrase) => myText.includes(phrase)).length;
  if (intensityCount > 0) {
    scoreDelta -= Math.min(0.12, intensityCount * 0.06);
  }

  const lowResponseSignal =
    myMessages.length >= 3 &&
    theirMessages.length > 0 &&
    theirMessages.length / Math.max(myMessages.length, 1) < 0.5;
  if (lowResponseSignal) {
    scoreDelta -= 0.04;
  }

  if (myText.includes("u up") || myText.includes("wyd") || myText.includes("pull up")) {
    scoreDelta -= 0.08;
  }

  if (myText.includes("club") || myText.includes("party all night") || myText.includes("crazy night")) {
    scoreDelta -= 0.06;
  }

  return clamp(scoreDelta, -0.5, 0.18);
}

export function applyConversationScore(baseScore = 0, messages = []) {
  return clamp(baseScore + getConversationScoreDelta(messages), 0.08, 0.96);
}
