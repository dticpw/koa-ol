// Cloudflare Pages Function: POST /api/multi-agent
// SSE 流式输出：Orchestrator 多轮调度 + Qwen Workers 并行执行

const MAX_TOKENS = 1024;
const MAX_ITERATIONS = 8;

const WORKERS = {
  reasoning_agent: {
    description: '逻辑推理、数学计算、规律分析',
    system: '你是逻辑推理专家。只输出最终答案，不超过一句话，不解释过程，不列步骤。',
  },
  knowledge_agent: {
    description: '知识问答、文学、历史、科学、诗词',
    system: '你是知识专家。只输出最终答案，不超过一句话，不列表格，不解释，不验证。',
  },
};

function buildOrchSystem() {
  const agentList = Object.entries(WORKERS)
    .map(([name, w]) => `- ${name}: ${w.description}`)
    .join('\n');
  return `你是任务调度助手。可用 Agent：
${agentList}

每轮输出一个 JSON：

调度时：
{"actions": [{"agent": "<agent名>", "task": "<子任务描述>"}]}

完成时：
{"finish": "最终答案"}

规则：
- 只输出 JSON，不要其他文字
- 同一轮中每个 agent 最多出现一次
- 若子任务 B 依赖子任务 A 的结果，必须分两轮派发，不可同轮并行
- 若多个 worker 返回同一问题的一致答案，直接采用，不再派发确认任务
- 相互独立的子任务可同一轮列多个 agent 并行执行
- 子任务描述要具体，包含所有必要上下文
- 收到所有结果后整合并 finish`;
}

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; }
}

async function qwenChat(env, messages, system) {
  const baseUrl = (env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  const model = env.QWEN_MODEL || 'qwen-plus';
  const allMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.QWEN_API_KEY}` },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages: allMessages }),
  });
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function runWorker(env, name, task) {
  const w = WORKERS[name];
  if (!w) return `未知 agent: ${name}`;
  return await qwenChat(env, [{ role: 'user', content: task }], w.system);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON', 400); }

  const { task } = body;
  if (!task?.trim()) return err('task is required', 400);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const send = (obj) => writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

  (async () => {
    const start = Date.now();
    const messages = [{ role: 'user', content: task }];

    await send({ type: 'start', task });

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      await send({ type: 'orchestrator', round: i + 1, status: 'thinking' });

      const reply = await qwenChat(env, messages, buildOrchSystem());
      const cmd = parseJson(reply);
      messages.push({ role: 'assistant', content: reply });

      if ('finish' in cmd) {
        await send({ type: 'finish', result: cmd.finish, elapsed: ((Date.now() - start) / 1000).toFixed(2) });
        break;
      }

      const actions = cmd.actions || [];
      if (!actions.length) {
        await send({ type: 'error', message: '无法解析 Orchestrator 指令' });
        break;
      }

      await send({ type: 'orchestrator', round: i + 1, status: 'dispatched', actions });

      // 同名 agent 自动编号
      const nameCount = {};
      for (const a of actions) nameCount[a.agent] = (nameCount[a.agent] || 0) + 1;
      const nameIdx = {};
      const labeled = actions.map(a => {
        let label;
        if (nameCount[a.agent] > 1) {
          nameIdx[a.agent] = (nameIdx[a.agent] || 0) + 1;
          label = `${a.agent}_${nameIdx[a.agent]}`;
        } else {
          label = a.agent;
        }
        return { ...a, label };
      });

      // 并行执行所有 worker
      const results = await Promise.all(
        labeled.map(async (a) => {
          const t0 = Date.now();
          await send({ type: 'agent', name: a.label, status: 'start', task: a.task, round: i + 1 });
          const result = await runWorker(env, a.agent, a.task);
          await send({ type: 'agent', name: a.label, status: 'done', result, elapsed: ((Date.now() - t0) / 1000).toFixed(2), round: i + 1 });
          return { label: a.label, task: a.task, result };
        })
      );

      const resultText = results.map(r => `[${r.label}] 任务：${r.task}\n结果：${r.result}`).join('\n');
      messages.push({ role: 'user', content: `Worker 结果：\n${resultText}` });
    }

    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
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

function err(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
