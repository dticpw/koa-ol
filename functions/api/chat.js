// Cloudflare Pages Function: POST /api/chat
// 功能：
//   1. 校验请求中的访问密码（和环境变量 CHAT_PASSWORD 对比）
//   2. 代理到 Anthropic Claude API（API Key 从环境变量 ANTHROPIC_API_KEY 读取）
//   3. 返回 Claude 的回复给前端

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- 1. 解析并校验请求体 ---
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { password, messages } = body;

  if (password !== env.CHAT_PASSWORD) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages must be a non-empty array' }, 400);
  }

  // --- 2. 调用 Claude API ---
  const claudePayload = {
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };

  // 支持自定义 BASE_URL（用于代理 / 镜像 / 第三方中转服务）
  // 约定：BASE_URL 只填主机名（末尾不加 /v1），代码会自动拼 /v1/messages
  const baseUrl = (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/v1/messages`;

  let apiResponse;
  try {
    apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudePayload),
    });
  } catch (err) {
    return json({ error: `Network error (${apiUrl}): ${String(err)}` }, 502);
  }

  if (!apiResponse.ok) {
    const errText = await apiResponse.text();
    return json({ error: `Claude API ${apiResponse.status}: ${errText}` }, apiResponse.status);
  }

  const data = await apiResponse.json();
  const replyText = data.content?.[0]?.text ?? '';

  return json({ reply: replyText });
}

// 允许浏览器预检（OPTIONS），虽然同源部署不需要，但留着保险
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
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
