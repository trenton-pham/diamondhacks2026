const fs = require("fs");
const path = require("path");

const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_QWEN_MODEL = "qwen-plus-latest";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

let envLoaded = false;

function loadLocalEnv() {
  if (envLoaded) {
    return;
  }

  envLoaded = true;
  const rootDir = path.join(__dirname, "..", "..");
  const candidates = [path.join(rootDir, ".env.local"), path.join(rootDir, ".env")];

  candidates.forEach((filePath) => {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        return;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] == null) {
        process.env[key] = value;
      }
    });
  });
}

function getQwenConfig() {
  loadLocalEnv();
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || "";
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || "";
  const anthropicModel = process.env.ANTHROPIC_MODEL || "";

  if (anthropicBaseUrl || anthropicApiKey || anthropicModel) {
    return {
      provider: "anthropic_compatible",
      apiKey: anthropicApiKey,
      baseUrl: anthropicBaseUrl.replace(/\/$/, ""),
      model: anthropicModel,
      anthropicVersion: process.env.ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION
    };
  }

  return {
    provider: "openai_compatible",
    apiKey: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "",
    baseUrl: (process.env.QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL).replace(/\/$/, ""),
    model: process.env.QWEN_MODEL || DEFAULT_QWEN_MODEL
  };
}

function buildCandidateUrls(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/$/, "");
  const urls = [
    `${normalized}/chat/completions`,
    `${normalized}/v1/chat/completions`,
    `${normalized}/compatible-mode/v1/chat/completions`
  ];

  if (normalized.endsWith("/v1")) {
    urls.unshift(`${normalized}/chat/completions`);
  }

  if (normalized.endsWith("/compatible-mode/v1")) {
    urls.unshift(`${normalized}/chat/completions`);
  }

  return [...new Set(urls)];
}

function buildAnthropicCandidateUrls(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/$/, "");
  const urls = [`${normalized}/messages`, `${normalized}/v1/messages`];

  if (normalized.endsWith("/v1/messages")) {
    urls.unshift(normalized);
  } else if (normalized.endsWith("/v1")) {
    urls.unshift(`${normalized}/messages`);
  }

  return [...new Set(urls)];
}

function isQwenConfigured() {
  return Boolean(getQwenConfig().apiKey);
}

async function chatWithQwen({ messages, temperature = 0.8, maxTokens = 220, stopSequences = [] }) {
  const config = getQwenConfig();
  if (!config.apiKey) {
    throw new Error("qwen_not_configured");
  }

  if (!config.baseUrl) {
    throw new Error("qwen_base_url_missing");
  }

  if (config.provider === "anthropic_compatible") {
    return chatWithAnthropicCompatible({ config, messages, temperature, maxTokens, stopSequences });
  }

  return chatWithOpenAiCompatible({ config, messages, temperature, maxTokens, stopSequences });
}

async function chatWithOpenAiCompatible({ config, messages, temperature, maxTokens, stopSequences }) {
  const urls = buildCandidateUrls(config.baseUrl);
  let lastError = null;

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          temperature,
          max_tokens: maxTokens,
          messages,
          ...(stopSequences.length ? { stop: stopSequences } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const details = await response.text();
        lastError = new Error(`qwen_http_${response.status}:${details}`);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }

      if (Array.isArray(content)) {
        const text = content
          .map((part) => (typeof part?.text === "string" ? part.text : ""))
          .join("")
          .trim();
        if (text) {
          return text;
        }
      }

      lastError = new Error("qwen_empty_response");
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("qwen_request_failed");
}

function toAnthropicMessages(messages) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }));
}

async function chatWithAnthropicCompatible({ config, messages, temperature, maxTokens, stopSequences }) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => String(message.content || "").trim())
    .filter(Boolean)
    .join("\n\n");
  const anthropicMessages = toAnthropicMessages(messages);
  const urls = buildAnthropicCandidateUrls(config.baseUrl);

  let lastError = null;

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": config.anthropicVersion
        },
        body: JSON.stringify({
          model: config.model,
          temperature,
          max_tokens: maxTokens,
          system,
          messages: anthropicMessages,
          thinking: { type: "disabled" },
          ...(stopSequences.length ? { stop_sequences: stopSequences } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const details = await response.text();
        lastError = new Error(`qwen_http_${response.status}:${details}`);
        continue;
      }

      const data = await response.json();
      const content = data?.content;

      if (Array.isArray(content)) {
        const text = content
          .map((part) => {
            if (typeof part === "string") {
              return part;
            }
            if (typeof part?.text === "string") {
              return part.text;
            }
            return "";
          })
          .join("")
          .trim();
        if (text) {
          return text;
        }
      }

      lastError = new Error("qwen_empty_response");
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("qwen_request_failed");
}

module.exports = {
  getQwenConfig,
  isQwenConfigured,
  chatWithQwen
};
