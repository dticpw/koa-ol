// Cloudflare Pages Function: GET /ai/v1/models
// Minimal OpenAI-compatible models endpoint for connectivity checks.
import { authorizeClient } from '../../_lib/codex-access.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const access = await authorizeClient(request, env);
  if (access.error) return jsonError(access.error, access.status);

  const models = access.models;

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
