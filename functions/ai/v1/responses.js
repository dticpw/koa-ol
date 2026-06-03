// Cloudflare Pages Function: POST /ai/v1/responses
// OpenAI-compatible Responses API proxy for Codex.

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestStart = Date.now();
  const clientInfo = getClientInfo(request);

  const authError = authorizeClient(request, env);
  if (authError) return authError;

  if (!env.UPSTREAM_API_KEY) {
    scheduleLog(context, logProxyUsage(env, {
      ...clientInfo,
      model: env.DEFAULT_MODEL || null,
      elapsed_ms: Date.now() - requestStart,
      stage: "config",
      error: "UPSTREAM_API_KEY is not configured",
    }));
    return jsonError("UPSTREAM_API_KEY is not configured", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    scheduleLog(context, logProxyUsage(env, {
      ...clientInfo,
      model: env.DEFAULT_MODEL || null,
      elapsed_ms: Date.now() - requestStart,
      stage: "parse",
      error: "Invalid JSON",
    }));
    return jsonError("Invalid JSON", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    scheduleLog(context, logProxyUsage(env, {
      ...clientInfo,
      model: env.DEFAULT_MODEL || null,
      elapsed_ms: Date.now() - requestStart,
      stage: "parse",
      error: "Request body must be a JSON object",
    }));
    return jsonError("Request body must be a JSON object", 400);
  }

  if (!body.model && env.DEFAULT_MODEL) {
    body.model = env.DEFAULT_MODEL;
  }

  const upstreamBase = normalizeBaseUrl(env.UPSTREAM_BASE_URL || "https://api.openai.com/v1");
  const upstreamUrl = `${upstreamBase}/responses`;

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildUpstreamHeaders(request, env),
      body: JSON.stringify(body),
    });
  } catch (err) {
    scheduleLog(context, logProxyUsage(env, {
      ...clientInfo,
      model: body.model || env.DEFAULT_MODEL || null,
      elapsed_ms: Date.now() - requestStart,
      history_len: estimateHistoryLen(body),
      stage: "network",
      error: String(err),
    }));
    return jsonError("Upstream fetch failed", 502, { detail: String(err) });
  }

  scheduleLog(context, logUpstreamResult(env, {
    ...clientInfo,
    requested_model: body.model || env.DEFAULT_MODEL || null,
    elapsed_ms: Date.now() - requestStart,
    history_len: estimateHistoryLen(body),
  }, upstreamResponse.clone()));

  return proxyResponse(upstreamResponse);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function authorizeClient(request, env) {
  const configuredKeys = parseClientKeys(env.CLIENT_API_KEYS);
  if (configuredKeys.length === 0) {
    return jsonError("CLIENT_API_KEYS is not configured", 500);
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();

  if (!token || !configuredKeys.includes(token)) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}

function parseClientKeys(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildUpstreamHeaders(request, env) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${env.UPSTREAM_API_KEY}`);

  const accept = request.headers.get("Accept");
  if (accept) headers.set("Accept", accept);

  const openaiBeta = request.headers.get("OpenAI-Beta");
  if (openaiBeta) headers.set("OpenAI-Beta", openaiBeta);

  return headers;
}

function proxyResponse(upstreamResponse) {
  const headers = new Headers(corsHeaders());
  const contentType = upstreamResponse.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");

  const requestId = upstreamResponse.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

async function logUpstreamResult(env, meta, upstreamResponse) {
  const contentType = upstreamResponse.headers.get("Content-Type") || "";
  const baseFields = {
    ...meta,
    model: meta.requested_model,
    stage: upstreamResponse.ok ? "success" : "upstream_status",
    error: null,
  };

  try {
    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text();
      await logProxyUsage(env, {
        ...baseFields,
        error: `${upstreamResponse.status} ${upstreamResponse.statusText}: ${text.slice(0, 500)}`,
      });
      return;
    }

    if (contentType.includes("text/event-stream")) {
      const text = await upstreamResponse.text();
      const parsed = parseResponsesSse(text);
      await logProxyUsage(env, {
        ...baseFields,
        model: parsed.model || baseFields.model,
        input_tokens: parsed.input_tokens,
        output_tokens: parsed.output_tokens,
      });
      return;
    }

    const data = await upstreamResponse.json();
    const usage = parseUsage(data);
    await logProxyUsage(env, {
      ...baseFields,
      model: data.model || baseFields.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    });
  } catch (err) {
    await logProxyUsage(env, {
      ...baseFields,
      stage: "log_parse",
      error: String(err),
    });
  }
}

function parseResponsesSse(text) {
  let model = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let event;
    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }

    const candidates = [event.response, event].filter(Boolean);
    for (const candidate of candidates) {
      if (candidate.model) model = candidate.model;
      const usage = parseUsage(candidate);
      if (usage.input_tokens || usage.output_tokens) {
        inputTokens = usage.input_tokens;
        outputTokens = usage.output_tokens;
      }
    }
  }

  return {
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

function parseUsage(data) {
  const usage = data?.usage || {};
  return {
    input_tokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    output_tokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
  };
}

async function logProxyUsage(env, fields) {
  if (!env.DB) return;

  try {
    await env.DB.prepare(
      `INSERT INTO chat_logs
         (ts, ip, country, user_agent, model, input_tokens, output_tokens,
          elapsed_ms, history_len, stage, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      Date.now(),
      fields.ip || "unknown",
      fields.country || "XX",
      String(fields.userAgent || "").slice(0, 500),
      fields.model || null,
      fields.input_tokens || 0,
      fields.output_tokens || 0,
      fields.elapsed_ms || 0,
      fields.history_len || 0,
      fields.stage || "success",
      fields.error ? String(fields.error).slice(0, 1000) : null,
    ).run();
  } catch (err) {
    console.error("D1 proxy usage log failed:", err);
  }
}

function scheduleLog(context, promise) {
  const guarded = promise.catch((err) => {
    console.error("Proxy usage log failed:", err);
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(guarded);
  }
}

function getClientInfo(request) {
  return {
    ip: request.headers.get("CF-Connecting-IP") || "unknown",
    country: request.headers.get("CF-IPCountry") || "XX",
    userAgent: request.headers.get("User-Agent") || "",
  };
}

function estimateHistoryLen(body) {
  if (Array.isArray(body.input)) return body.input.length;
  if (typeof body.input === "string") return 1;
  if (Array.isArray(body.messages)) return body.messages.length;
  return 0;
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function jsonError(message, status, extra = {}) {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: "proxy_error",
        ...extra,
      },
    }),
    {
      status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, OpenAI-Beta",
  };
}
