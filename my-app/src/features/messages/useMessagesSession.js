import { useEffect, useMemo, useState } from "react";
import { createMessagesSocket } from "../../services/wsClient";
import { normalizeEvent } from "../../utils/normalizers";
import { CONNECTION_STATES, SESSION_LIMITS } from "../../utils/constants";

export function useMessagesSession(activePage) {
  const [events, setEvents] = useState([]);
  const [usedMessages, setUsedMessages] = useState(12);
  const [turnRetryUsed, setTurnRetryUsed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATES.CONNECTED);
  const [socketState, setSocketState] = useState("disconnected");

  useEffect(() => {
    if (activePage !== "messages") return undefined;
    const socket = createMessagesSocket((event) => {
      setEvents((prev) => [normalizeEvent(event, prev.length), ...prev].slice(0, 20));
    });
    socket.connect();
    setSocketState("connected");
    return () => {
      socket.disconnect();
      setSocketState("disconnected");
    };
  }, [activePage]);

  const canSend = useMemo(() => {
    return (
      connectionStatus === CONNECTION_STATES.CONNECTED &&
      usedMessages < SESSION_LIMITS.maxMessages &&
      turnRetryUsed < SESSION_LIMITS.maxPrivacyRetries
    );
  }, [connectionStatus, usedMessages, turnRetryUsed]);

  function pushEvent(event) {
    setEvents((prev) => [normalizeEvent(event, prev.length), ...prev].slice(0, 20));
  }

  function registerApprovedMessage() {
    setUsedMessages((v) => Math.min(v + 1, SESSION_LIMITS.maxMessages));
  }

  function registerRejectedDraft(reasonCode = "retry_exhausted_drop") {
    setTurnRetryUsed((v) => Math.min(v + 1, SESSION_LIMITS.maxPrivacyRetries));
    pushEvent({
      stage: "rewrite",
      status: "warn",
      reason_code: reasonCode,
      turn_index: usedMessages,
      timestamp: new Date().toISOString()
    });
  }

  function resetRetry() {
    setTurnRetryUsed(0);
  }

  return {
    events,
    usedMessages,
    turnRetryUsed,
    connectionStatus,
    setConnectionStatus,
    socketState,
    canSend,
    registerApprovedMessage,
    registerRejectedDraft,
    resetRetry,
    pushEvent
  };
}
