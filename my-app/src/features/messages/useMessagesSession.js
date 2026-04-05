import { useEffect, useMemo, useState } from "react";
import { createMessagesSocket } from "../../services/wsClient";
import { normalizeEvent } from "../../utils/normalizers";
import { CONNECTION_STATES, SESSION_LIMITS } from "../../utils/constants";

export function useMessagesSession(activePage, activeThreadId, sessionSnapshot, initialEvents = []) {
  const [events, setEvents] = useState([]);
  const [usedMessages, setUsedMessages] = useState(0);
  const [turnRetryUsed, setTurnRetryUsed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATES.CONNECTED);
  const [socketState, setSocketState] = useState("disconnected");

  useEffect(() => {
    setEvents((initialEvents || []).map((event, index) => normalizeEvent(event, index)).slice(0, 20));
    setUsedMessages(sessionSnapshot?.usedMessages || 0);
    setTurnRetryUsed(sessionSnapshot?.turnRetryUsed || 0);
    setConnectionStatus(sessionSnapshot?.connectionStatus || CONNECTION_STATES.CONNECTED);
  }, [activeThreadId, initialEvents, sessionSnapshot]);

  useEffect(() => {
    if (activePage !== "messages" || !activeThreadId) return undefined;
    const socket = createMessagesSocket(activeThreadId, (event) => {
      setEvents((prev) => [normalizeEvent(event, prev.length), ...prev].slice(0, 20));
    });
    socket.connect();
    setSocketState("connected");
    return () => {
      socket.disconnect();
      setSocketState("disconnected");
    };
  }, [activePage, activeThreadId]);

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

  function applyServerState(nextSession, nextEvents = []) {
    if (nextSession) {
      setUsedMessages(nextSession.usedMessages || 0);
      setTurnRetryUsed(nextSession.turnRetryUsed || 0);
      setConnectionStatus(nextSession.connectionStatus || CONNECTION_STATES.CONNECTED);
    }

    if (nextEvents.length) {
      setEvents(nextEvents.map((event, index) => normalizeEvent(event, index)).slice(0, 20));
    }
  }

  return {
    events,
    usedMessages,
    turnRetryUsed,
    connectionStatus,
    setConnectionStatus,
    socketState,
    canSend,
    pushEvent,
    applyServerState
  };
}
