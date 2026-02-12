/**
 * Cloudflare Worker - Claude API 反向代理
 * 处理来自前端的请求并转发到 Anthropic API
 */

export default {
  async fetch(request, env) {
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);

    // 只处理 /api/ 路径
    if (!url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // 处理聊天请求
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChatRequest(request, env);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  }
};

/**
 * 处理 CORS
 */
function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

/**
 * 处理聊天请求
 */
async function handleChatRequest(request, env) {
  try {
    const { messages, model = 'claude-sonnet-4-5-20250929', max_tokens = 4096 } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: '无效的消息格式' }, 400);
    }

    // 检查 API 密钥
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'API 密钥未配置' }, 500);
    }

    // 转发请求到 Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse({ error: data.error?.message || '请求失败' }, response.status);
    }

    return jsonResponse(data);

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ error: '服务器错误: ' + error.message }, 500);
  }
}

/**
 * 返回 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
