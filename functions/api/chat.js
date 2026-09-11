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

  const { messages, model: requestedProvider } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    await logChat(env, { ip, country, userAgent, stage: 'parse', error: 'messages must be non-empty array' });
    return json({ error: 'messages must be a non-empty array' }, 400);
  }

  const historyLen = messages.length;

  // 网页入口只允许这三个服务商；GPT 复用外部代理的上游凭据。
  const provider = requestedProvider || 'qwen';
  if (!['gpt', 'deepseek', 'qwen'].includes(provider)) {
    return json({ error: 'Unsupported model selection' }, 400);
  }
  const config = provider === 'gpt'
    ? { base: env.UPSTREAM_BASE_URL || 'https://api.openai.com/v1', key: env.UPSTREAM_API_KEY, model: 'gpt-5.6-sol' }
    : provider === 'deepseek'
      ? { base: 'https://api.deepseek.com', key: env.DEEPSEEK_API_KEY, model: 'deepseek-chat' }
      : { base: env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1', key: env.QWEN_API_KEY, model: env.QWEN_MODEL || 'qwen-plus' };
  const model = config.model;
  if (!config.key) {
    await logChat(env, { ip, country, userAgent, model, stage: 'config', error: 'Provider API key not configured' });
    return json({ error: '所选模型尚未配置密钥', stage: 'config' }, 503);
  }
  let converted;
  try {
    converted = messages.map(m => convertMessage(m, provider));
  } catch (err) {
    return json({ error: err.message, stage: 'parse' }, 400);
  }
  const apiUrl = `${config.base.replace(/\/+$/, '')}/${provider === 'gpt' ? 'responses' : 'chat/completions'}`;
  const upstreamHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` };
  const payload = provider === 'gpt'
    ? { model, input: converted, stream: false, store: false, max_output_tokens: 4096 }
    : { model, messages: converted, stream: false, max_tokens: 1024 };

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

  const replyText = provider === 'gpt'
    ? (data.output || []).filter(item => item.type === 'message')
      .flatMap(item => item.content || []).filter(block => block.type === 'output_text')
      .map(block => block.text).join('\n')
    : data.choices?.[0]?.message?.content || '';
  if (!replyText) {
    await logChat(env, { ip, country, userAgent, model: data.model || model,
      input_tokens: data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0,
      elapsed_ms: elapsed, history_len: historyLen, stage: 'parse', error: 'Upstream returned no text' });
    return json({ error: '模型未返回文字，请重试', stage: 'parse' }, 502);
  }
  const usage = data.usage || {};
  // Chat Completions 与 Responses 的用量字段统一写入现有 chat_logs。
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

// 前端保留现有附件结构，在服务端转换为各 API 接受的格式。
function convertMessage(message, provider) {
  if (!message || !['user', 'assistant'].includes(message.role)) throw new Error('Invalid message role');
  const { role, content } = message;
  if (typeof content === 'string') return { role, content };
  if (!Array.isArray(content) || !content.length) throw new Error('Invalid message content');
  if (provider !== 'gpt') {
    if (content.some(block => block?.type !== 'text' || typeof block.text !== 'string')) {
      throw new Error('当前 Qwen / DeepSeek 模型仅支持文字和文本文件；图片或 PDF 请切换到 GPT，或新建纯文本对话。');
    }
    return { role, content: content.map(block => block.text).join('\n\n') };
  }
  return { role, content: content.map(block => {
    if (block?.type === 'text' && typeof block.text === 'string') {
      return { type: role === 'assistant' ? 'output_text' : 'input_text', text: block.text };
    }
    if (role !== 'user' || block?.source?.type !== 'base64' || !block.source.data) throw new Error('Invalid attachment');
    const data = `data:${block.source.media_type};base64,${block.source.data}`;
    if (block.type === 'image') return { type: 'input_image', image_url: data };
    if (block.type === 'document') return { type: 'input_file', filename: 'attachment.pdf', file_data: data };
    throw new Error('Unsupported attachment');
  }) };
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
