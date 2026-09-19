# 用《门后的火光》理解 Context Engineering

对应无统一计时的规则 v3。目标：看懂开局、每轮裁定、复核和重裁的真实数据流，能区分“模型知道什么”“玩家知道什么”“程序允许改变什么”。本文依据本仓库代码；API 概念参考 OpenAI 官方 Conversation state 与 Structured outputs 文档。

## 1. 开局没有模型调用

POST /api/fiction-lab，body 为 {"op":"start"}。服务创建实体、地点、机关与预写开场，分配会话并存进 D1，再返回页面使用的 game。没有让 LLM 临场生成剧本。GET 恢复存档、相同 requestId 的已完成重试也不重新调用模型。

原始 PDF、我们在聊天里对项目的讨论、你的其他对话、网页截图，不会自动出现在游戏主持的上下文里。当前也没有向量检索/RAG、自动读文件、联网搜索或工具调用。

## 2. 每次行动，应用重新组装上下文

```text
玩家输入
  → 服务读取 D1 存档
  → 调用 A：裁定（结构化提案）
  → 程序在副本中检查并结算
  → 调用 B：复核与叙述
  → 通过：状态与幂等回执一起保存 → 页面显示正文
  → 不通过：带原因，从本轮原始存档最多重裁一次
```

两次正常调用使用同一个 gpt-5.6-sol，但职责与输入不同；不是两个常驻、共享记忆的模型。请求设置 store:false，没有 previous_response_id/conversation 串联，没有重放推理项。跨轮记忆由应用存档与本次明确发送的资料提供，不表示模型记住整段历史。store:false 也不能替代上游服务的数据保留政策。

## 3. 调用 A 收到什么

API 请求有两条消息，以及独立的输出格式约束：

```js
{
  model: "gpt-5.6-sol",
  store: false,
  stream: false,
  reasoning: { effort: "low" },
  max_output_tokens: 4200,
  input: [
    { role: "developer", content: HOST },
    { role: "user", content: JSON.stringify({ world, player_action }) }
  ],
  text: { format: proposalFormat }
}
```

| 部分 | 本项目实际内容 | 为什么发送 |
| --- | --- | --- |
| developer / HOST | 主持职责、常识裁定、连续动作与暂停规则、位置边界、无倒计时、输出字段含义、禁止擅改规则 | 确定裁定方式，不让玩家原话覆盖游戏规则 |
| world.places | 三处地点及空间关系 | 区分身处、能看见、能投到的位置 |
| world.entities | 全部已有实体的身份、普通物性、位置、完整性、最新事实、材料来源等 | 保存布已湿、物品已投出等跨轮后果 |
| world.knownEntities | 玩家上次看见的物品位置与事实 | 后台可以知道关门后的燃烧结果，正文不能全知泄露 |
| 当前状态 | 位置、状态值、门开闭、悬锤是否已落、rulesVersion/mode | 稳定关键设定；明确旧倒计时已经废止 |
| notes | 最近最多16条去重观察记录 | 保留有用发现，可能因窗口限制丢弃早期观察 |
| recent | 最近6条玩家/叙述日志，不是6整轮 | 保留指代、语气和局部对话关系 |
| recentEvents | 最近3次程序接受的结构化结算 | 提供可靠的近期因果证据 |
| pendingDecision | 上次目的、原行动、暂停原因、问题、尚未执行的动作 | 理解“照样扔”“先不扔”这样的短接续 |
| player_action | 当前自由输入，或被选建议按钮的文字 | 本轮要解决的请求 |
| text.format | strict JSON Schema | 规定提案格式，方便程序检查；不保证物理与语义一定正确 |

world 作为 user 消息中的 JSON 资料发送，并不是额外系统指令。历史中的 role 字段也只是资料字段，没有被提升为本次 API 的 developer 消息。

当前场景很小，发送全部实体，不做相关性检索。存档中的完整日志、Cookie、token_hash、API Key、IP、数据库锁等不会放入 world。世界数据和已有日志来自玩家交互，因此 HOST 明确要求把其中的指令式文字当资料。

## 4. 调用 A 返回什么

以下是格式示意，字段完整但内容不是声称某次模型逐字输出：

