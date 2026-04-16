// Cloudflare Pages Function: POST /api/chat
// 调试版：无密码校验；详细错误输出；写日志到 D1（若绑定了）

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- 访客信息（Cloudflare 边缘节点自动填的 header） ---
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || 'XX';
  const userAgent = request.headers.get('User-Agent') || '';

  // --- 1. 解析请求体 ---
  let body;
  try {
    body = await request.json();
  } catch {
    await logChat(env, { ip, country, userAgent, stage: 'parse', error: 'Invalid JSON' });
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { messages, model: requestedProvider } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    await logChat(env, { ip, country, userAgent, stage: 'parse', error: 'messages must be non-empty array' });
    return json({ error: 'messages must be a non-empty array' }, 400);
  }

  const historyLen = messages.length;

  // --- 2. 路由到对应模型 ---
  const provider = requestedProvider === 'claude' ? 'claude' : 'qwen';
  const maxTokens = parseInt(env.ANTHROPIC_MAX_TOKENS || '1024', 10);

  let apiUrl, model, upstreamHeaders, payload;

  if (provider === 'claude') {
    const baseUrl = (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
    apiUrl = `${baseUrl}/v1/messages`;
    model = env.ANTHROPIC_MODEL || 'claude-opus-4-6';
    upstreamHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    };
    if (env.ANTHROPIC_BETA) upstreamHeaders['anthropic-beta'] = env.ANTHROPIC_BETA;
    payload = {
      model,
      max_tokens: maxTokens,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };
  } else {
    // Qwen — OpenAI-compatible API
    const baseUrl = (env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
    apiUrl = `${baseUrl}/chat/completions`;
    model = env.QWEN_MODEL || 'qwen-plus';
    upstreamHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.QWEN_API_KEY ?? ''}`,
    };
    payload = {
      model,
      max_tokens: maxTokens,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };
  }

  // --- 3. 调上游 ---
  let apiResponse;
  const requestStart = Date.now();
  try {
    apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const elapsed = Date.now() - requestStart;
    await logChat(env, {
      ip, country, userAgent, model, elapsed_ms: elapsed, history_len: historyLen,
      stage: 'network', error: String(err),
    });
    return json({
      error: 'Upstream fetch threw', stage: 'network',
      apiUrl, elapsed_ms: elapsed, detail: String(err),
    }, 502);
  }

  const elapsed = Date.now() - requestStart;

  // --- 4. 上游回 non-2xx ---
  if (!apiResponse.ok) {
    let upstreamText = '';
    try { upstreamText = await apiResponse.text(); } catch (e) { upstreamText = `<read fail: ${e}>`; }

    await logChat(env, {
      ip, country, userAgent, model, elapsed_ms: elapsed, history_len: historyLen,
      stage: 'upstream_status',
      error: `${apiResponse.status} ${apiResponse.statusText}: ${upstreamText.slice(0, 500)}`,
    });

    return json({
      error: 'Upstream returned non-2xx', stage: 'upstream_status',
      apiUrl,
      upstream_status: apiResponse.status,
      upstream_statusText: apiResponse.statusText,
      upstream_content_type: apiResponse.headers.get('content-type'),
      upstream_body_preview: upstreamText.slice(0, 2000),
      elapsed_ms: elapsed,
    }, apiResponse.status);
  }

  // --- 5. 成功 ---
  let data;
  try {
    data = await apiResponse.json();
  } catch (e) {
    await logChat(env, {
      ip, country, userAgent, model, elapsed_ms: elapsed, history_len: historyLen,
      stage: 'parse', error: `Non-JSON response: ${e}`,
    });
    return json({
      error: 'Upstream returned non-JSON', stage: 'parse',
      apiUrl, elapsed_ms: elapsed, detail: String(e),
    }, 502);
  }

  // Claude: data.content[0].text; Qwen (OpenAI-compat): data.choices[0].message.content
  const replyText = data.content?.[0]?.text ?? data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage || {};
  // Qwen uses prompt_tokens/completion_tokens; Claude uses input_tokens/output_tokens
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;

  await logChat(env, {
    ip, country, userAgent,
    model: data.model || model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    elapsed_ms: elapsed,
    history_len: historyLen,
    stage: 'success',
    error: null,
  });

  return json({
    reply: replyText,
    _debug: { elapsed_ms: elapsed, model: data.model, requested_model: model },
  });
}

// --- D1 写日志 ---
// 如果没绑 DB 就安静跳过，不影响主流程
async function logChat(env, fields) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT INTO chat_logs
         (ts, ip, country, user_agent, model, input_tokens, output_tokens,
          elapsed_ms, history_len, stage, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      Date.now(),
      fields.ip || 'unknown',
      fields.country || 'XX',
      (fields.userAgent || '').slice(0, 500),
      fields.model || null,
      fields.input_tokens || 0,
      fields.output_tokens || 0,
      fields.elapsed_ms || 0,
      fields.history_len || 0,
      fields.stage || 'success',
      fields.error ? String(fields.error).slice(0, 1000) : null,
    ).run();
  } catch (e) {
    // 日志失败不能让主流程失败
    console.error('D1 log failed:', e);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
