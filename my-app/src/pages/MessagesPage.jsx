import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import StatusChip from "../components/StatusChip";
import { mapReasonCode } from "../utils/reasonCodeMap";
import { SESSION_LIMITS, CONNECTION_STATES } from "../utils/constants";
import { sendThreadMessage } from "../services/api";

export default function MessagesPage({
  threads,
  messages,
  session,
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

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const threadMessages = messages[activeThread?.id] || [];
  const activeSummary = threadSummaries[activeThread?.id];
  const latestEvent = session.events[0];

  const disabledReason = useMemo(() => {
    if (session.connectionStatus !== CONNECTION_STATES.CONNECTED) return "Connection required";
    if (session.usedMessages >= SESSION_LIMITS.maxMessages) return "Message cap reached";
    if (session.turnRetryUsed >= SESSION_LIMITS.maxPrivacyRetries) return "Retry limit reached";
    return "";
  }, [session.connectionStatus, session.usedMessages, session.turnRetryUsed]);

  async function simulateSend() {
    if (!session.canSend || !draft.trim()) return;
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
      <Card title="Threads">
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

      <div className="space-y-4">
        <Card title={activeThread?.name || "Messages"}>
          <div className="space-y-2">
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
                      ? { background: "linear-gradient(135deg, var(--accent-main) 0%, var(--accent-deep) 100%)" }
                      : message.sender === "system"
                        ? {}
                        : { background: "rgba(255, 239, 233, 0.92)", color: "var(--text-main)" }
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

          <div className="mt-4 border-t pt-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!session.canSend}
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
                disabled={!session.canSend || !draft.trim() || isSending}
                className="soft-button"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </Card>

        <Card title="Conversation Summary">
          {activeSummary ? (
            <div className="space-y-4 text-sm" style={{ color: "var(--text-main)" }}>
              <div className="rounded-[22px] border p-3" style={{ background: "rgba(255, 243, 238, 0.86)" }}>
                <p className="font-semibold">
                  Compatibility {Math.round((activeSummary.compatibility.score || 0) * 100)}% - {activeSummary.compatibility.label}
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
              label={`Connection: ${session.connectionStatus}`}
              status={session.connectionStatus === CONNECTION_STATES.CONNECTED ? "ok" : "blocked"}
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
