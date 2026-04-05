export const reasonCodeMap = {
  "policy_config_missing_or_invalid": "Privacy settings need attention.",
  "retry_exhausted_drop": "Message dropped after max retries.",
  "session_limit_reached": "Message cap reached.",
  "message_cap_reached": "Message cap reached.",
  "timeout_stage_privacy": "System timeout during privacy check.",
  "timeout_stage_texting": "System timeout while drafting.",
  "blocked_topic:health": "Blocked topic detected.",
  "sensitive_topic_requires_generalization:identity": "Sensitive topic must be generalized."
};

export function mapReasonCode(code) {
  if (!code) return "No policy issues detected.";
  if (reasonCodeMap[code]) return reasonCodeMap[code];
  if (code.startsWith("blocked_topic:")) return "Blocked topic detected.";
  if (code.startsWith("sensitive_topic_requires_generalization:")) {
    return "Sensitive topic must be generalized.";
  }
  if (code.startsWith("timeout_stage_")) return "System timeout, please retry.";
  return "Policy event recorded.";
}
