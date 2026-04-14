// Cloudflare Pages Function: POST /api/chat
// 调试版：暂时无密码校验；错误信息尽量详细便于定位 503

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- 1. 解析请求体 ---
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages must be a non-empty array' }, 400);
  }

  // --- 2. 拼接上游 URL ---
  const baseUrl = (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/v1/messages`;

  const claudePayload = {
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  // --- 3. 调上游 ---
  let apiResponse;
  const requestStart = Date.now();
  try {
    apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudePayload),
    });
  } catch (err) {
    // 网络层错误：DNS 失败、TLS 失败、connection refused 等
    return json({
      error: 'Upstream fetch threw',
      stage: 'network',
      apiUrl,
      elapsed_ms: Date.now() - requestStart,
      detail: String(err),
    }, 502);
  }

  const elapsed = Date.now() - requestStart;

  // --- 4. 上游回 non-2xx 时，把 body 完整透给我们 ---
  if (!apiResponse.ok) {
    let upstreamText = '';
    try {
      upstreamText = await apiResponse.text();
    } catch (e) {
      upstreamText = `<无法读取 body: ${e}>`;
    }
    return json({
      error: 'Upstream returned non-2xx',
      stage: 'upstream_status',
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
    return json({
      error: 'Upstream returned non-JSON',
      stage: 'parse',
      apiUrl,
      elapsed_ms: elapsed,
      detail: String(e),
    }, 502);
  }

  const replyText = data.content?.[0]?.text ?? '';
  return json({ reply: replyText, _debug: { elapsed_ms: elapsed, model: data.model } });
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
