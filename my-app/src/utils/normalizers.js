export function normalizeEvent(event, index) {
  return {
    event_id: event.event_id || `event-${index}`,
    stage: event.stage || "texting_draft",
    status: event.status || "ok",
    reason_code: event.reason_code || "",
    timestamp: event.timestamp || new Date().toISOString(),
    turn_index: Number.isInteger(event.turn_index) ? event.turn_index : 0
  };
}
