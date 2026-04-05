export const NAV_ITEMS = [
  { id: "posts", label: "Posts" },
  { id: "messages", label: "Messages" },
  { id: "profile", label: "Profile" }
];

export const SESSION_LIMITS = {
  maxMessages: 10,
  maxPrivacyRetries: 3
};

export const SIGNAL_THRESHOLDS = {
  PROMISING: 0.66,
  HIGH: 0.82
};

export const CONNECTION_STATES = {
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  PAUSED: "paused"
};
