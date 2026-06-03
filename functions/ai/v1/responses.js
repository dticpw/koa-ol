// Cloudflare Pages Function: POST /ai/v1/responses
// OpenAI-compatible Responses API proxy for Codex.

export async function onRequestPost(context) {
  const { request, env } = context;

  const authError = authorizeClient(request, env);
  if (authError) return authError;

  if (!env.UPSTREAM_API_KEY) {
    return jsonError("UPSTREAM_API_KEY is not configured", 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
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
    return jsonError("Upstream fetch failed", 502, { detail: String(err) });
  }

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
