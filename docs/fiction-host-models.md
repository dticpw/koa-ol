# 可选主持模型

单人冒险在开始前选择主持，重新开始弹窗也可选择。多人桌由房主在开局按钮旁选择。选项为 GPT-5.6 Sol（默认，low）和 DeepSeek V4.1 Flash（high，试用）。开局将 `hostModel` 写入服务器存档；行动请求不能更改它。模型未配置时对应选项不可选，不会静默换用另一模型。

模型选择与主持规则版本分开：单人仍使用现有冒险裁定/复核规则，多人仍使用 cooperative-v4。原先的状态检查、玩家自主权、信息边界和失败不提交规则继续生效。封测阶段不承诺跨版本存档兼容；这里固定模型是为了让同一局与评测结果保持可解释。

## 接口

- `functions/_lib/fiction-models.js`：允许列表、公开标签、请求适配、用量归一化、估价和本地 JSON Schema 校验。
- `fiction-service.js`：共用调用、预算预留和结算、单人选择与 trace。
- `multiplayer/service.js`：房主选择、存档固定、公开主持标签。
- GPT 沿用 `UPSTREAM_API_KEY` / `UPSTREAM_BASE_URL` 和 Responses 接口。
- DeepSeek 使用已有的 `DEEPSEEK_API_KEY`；可选 `DEEPSEEK_BASE_URL`，默认 `https://api.deepseek.com`。当前 API ID 为 `deepseek-flash`，通过 Chat Completions 显式设置 `thinking.type=enabled`、`reasoning_effort=high`。

DeepSeek JSON Mode 不等于严格 Schema。适配层把原格式 Schema 和一个形状示例作为序列化说明发送，将 developer 角色映射并合并为一条 system；返回后本地校验，再进入原有因果/权限/状态校验。不能因为 JSON 语法有效就提交。格式错误最多重试一次，从同一输入重新生成，分享原调用时限，保留两次用量；不重试截断或网络故障。返回正文混入思考分隔标记时拒绝提交并省略该次文字，不转发给玩家。

多人 DeepSeek 请求另补简短字段说明：本轮同行与跨轮授权分开、持续授权每人独立且绑定本人证据、场景使用 ID、复核应实际修正校验错误。单人另提醒感官装饰不能升级为关键线索，不能凭空堵死原本可行的方案，复核需对照剧本而非仅相信草案。它们解释既有约束，不改故事规则，不给模型新增权限。GPT 提示词保持原样。

单人还明确解释 `LAB_INVALID:communication target`：该错误检查的是 updates 里混入了非 NPC 物件，不能仅删 refs。边谈边记可以在同一轮完成，但记笔记要由单独 near/observe 步骤更新记录载体。这是在暴露现有约束，没有放宽引擎校验。

`max_tokens` 包含推理输出。DeepSeek 在原回答限额上额外预留 16,384 token，总上限 24,000。High 单次调用含格式重试最多 90 秒，同时仍受原整轮时限约束（单人 120 秒、多人 150 秒）；GPT 原有单次时限不变。加大推理余量不等于无限等待。截断或格式错误不提交，缺失用量的超时保留保守预算预留，不算作真实已付金额。

## 用量与费用

trace 保留实际输入、总输出、缓存命中、可取得的推理 token 数、返回型号、完成原因与耗时。只记录数值，不保存模型内部思考原文；不记录凭据、请求头和原始上游错误。

单人“主持调用详情”支持两种请求格式，并可展开 token 用量与费用估算。多人真实测试保存完整私有 trace；多人前端不开放隐藏上下文给队员。

DeepSeek 估价按官方美元费率：高峰输入 0.30、缓存输入 0.006、输出 1.20 美元/百万 token；离峰减半。UTC 工作日 01–04、06–10 为高峰窗口。假日可能额外享受离峰价，程序不内置未来假日表，因此高峰金额标为保守上限。预留始终按高峰计算，取得 usage 后按实际 token 归还差额。推理 token 已含于总输出，不重复收费。币价规则需随供应商更新。

GPT 保留输入 4 / 输出 20 美元的参考估价，不假定中转实际账单等于官方价格。`estimatedUsd` 从来不是支付凭证；报告必须区分已知用量估价、未知调用的预算预留，以及模拟玩家的单独成本。

## 本机评测

`scripts/fiction-model-run.py` 只通过 credential-vault CLI 读取命名凭据，把它们传入子进程环境。不会写入命令参数或文件。调用者需设置正确的 `AGENTFLOW_CREDENTIALS_FILE`，并通过 `--vault-cli` 指定 CLI 路径。

```text
python fiction-model-run.py --vault-cli <credential_vault.py> -- <node> scripts/eval-multiplayer-v4.mjs --host-model=deepseek-flash --out=<专用目录> --only=<案例ID列表>
python fiction-model-run.py --vault-cli <credential_vault.py> -- <node> scripts/eval-multiplayer-ensemble.mjs --host-model=deepseek-flash --rounds=25 --out=<专用目录>
python fiction-model-run.py --vault-cli <credential_vault.py> -- <node> scripts/eval-fiction-host-model.mjs --host-model=deepseek-flash --story=library-delve --rounds=20 --out=<专用目录>
```

以上为参数示意；Linux 使用全局指令指定的 Python 与 Node 绝对路径。固定探针包含合成状态；连续游玩的 GPT 玩家只读公开资料，不读主持秘密。每个输出目录固定模型，不将不同适配版本混成一次无失败测试。所有失败、检查修正和超时也要保留。公开阅读日志不足以单独证明没有幕后信息泄露，需同时核对剧本资料。

2026-09-23 的原始记录位于项目资源库 `records/deepseek-high-20260923/`。最终评价以该目录报告为准，不把本说明当作验收结果。
