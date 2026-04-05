import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import StatusChip from "../components/StatusChip";
import { mapReasonCode } from "../utils/reasonCodeMap";
import { SESSION_LIMITS, CONNECTION_STATES, SIGNAL_THRESHOLDS } from "../utils/constants";
import { sendThreadMessage } from "../services/api";

function compatibilityLabel(score) {
  if (score >= SIGNAL_THRESHOLDS.HIGH) return "High";
  if (score >= SIGNAL_THRESHOLDS.PROMISING) return "Promising";
  if (score >= 0.5) return "Mixed";
  return "Low";
}

export default function MessagesPage({
  threads,
  messages,
  session,
  recommendations,
  threadSummaries,
  activeThreadId,
  setActiveThreadId,
  setMessages,
  setEventsByThread,
  setThreads,
  setSessions,
  setThreadSummaries,
  setRecommendations
}) {
  const [draft, setDraft] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef(null);
  const previousMessageMetaByThread = useRef({});

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const threadMessages = useMemo(() => messages[activeThread?.id] || [], [activeThread?.id, messages]);
  const lastMessageId = threadMessages[threadMessages.length - 1]?.id || "";
  const activeSummary = threadSummaries[activeThread?.id];
  const activeRecommendation = useMemo(
    () => recommendations.find((recommendation) => recommendation.threadId === activeThread?.id),
    [activeThread?.id, recommendations]
  );
  const latestEvent = session.events[0];
  const activeSignalScore = activeRecommendation?.score || 0;
  const displayedCompatibilityScore = activeRecommendation?.score ?? activeSummary?.compatibility?.score ?? 0;
  const displayedCompatibilityLabel = compatibilityLabel(displayedCompatibilityScore);
  const signalAllowsMessaging =
    session.connectionStatus === CONNECTION_STATES.CONNECTED ||
    (session.connectionStatus !== CONNECTION_STATES.NOT_CONNECTED && activeSignalScore >= SIGNAL_THRESHOLDS.PROMISING);
  const signalStateLabel =
    activeSignalScore >= SIGNAL_THRESHOLDS.HIGH ? "high" : activeSignalScore >= SIGNAL_THRESHOLDS.PROMISING ? "promising" : "below_threshold";
  const highSignalThreads = useMemo(() => {
    const recommendationByThreadId = new Map(recommendations.map((recommendation) => [recommendation.threadId, recommendation]));

    return threads
      .map((thread) => {
        const recommendation = recommendationByThreadId.get(thread.id);
        if (!recommendation || recommendation.score < SIGNAL_THRESHOLDS.PROMISING) {
          return null;
        }

        return {
          ...thread,
          recommendation
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.recommendation.score - a.recommendation.score);
  }, [recommendations, threads]);

  const disabledReason = useMemo(() => {
    if (!signalAllowsMessaging) return "A promising signal is required before messaging opens";
    if (session.usedMessages >= SESSION_LIMITS.maxMessages) return "Message cap reached";
    if (session.turnRetryUsed >= SESSION_LIMITS.maxPrivacyRetries) return "Retry limit reached";
    return "";
  }, [signalAllowsMessaging, session.usedMessages, session.turnRetryUsed]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(remaining <= 80);
  }, [activeThread?.id]);

  useEffect(() => {
    if (!activeThread?.id) return;
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    });
  }, [activeThread?.id]);

  useEffect(() => {
    const threadId = activeThread?.id;
    if (!threadId) return;

    const previousMeta = previousMessageMetaByThread.current[threadId];
    const nextMeta = {
      count: threadMessages.length,
      lastMessageId
    };

    if (!previousMeta) {
      previousMessageMetaByThread.current[threadId] = nextMeta;
      return;
    }

    const hasNewMessage = nextMeta.lastMessageId && nextMeta.lastMessageId !== previousMeta.lastMessageId;
    previousMessageMetaByThread.current[threadId] = nextMeta;

    if (!hasNewMessage || !isNearBottom) return;
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [activeThread?.id, threadMessages.length, lastMessageId, isNearBottom]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(remaining <= 80);
  }

  async function simulateSend() {
    if (!signalAllowsMessaging || !session.canSend || !draft.trim()) return;
    if (!activeThread?.id) return;

    setIsSending(true);
    try {
      const response = await sendThreadMessage(activeThread.id, { text: draft.trim() });
      if (response.ok) {
        setMessages((prev) => ({
          ...prev,
          [activeThread.id]: [...(prev[activeThread.id] || []), response.sent, response.reply]
        }));
        setThreads((prev) =>
          prev.map((thread) => (thread.id === activeThread.id ? { ...thread, ...response.thread } : thread))
        );
        setSessions((prev) => ({
          ...prev,
          [activeThread.id]: response.session
        }));
        setThreadSummaries((prev) => ({
          ...prev,
          [activeThread.id]: response.threadSummary
        }));
        setEventsByThread((prev) => ({
          ...prev,
          [activeThread.id]: response.events
        }));
        setRecommendations((prev) =>
          [response.recommendation, ...prev.filter((item) => item.threadId !== response.recommendation.threadId)].sort(
            (a, b) => b.score - a.score
          )
        );
        session.applyServerState(response.session, response.events);
        setDraft("");
      } else {
        setEventsByThread((prev) => ({
          ...prev,
          [activeThread.id]: response.events
        }));
        session.applyServerState(response.session, response.events);
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
      <div className="space-y-4">
        <Card title="High-Signal Matches">
          {highSignalThreads.length ? (
            <ul className="space-y-2">
              {highSignalThreads.map((thread) => {
                const isActive = activeThreadId === thread.id;
                const compatibilityLabel =
                  thread.recommendation.score >= SIGNAL_THRESHOLDS.HIGH ? "High" : "Promising";

                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => setActiveThreadId(thread.id)}
                      className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                        isActive ? "" : "hover:bg-white/50"
                      }`}
                      style={
                        isActive
                          ? { background: "rgba(255, 234, 226, 0.9)" }
                          : { background: "rgba(255, 251, 249, 0.72)" }
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                          {thread.name}
                        </p>
                        <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: "rgba(242, 116, 67, 0.14)", color: "var(--accent-deep)" }}>
                          {Math.round(thread.recommendation.score * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-soft)" }}>
                        {compatibilityLabel} signal
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                        {thread.lastPreview}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              Promising or high-signal matches will appear here once they clear the messaging threshold.
            </p>
          )}
        </Card>

        <Card title="All Threads">
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                    activeThreadId === thread.id ? "" : "hover:bg-white/50"
                  }`}
                  style={
                    activeThreadId === thread.id
                      ? { background: "rgba(255, 234, 226, 0.9)" }
                      : { background: "rgba(255, 251, 249, 0.72)" }
                  }
                >
                  <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                    {thread.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                    {thread.lastPreview}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title={activeThread?.name || "Messages"}>
          <div className="chat-shell">
            <div ref={scrollRef} onScroll={handleScroll} className="chat-scroll">
              <div className="space-y-2 pr-1">
                {threadMessages.length ? (
                  threadMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        message.sender === "me"
                          ? "ml-auto text-white"
                          : message.sender === "system"
                            ? "bg-amber-50 text-amber-800"
                            : ""
                      }`}
                      style={
                        message.sender === "me"
                          ? {
                              background: "linear-gradient(135deg, var(--accent-main) 0%, var(--accent-deep) 100%)",
                              overflowWrap: "anywhere"
                            }
                          : message.sender === "system"
                            ? { overflowWrap: "anywhere" }
                            : {
                                background: "rgba(255, 239, 233, 0.92)",
                                color: "var(--text-main)",
                                overflowWrap: "anywhere"
                              }
                      }
                    >
                      <p>{message.text}</p>
                      <p className="mt-1 text-[10px] opacity-70">{message.time}</p>
                    </div>
                  ))
                ) : (
                  <div
                    className="rounded-[24px] border border-dashed px-4 py-5 text-sm"
                    style={{ background: "rgba(255, 248, 245, 0.82)", color: "var(--text-soft)" }}
                  >
                    Agents are reviewing this match now. If it looks promising, the thread will populate here automatically.
                  </div>
                )}
              </div>
            </div>

            <div className="chat-footer">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!signalAllowsMessaging || !session.canSend}
                className="soft-input min-h-24 w-full disabled:bg-[#f5e5e2]"
                placeholder={disabledReason || "Write a message..."}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                  AI-generated content is policy-filtered.
                </p>
                <button
                  type="button"
                  onClick={simulateSend}
                  disabled={!signalAllowsMessaging || !session.canSend || !draft.trim() || isSending}
                  className="soft-button"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Conversation Summary">
          {activeSummary ? (
            <div className="space-y-4 text-sm" style={{ color: "var(--text-main)" }}>
              <div className="rounded-[22px] border p-3" style={{ background: "rgba(255, 243, 238, 0.86)" }}>
                <p className="font-semibold">
                  Compatibility {Math.round(displayedCompatibilityScore * 100)}% - {displayedCompatibilityLabel}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-soft)" }}>
                  {activeSummary.compatibility.rationale}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-soft)" }}>
                  Key Points
                </p>
                <ul className="mt-2 space-y-2">
                  {activeSummary.keyPoints.map((point) => (
                    <li key={point} className="rounded-2xl border px-3 py-2" style={{ background: "rgba(255, 248, 245, 0.9)" }}>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border p-3" style={{ background: "rgba(255, 248, 245, 0.9)" }}>
                  <p className="font-semibold">Jordan</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-soft)" }}>
                    Positives
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {activeSummary.jordan.positives.map((item) => (
                      <li key={item}>+ {item}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-soft)" }}>
                    Potential Concerns
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {activeSummary.jordan.concerns.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[22px] border p-3" style={{ background: "rgba(255, 248, 245, 0.9)" }}>
                  <p className="font-semibold">{activeSummary.counterpart.name}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-soft)" }}>
                    Positives
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {activeSummary.counterpart.positives.map((item) => (
                      <li key={item}>+ {item}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-soft)" }}>
                    Potential Concerns
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {activeSummary.counterpart.concerns.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              Summary will appear once the agents have enough signal from the conversation and profile match.
            </p>
          )}
        </Card>

        <Card
          title="Policy Rail"
          right={
            <button type="button" className="text-xs font-semibold" style={{ color: "var(--accent-deep)" }} onClick={() => setShowTimeline((v) => !v)}>
              {showTimeline ? "Hide timeline" : "Show timeline"}
            </button>
          }
        >
          <div className="flex flex-wrap gap-2">
            <StatusChip label={`Socket: ${session.socketState}`} status={session.socketState === "connected" ? "ok" : "warn"} />
            <StatusChip label={`Cap: ${session.usedMessages}/${SESSION_LIMITS.maxMessages}`} status="ok" />
            <StatusChip
              label={`Retry: ${session.turnRetryUsed}/${SESSION_LIMITS.maxPrivacyRetries}`}
              status={session.turnRetryUsed > 1 ? "warn" : "ok"}
            />
            <StatusChip
              label={`Connection: ${signalAllowsMessaging ? signalStateLabel : session.connectionStatus}`}
              status={signalAllowsMessaging ? "ok" : "blocked"}
            />
          </div>

          <p className="mt-3 text-sm" style={{ color: "var(--text-soft)" }}>
            {mapReasonCode(latestEvent?.reason_code)}
          </p>

          {showTimeline && (
            <ul className="mt-3 space-y-2">
              {session.events.map((event) => (
                <li
                  key={event.event_id}
                  className="rounded-2xl border p-3 text-xs"
                  style={{ background: "rgba(255, 248, 245, 0.85)", color: "var(--text-main)" }}
                >
                  <p>
                    <strong>{event.stage}</strong> - {event.status}
                  </p>
                  <p style={{ color: "var(--text-soft)" }}>{mapReasonCode(event.reason_code)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
