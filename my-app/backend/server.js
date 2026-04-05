const http = require("http");
const { URL } = require("url");
const { getStore, saveStore } = require("./lib/store");
const { currentUserId } = require("./lib/seedData");
const { runTextSorter } = require("./lib/textSorter");
const {
  scoreCandidate,
  generateDraft,
  runPrivacyCheck,
  generateReply,
  buildRecommendation,
  findCandidateByAuthor
} = require("./lib/agents");

const PORT = process.env.PORT || 8787;
const clientsByThread = new Map();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
  });
  res.end(JSON.stringify(data));
}

function sendNoContent(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
  });
  res.end();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function eventTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function listThreads(store) {
  return [...store.threads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getMessages(store, threadId) {
  return [...(store.messages[threadId] || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function broadcastEvent(threadId, payload) {
  const clients = clientsByThread.get(threadId) || [];
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => client.write(message));
}

function pushEvent(store, threadId, event) {
  const payload = {
    event_id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    schema_version: store.schemaVersion,
    timestamp: new Date().toISOString(),
    queue_status: store.sessions[threadId]?.queueStatus || "normal",
    ...event
  };
  store.events[threadId] = [payload, ...(store.events[threadId] || [])].slice(0, 50);
  broadcastEvent(threadId, payload);
}

function addMessage(store, threadId, sender, text) {
  const createdAt = new Date().toISOString();
  const message = {
    id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    threadId,
    sender,
    text,
    time: eventTime(createdAt),
    createdAt
  };
  store.messages[threadId] = [...(store.messages[threadId] || []), message];
  const thread = store.threads.find((item) => item.id === threadId);
  if (thread) {
    thread.lastPreview = text;
    thread.updatedAt = createdAt;
  }
  return message;
}

function ensureThreadForPost(store, post) {
  const candidate = findCandidateByAuthor(post.authorId);
  if (!candidate) {
    return null;
  }

  let thread = store.threads.find((item) => item.counterpartId === candidate.id);
  if (!thread) {
    const createdAt = new Date().toISOString();
    thread = {
      id: `t-${Date.now()}`,
      participantIds: [currentUserId, candidate.id],
      name: candidate.name,
      counterpartId: candidate.id,
      status: "connected",
      compatibilityScore: 0,
      confidence: "calibrated",
      intentSummary: "Fresh agent session created from post outreach.",
      lastPreview: "",
      updatedAt: createdAt
    };
    store.threads.push(thread);
    store.messages[thread.id] = [];
    store.events[thread.id] = [];
    store.sessions[thread.id] = {
      threadId: thread.id,
      usedMessages: 0,
      turnRetryUsed: 0,
      connectionStatus: "connected",
      queueStatus: "normal",
      degradedMode: false
    };
  }

  return thread;
}

function buildBootstrap(store) {
  const currentUser = store.users[currentUserId];
  const threads = listThreads(store);
  const messages = Object.fromEntries(threads.map((thread) => [thread.id, getMessages(store, thread.id)]));
  const events = Object.fromEntries(threads.map((thread) => [thread.id, store.events[thread.id] || []]));
  const recommendations = threads
    .map((thread) => {
      const candidate = store.users[thread.counterpartId];
      const sourcePost =
        store.posts.find((post) => post.authorId === thread.counterpartId) ||
        store.posts.find((post) => post.authorId === candidate?.id);

      if (!candidate || !sourcePost) {
        return null;
      }

      const evaluator = scoreCandidate(currentUser, candidate, sourcePost);
      thread.compatibilityScore = Number(evaluator.score.toFixed(2));
      thread.confidence = evaluator.questionnaireCompleted ? "calibrated" : "degraded";
      thread.intentSummary = evaluator.reasons.join(" ");
      return buildRecommendation(thread, candidate, evaluator, { status: "approved" });
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  store.recommendations = recommendations;

  return {
    schemaVersion: store.schemaVersion,
    currentUserId,
    posts: [...store.posts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    profile: currentUser,
    threads,
    messages,
    events,
    sessions: store.sessions,
    recommendations
  };
}

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendNoContent(res);
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const store = getStore();

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(res, 200, buildBootstrap(store));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/posts") {
    sendJson(res, 200, [...store.posts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/posts") {
    const body = await parseBody(req);
    const post = {
      id: `p-${Date.now()}`,
      authorId: currentUserId,
      author: "You",
      timestamp: new Date().toISOString(),
      content: body.content || "",
      tags: body.tags?.length ? body.tags : ["new"]
    };
    store.posts.unshift(post);

    const recommendations = store.posts
      .filter((candidatePost) => candidatePost.authorId !== currentUserId)
      .map((candidatePost) => {
        const candidate = findCandidateByAuthor(candidatePost.authorId);
        const evaluator = scoreCandidate(store.users[currentUserId], candidate, candidatePost);
        return { candidatePost, candidate, evaluator };
      })
      .filter((item) => item.candidate && item.evaluator.shouldDm)
      .sort((a, b) => b.evaluator.score - a.evaluator.score);

    recommendations.slice(0, 2).forEach(({ candidatePost, candidate, evaluator }) => {
      const thread = ensureThreadForPost(store, candidatePost);
      if (!thread) {
        return;
      }

      thread.compatibilityScore = Number(evaluator.score.toFixed(2));
      thread.intentSummary = evaluator.reasons.join(" ");
      const recommendation = buildRecommendation(thread, candidate, evaluator, { status: "approved" });
      store.recommendations = [
        recommendation,
        ...store.recommendations.filter((item) => item.threadId !== thread.id)
      ].sort((a, b) => b.score - a.score);

      pushEvent(store, thread.id, {
        stage: "candidate_select",
        status: "ok",
        reason_code: "",
        turn_index: store.sessions[thread.id].usedMessages
      });
    });

    saveStore(store);
    sendJson(res, 201, {
      post,
      threads: listThreads(store),
      recommendations: store.recommendations
    });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/profile") {
    const body = await parseBody(req);
    store.users[currentUserId] = {
      ...store.users[currentUserId],
      name: body.name,
      bio: body.bio,
      privacy: body.privacy,
      questionnaire: body.questionnaire || store.users[currentUserId].questionnaire
    };
    saveStore(store);
    sendJson(res, 200, store.users[currentUserId]);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile/context") {
    const body = await parseBody(req);
    const result = runTextSorter({
      userId: currentUserId,
      text: body.text,
      privacy: store.users[currentUserId].privacy
    });

    if (result.error) {
      sendJson(res, 400, result);
      return;
    }

    store.users[currentUserId].uploadedSources = [
      {
        fileName: body.fileName || "pasted-context.txt",
        uploadedAt: new Date().toISOString()
      },
      ...store.users[currentUserId].uploadedSources
    ].slice(0, 10);
    store.users[currentUserId].topicFiles = {
      ...store.users[currentUserId].topicFiles,
      ...result.topicFiles
    };
    saveStore(store);
    sendJson(res, 200, {
      result,
      profile: store.users[currentUserId]
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/recommendations") {
    sendJson(res, 200, [...store.recommendations].sort((a, b) => b.score - a.score));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/threads") {
    sendJson(res, 200, listThreads(store));
    return;
  }

  if (req.method === "GET" && /^\/api\/threads\/[^/]+\/messages$/.test(url.pathname)) {
    const threadId = url.pathname.split("/")[3];
    sendJson(res, 200, {
      messages: getMessages(store, threadId),
      session: store.sessions[threadId],
      events: store.events[threadId] || []
    });
    return;
  }

  if (req.method === "GET" && /^\/api\/threads\/[^/]+\/events$/.test(url.pathname)) {
    const threadId = url.pathname.split("/")[3];
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write(`data: ${JSON.stringify({ type: "connected", threadId })}\n\n`);

    const clients = clientsByThread.get(threadId) || [];
    clients.push(res);
    clientsByThread.set(threadId, clients);

    req.on("close", () => {
      const next = (clientsByThread.get(threadId) || []).filter((client) => client !== res);
      clientsByThread.set(threadId, next);
    });
    return;
  }

  if (req.method === "POST" && /^\/api\/threads\/[^/]+\/send$/.test(url.pathname)) {
    const threadId = url.pathname.split("/")[3];
    const body = await parseBody(req);
    const thread = store.threads.find((item) => item.id === threadId);
    if (!thread) {
      sendJson(res, 404, { error: "thread_not_found" });
      return;
    }

    const candidate = store.users[thread.counterpartId];
    const currentUser = store.users[currentUserId];
    const sourcePost = store.posts.find((post) => post.authorId === candidate.id) || store.posts[0];
    const session = store.sessions[threadId];

    pushEvent(store, threadId, {
      stage: "texting_draft",
      status: "ok",
      reason_code: "",
      turn_index: session.usedMessages
    });

    const drafted = await generateDraft({
      currentUser,
      candidate,
      post: sourcePost,
      priorMessages: getMessages(store, threadId)
    });
    const outboundText = body.text?.trim() || drafted.draft_text;
    const privacy = runPrivacyCheck({
      draftText: outboundText,
      blockedTopics: currentUser.privacy.blocked,
      sensitiveTopics: currentUser.privacy.sensitive
    });

    if (privacy.status === "blocked") {
      session.turnRetryUsed = Math.min(session.turnRetryUsed + 1, 3);
      pushEvent(store, threadId, {
        stage: "rewrite",
        status: "warn",
        reason_code: privacy.reason_code,
        turn_index: session.usedMessages
      });
      saveStore(store);
      sendJson(res, 200, {
        ok: false,
        reason_code: privacy.reason_code,
        session,
        events: store.events[threadId]
      });
      return;
    }

    pushEvent(store, threadId, {
      stage: "privacy_check",
      status: privacy.status === "approved" ? "ok" : "warn",
      reason_code: privacy.reason_code,
      turn_index: session.usedMessages
    });

    const sent = addMessage(store, threadId, "me", privacy.approvedText);
    session.usedMessages += 1;
    session.turnRetryUsed = 0;

    pushEvent(store, threadId, {
      stage: "send",
      status: "ok",
      reason_code: privacy.reason_code,
      turn_index: session.usedMessages
    });

    const reply = addMessage(
      store,
      threadId,
      "them",
      await generateReply({
        currentUser,
        candidate,
        inboundText: privacy.approvedText,
        priorMessages: getMessages(store, threadId),
        post: sourcePost
      })
    );
    const evaluator = scoreCandidate(currentUser, candidate, sourcePost);
    const recommendation = buildRecommendation(thread, candidate, evaluator, privacy);
    thread.compatibilityScore = recommendation.score;
    thread.confidence = recommendation.confidence;
    thread.intentSummary = recommendation.rationale;
    store.recommendations = [
      recommendation,
      ...store.recommendations.filter((item) => item.threadId !== thread.id)
    ].sort((a, b) => b.score - a.score);

    pushEvent(store, threadId, {
      stage: "summary_update",
      status: "ok",
      reason_code: "",
      turn_index: session.usedMessages
    });

    saveStore(store);
    sendJson(res, 200, {
      ok: true,
      sent,
      reply,
      thread,
      session,
      recommendation,
      events: store.events[threadId]
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(res, 500, { error: "server_error", details: error.message });
  });
});

server.listen(PORT, () => {
  console.log(`DiamondHacks backend listening on http://localhost:${PORT}`);
});
