# 验证记录 · 2026-09-22

服务代码提交：`501b904f7a252f2395e481d5eb1b832e7e8b3804`。
Cloudflare 首次部署：`0d4ecc97-04d0-4401-8ed7-347668375a35`，Functions 编译与部署成功。

| 检查 | 实际结果 |
|---|---|
| 本地权限与转发测试 | `node --test tests/codex-proxy.test.mjs`，7 项通过 |
| 上游模型与推理强度 | 24 个模型/effort 组合返回 200 completed，模型与 effort 一致 |
| 线上 `/models` | 新 Key 返回 5 个获准模型 |
| 线上拒绝检查 | 错误 Key 401；未授权模型、无效 effort、未验证的加速 tier 均 400 |
| 线上流式输出 | 5 个模型全部收到 `response.completed`；5.5 使用 xhigh，其余使用 max |
| 线上工具往返 | GPT-5.5、GPT-6 Astra 均完成 function_call 和 function_call_output 往返 |
| Codex 实际客户端 | Linux CLI 0.155.1，custom provider、Astra low、HTTP Responses，成功返回指定测试标记 |
| 模型目录 | 自定义 provider 加载后精确列出 5 个模型与已验证 effort，Responses Lite 关闭 |
| 旧用户兼容 | 原有 Cloudflare 环境变量回读逐项未变；本地回归确认旧 Key 仅 Sol；未取得旧 Key，未声称做过旧 Key 线上调用 |
| Windows App | 配置脚本与目录已交付，Windows 下的脚本运行、UI 菜单和工具执行尚待实机验收 |

第一次 GPT-5.5 工具验证只要求“调用工具”，却额外断言最终回答必须逐字回显结果，因此该断言失败；改用明确要求回显结果的提示后，往返返回 `KOA_TOOL_OK`，通过。无服务端代码变更。

能力边界：

- priority / ultrafast 请求虽然被上游接受，但返回的 tier 仍为 default，不能视为加速成功。
- 直接发送 ultra effort，Astra / Sol / Terra 均返回 400，声明有效档位为 low、medium、high、xhigh、max。客户端自动委派模式未验收。
- `/responses/compact` 返回上游 404；长会话压缩未验收。
- Cloudflare 拒绝 Python 默认 User-Agent（1010）。验证脚本与 Windows 配置脚本使用明确的 `koa-codex-validation/1.0`，没有关闭站点防护；Codex CLI 本身可正常访问。
- 第三方上游所报告的模型名不能独立证明底层模型身份。共享 Key 的使用消耗站主额度，本次未新增每用户消费上限。

进一步验收：在 Windows App 新会话中逐个切换模型，执行无敏感内容的文件读取，记录 App 版本和菜单档位；由站主在自己机器上检查长会话行为。任何 Key 都不得写入本目录或测试报告。
