export function createMessagesSocket(threadId, onEvent) {
  let source = null;

  return {
    connect() {
      if (!threadId) {
        return;
      }

      source = new EventSource(`/api/threads/${threadId}/events`);
      source.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data);
          if (payload?.event_id) {
            onEvent(payload);
          }
        } catch {
          // Ignore malformed events and keep the stream alive.
        }
      };
    },
    disconnect() {
      if (source) {
        source.close();
      }
      source = null;
    }
  };
}
