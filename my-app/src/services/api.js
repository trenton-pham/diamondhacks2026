const API_BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "request_failed");
  }

  return data;
}

export function fetchBootstrap() {
  return request("/bootstrap");
}

export function createPost(post) {
  return request("/posts", {
    method: "POST",
    body: JSON.stringify(post)
  });
}

export function saveProfile(profile) {
  return request("/profile", {
    method: "PUT",
    body: JSON.stringify(profile)
  });
}

export function uploadProfileContext(payload) {
  return request("/profile/context", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendThreadMessage(threadId, payload) {
  return request(`/threads/${threadId}/send`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