```json
{
  "intent": "尝试点燃白垩，再投到门内",
  "steps": [{
    "attempt": "将白垩凑近油灯火焰",
    "status": "failed",
    "beat": "action",
    "requires_previous_success": false,
    "scope": "near",
    "refs": ["lamp", "chalk"],
    "move_to": "stay",
    "door": "unchanged",
    "end": "continue",
    "updates": [],
    "creates": [],
    "outcome": "白垩未能点燃，仍在手中，尚未投出。",
    "observations": []
  }],
  "decision": {
    "disposition": "replace",
    "needed": true,
    "question": "白垩没有燃起来，仍然投出吗？",
    "pending_action": "将白垩投到门内近处",
    "reason": "试火目的可能落空，继续投掷会失去手中物品。"
  },
  "evolution": { "basis": "none", "updates": [], "observations": [] }
}
```

steps 是待检查的提案：updates 修改已有实体，creates 只能从实际损失的材料派生碎片。beat 区分实际操作、明确等待、纯确认，没有数值耗时。decision 用 disposition 明确没有待选事项（none）、保留（keep）、新建或替换（replace）、执行解决（resolve）、明确取消（cancel）。追问不覆盖原话或清除旧事项；机关强制中断也保存未执行部分。decision 保存待决定事项；evolution 记录有实际行动或明确等待依据的自然变化，暂停时必须为空。

随后程序验证位置邻接、物品来源、不能复活或无故修复、关键机关和暂停约束。在内存副本中结算；这时还没有写入正式存档。模型可能给出符合 JSON 格式却不合理的答案，格式约束不能替代这些检查。

## 5. 调用 B 收到与返回什么

第二次请求同样有 developer 和 user 两条消息，developer 换成 NARRATOR。user 包含：

- player_action：玩家原话；
- before：行动前的完整主持上下文；
- confirmed_steps：程序实际接受的步骤，可能已被机关或暂停截断；
- decision：待玩家决定的事项；
- evolution：已检查的持续变化；
- after：应用结果后的主持上下文；
- ending：是否真的结束。

输出上限2200 tokens，格式是：

```json
{
  "consistent": true,
  "issue": "",
  "issue_code": "none",
  "narration": "灯焰掠过白垩，它没有燃起来。你仍握着它，尚未投出……"
}
```

这个调用既复核“是否偷换意图、擅自行动、泄露不可见信息”，也负责写玩家看到的正文。它知道 before/after 两个世界快照，因此必须遵循玩家视野限制。复核也由模型完成，仍可能漏判；程序硬约束与语义复核各有边界。

## 6. 内部修正与真正保存

若程序拒绝提案或调用 B 判为矛盾，下一次调用 A 收到同一份原始 world、同一 player_action，额外带 correction：上一份未提交提案和具体拒绝原因。不能从错误候选继续推进。

最多修正一次：正常2次模型调用，失败路径最多4次，共用90秒裁定截止；预算或网络错误不当作语义问题无限重试。全部通过后才原子保存状态与 requestId 回执，避免玩家点重试而重复丢物或重复触发机关。

页面仅获得 game 投影：正文、背包、已知线索、地图、建议、待决定事项等。不会拿到主持完整的后台世界。

## 7. 本项目中值得学习的四个设计选择

1. **记忆分层。** entities 保存当前事实，knownEntities 保存玩家知识，recent 保留短期对话，pendingDecision 保存未完成意图。关门后看不见火势、补答能认出白垩，靠的是不同记忆层。
2. **信息优先级。** 稳定规则在 developer，世界和玩家文字是资料。旧日志里的灯油期限需要被明确的新规则覆盖。
3. **事实与文字分工。** 先提案、校验，再叙述，最后提交；漂亮的故事文字不能直接变成有效存档。
4. **上下文有取舍。** 最近6条日志节省输入，但会丢掉早期细节；把重要后果写入事实层能弥补一部分。现有16条观察/18实体容量仍是实验边界，不能称为无限记忆。before/after重复发送有成本，当前优先易于复核，未来可研究更精简的差异表示。

源码：functions/_lib/fiction-lab-host.js（两套提示词、两个schema、修正循环）；fiction-lab-engine.js（hostContext与状态结算）；fiction-service.js（API请求、预算、存档事务）；functions/api/fiction-lab.js（组装入口）。

官方资料：
- https://developers.openai.com/api/docs/guides/conversation-state
- https://developers.openai.com/api/docs/guides/structured-outputs
