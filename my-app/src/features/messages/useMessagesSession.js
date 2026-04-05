import { useEffect, useMemo, useRef, useState } from "react";
import { createMessagesSocket } from "../../services/wsClient";
import { normalizeEvent } from "../../utils/normalizers";
import { CONNECTION_STATES, SESSION_LIMITS } from "../../utils/constants";

const EVENT_WINDOW = 100;

function mergeEventsById(previousEvents, nextEvents) {
  if (!nextEvents?.length) {
    return previousEvents;
  }

  const previousIds = new Set((previousEvents || []).map((event) => event.event_id));
  const hasUnseenEvent = nextEvents.some((event) => !previousIds.has(event.event_id));
  if (!hasUnseenEvent) {
    return previousEvents;
  }

  const merged = [];
  const seen = new Set();

  [...(nextEvents || []), ...(previousEvents || [])].forEach((event) => {
    if (seen.has(event.event_id)) return;
    seen.add(event.event_id);
    merged.push(event);
  });

  return merged.slice(0, EVENT_WINDOW);
}

export function useMessagesSession(activePage, activeThreadId, sessionSnapshot, initialEvents = []) {
  const [events, setEvents] = useState([]);
  const [usedMessages, setUsedMessages] = useState(0);
  const [turnRetryUsed, setTurnRetryUsed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATES.CONNECTED);
  const [socketState, setSocketState] = useState("disconnected");
  const lastThreadIdRef = useRef("");

  useEffect(() => {
    setUsedMessages(sessionSnapshot?.usedMessages || 0);
    setTurnRetryUsed(sessionSnapshot?.turnRetryUsed || 0);
    setConnectionStatus(sessionSnapshot?.connectionStatus || CONNECTION_STATES.CONNECTED);
  }, [sessionSnapshot]);

  useEffect(() => {
    const normalized = (initialEvents || []).map((event, index) => normalizeEvent(event, index)).slice(0, EVENT_WINDOW);
    const threadChanged = lastThreadIdRef.current !== activeThreadId;
    lastThreadIdRef.current = activeThreadId || "";

    setEvents((prev) => {
      if (threadChanged) return normalized;
      if (!normalized.length) return prev;
      return mergeEventsById(prev, normalized);
    });
  }, [activeThreadId, initialEvents]);

  useEffect(() => {
    if (activePage !== "messages" || !activeThreadId) return undefined;
    const socket = createMessagesSocket(activeThreadId, (event) => {
      setEvents((prev) => mergeEventsById(prev, [normalizeEvent(event, prev.length)]));
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
    setEvents((prev) => mergeEventsById(prev, [normalizeEvent(event, prev.length)]));
  }

  function applyServerState(nextSession, nextEvents = []) {
    if (nextSession) {
      setUsedMessages(nextSession.usedMessages || 0);
      setTurnRetryUsed(nextSession.turnRetryUsed || 0);
      setConnectionStatus(nextSession.connectionStatus || CONNECTION_STATES.CONNECTED);
    }

    if (nextEvents.length) {
      const normalized = nextEvents.map((event, index) => normalizeEvent(event, index)).slice(0, EVENT_WINDOW);
      setEvents((prev) => mergeEventsById(prev, normalized));
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
