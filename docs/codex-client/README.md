# Codex App 多模型中转

入口：`https://koa-ol.com/ai/v1`。本目录不包含任何 API Key。

## 已验证的模型范围（2026-09-22）

| 模型 | 推理档位 |
|---|---|
| GPT-5.5 | low / medium / high / xhigh |
| GPT-5.6 Sol、Terra、Luna | low / medium / high / xhigh / max |
| GPT-6 Astra | low / medium / high / xhigh / max |

24 个组合均通过上游真实 Responses 请求，返回模型、effort 与请求一致。这只能确认上游报告的模型，不是对第三方底层模型身份的独立鉴定。GPT-5.4 等未出现在当前上游可用列表，不提供名字映射。

Fast / Ultrafast：上游接受 priority / ultrafast 请求，但全部返回 `service_tier=default`，因此本配置不提供加速菜单，新 Key 会明确拒绝这些参数。Ultra 是客户端目录中的自动委派模式，不是本次验证的普通 API 推理档位，暂不列入交付菜单。

## Windows 配置

1. 安装当前 Codex / ChatGPT Windows App，完全退出后，下载本目录的 `setup-windows.ps1` 与 `models.json` 到同一文件夹。
2. 在该目录打开 PowerShell，执行：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-windows.ps1
   ```

   该命令仅为本次 PowerShell 进程允许脚本运行，不修改全局执行策略。脚本先隐藏输入并验证 Key，再备份现有用户配置、安装模型目录、切换默认提供商并设置用户级 `KOA_CODEX_API_KEY` 环境变量。不会覆盖既有 MCP、其他提供商和项目配置。环境变量保存在当前 Windows 用户的注册表配置中，不等同于加密密码本。
3. 粘贴站主发给你的**客户端 Key**。不需要上游 Key 或站主账户密码。站主的新 Key 保存于私人密码本条目 `koa-codex-multimodel`。
4. 注销并重新登录 Windows，使桌面进程取得新环境变量。重新打开 App，创建新会话，确认模型菜单列出上述五个模型与相应档位。已有会话可能仍绑定旧提供商。
5. 分别切换 GPT-5.5、GPT-6 Astra，发送简短请求；再让它读取一个无敏感信息的测试文件，验证实际工具调用。Windows UI 验收需在 Windows 上完成，Linux 验证不能替代它。

如果不想用脚本，可按 `config.example.toml` 合并用户级配置（默认 `%USERPROFILE%\.codex\config.toml`），并把 `model_catalog_json` 改为模型目录的真实路径。不要将示例整份覆盖现有配置，也不要把根字段放进某个 `[table]`。脚本尊重已设置的 `CODEX_HOME`。

回退：完全退出 App，恢复 `config.toml.before-koa-*.bak` 中本次备份；如原先不存在配置则移除本次新增的根设置和 `[model_providers.koa_proxy]`。不再使用本 Key 时可删除 `KOA_CODEX_API_KEY` 用户环境变量。保留备份到 Windows 验收完成。

## 服务端与运维

- 原有 `CLIENT_API_KEYS` 保持原值，仍只允许 `gpt-5.6-sol`。
- 新 `CODEX_CLIENT_POLICIES` 是 JSON 对象：以客户端 Key 的 SHA-256 十六进制摘要为键，值为 `{ "models": ["gpt-6-astra", ...] }`。明文 Key 只保存在私人密码本；摘要配置不授予访问权限。
- 新 Key 可单独撤销：删除对应策略或设置 `disabled: true`，重新部署。每位朋友若需独立撤销、额度或审计，应该分别发行 Key；本次共享 Key 没有独立消费上限，消耗站主上游额度。
- `/models` 按 Key 返回允许的模型；`/responses` 校验模型与 effort，保留流式响应、工具字段和上游错误状态。模型目录要通过客户端 `model_catalog_json` 加载，不能假设 App 自动从 `/models` 建菜单。
- 仅 HTTP Responses / SSE，禁用 WebSocket 与 Responses Lite。API Key 不提供 ChatGPT 订阅、云端任务等账号专属功能。
- `/responses/compact` 使用相同鉴权并透传到上游，但当前上游返回 404，尚无可用远程压缩能力；长会话压缩需另行验收。普通短会话与工具调用的成功不能证明长会话能力。
- 线上日志沿用 `chat_logs`，不新增数据库表或记录提示词、代码、客户端 Key。

测试：在仓库根运行 `node --test tests/codex-proxy.test.mjs`。模型目录源于 Codex CLI 0.155.1 内置目录，裁剪到实际可用范围，关闭未验证的传输及加速功能。升级客户端后需重新核对。

官方参考：[提供商与模型目录配置](https://learn.chatgpt.com/docs/config-file/config-reference)、[高级配置](https://learn.chatgpt.com/docs/config-file/config-advanced)、[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)。
