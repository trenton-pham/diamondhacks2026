export function createMessagesSocket(onEvent) {
  let intervalId = null;

  return {
    connect() {
      intervalId = setInterval(() => {
        onEvent({
          event_id: `evt-${Date.now()}`,
          stage: "privacy_check_outbound",
          status: "ok",
          reason_code: "",
          timestamp: new Date().toISOString(),
          turn_index: Math.floor(Math.random() * 10)
        });
      }, 6000);
    },
    disconnect() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }
  };
}
