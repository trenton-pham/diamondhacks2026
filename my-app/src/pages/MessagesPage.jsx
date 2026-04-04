import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import StatusChip from "../components/StatusChip";
import { mapReasonCode } from "../utils/reasonCodeMap";
import { SESSION_LIMITS, CONNECTION_STATES } from "../utils/constants";

export default function MessagesPage({ threads, messages, session }) {
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id || "");
  const [draft, setDraft] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const threadMessages = messages[activeThread?.id] || [];
  const latestEvent = session.events[0];

  const disabledReason = useMemo(() => {
    if (session.connectionStatus !== CONNECTION_STATES.CONNECTED) return "Connection required";
    if (session.usedMessages >= SESSION_LIMITS.maxMessages) return "Message cap reached";
    if (session.turnRetryUsed >= SESSION_LIMITS.maxPrivacyRetries) return "Retry limit reached";
    return "";
  }, [session.connectionStatus, session.usedMessages, session.turnRetryUsed]);

  function simulateSend() {
    if (!session.canSend || !draft.trim()) return;
    const blocked = draft.toLowerCase().includes("health");

    session.pushEvent({
      stage: "texting_draft",
      status: "ok",
      reason_code: "",
      turn_index: session.usedMessages,
      timestamp: new Date().toISOString()
    });

    if (blocked) {
      session.registerRejectedDraft("blocked_topic:health");
      return;
    }

    session.pushEvent({
      stage: "send",
      status: "ok",
      reason_code: "",
      turn_index: session.usedMessages,
      timestamp: new Date().toISOString()
    });
    session.registerApprovedMessage();
    session.resetRetry();
    setDraft("");
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
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  activeThreadId === thread.id ? "bg-stone-100" : "hover:bg-stone-50"
                }`}
              >
                <p className="text-sm font-medium">{thread.name}</p>
                <p className="text-xs text-stone-500">{thread.lastPreview}</p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card title={activeThread?.name || "Messages"}>
          <div className="space-y-2">
            {threadMessages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  message.sender === "me"
                    ? "ml-auto bg-stone-900 text-white"
                    : message.sender === "system"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-stone-100 text-stone-800"
                }`}
              >
                <p>{message.text}</p>
                <p className="mt-1 text-[10px] opacity-70">{message.time}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t pt-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!session.canSend}
              className="min-h-20 w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-stone-100"
              placeholder={disabledReason || "Write a message..."}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-stone-500">AI-generated content is policy-filtered.</p>
              <button
                type="button"
                onClick={simulateSend}
                disabled={!session.canSend || !draft.trim()}
                className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:bg-stone-300"
              >
                Send
              </button>
            </div>
          </div>
        </Card>

        <Card
          title="Policy Rail"
          right={
            <button type="button" className="text-xs text-blue-700" onClick={() => setShowTimeline((v) => !v)}>
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

          <p className="mt-3 text-sm text-stone-600">{mapReasonCode(latestEvent?.reason_code)}</p>

          {showTimeline && (
            <ul className="mt-3 space-y-2">
              {session.events.map((event) => (
                <li key={event.event_id} className="rounded-lg border p-2 text-xs text-stone-700">
                  <p>
                    <strong>{event.stage}</strong> · {event.status}
                  </p>
                  <p className="text-stone-500">{mapReasonCode(event.reason_code)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
