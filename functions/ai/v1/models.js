// Cloudflare Pages Function: GET /ai/v1/models
// Minimal OpenAI-compatible models endpoint for connectivity checks.

export async function onRequestGet(context) {
  const { request, env } = context;

  const authError = authorizeClient(request, env);
  if (authError) return authError;

  const models = parseModels(env.AVAILABLE_MODELS || env.DEFAULT_MODEL || "gpt-5.5");

  return new Response(
    JSON.stringify({
      object: "list",
      data: models.map((id) => ({
        id,
        object: "model",
        created: 0,
        owned_by: "koa-ol",
      })),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function authorizeClient(request, env) {
  const configuredKeys = parseModels(env.CLIENT_API_KEYS);
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

function parseModels(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jsonError(message, status) {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: "proxy_error",
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  };
}
