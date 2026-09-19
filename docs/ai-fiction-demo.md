# 蛇墓余火 v1 · AI 互动小说 demo

公开入口：https://koa-ol.com/games/lantern-tomb/ 。免费非商业，改编 Skerples《Tomb of the Serpent Kings》前段。署名与许可见游戏的 credits.html，实际剧本见 story-guide.md。

## 实现

- `functions/_lib/fiction-engine.js`：纯规则引擎，7区域、5结局、40轮上限；不可信用户文本不能直接修改状态。
- `functions/_lib/fiction-service.js` / `functions/api/fiction.js`：同源 JSON API、随机 HttpOnly 会话 cookie、D1 状态、幂等回执、revision比较和带owner的超时锁。
- `games/lantern-tomb/`：原生 HTML/CSS/JS，当前浏览器自动恢复服务端存档，手机/键盘/减少动态效果支持。
- 模型：`gpt-5.6-sol`，Responses API，low reasoning，`store:false`。自由输入先结构化分类，再按确定规则结果生成叙事；建议按钮省去分类调用。上下文只含已知信息与最近事件。

## 配置与计费保护

沿用 Pages production 的 `DB`、`UPSTREAM_BASE_URL`、`UPSTREAM_API_KEY`。不向前端暴露凭据。新表全部使用 `koa_fiction_` 前缀，不修改现有 chat / games 数据。

`FICTION_DAILY_BUDGET_USD` 默认5，上限20，设0会关闭AI调用并保留建议行动的规则叙事。预算是按官方Standard输入$4/M、输出$20/M的等价用量额度，不代表上游转发商的实际账单封顶。每次调用先以请求UTF-8字节数加协议余量预留输入、加max_output_tokens预留输出；有usage后结算全部输出含推理，未命中/未知缓存按普通输入计费。失败无usage保留预留。预算存D1并原子预留，多实例共享。

每IP每天最多5个新会话、100个API请求，每分钟最多10次行动；网络地址哈希后计数。存档可恢复7天，行动后延长数据库期限并续期Cookie；过期记录暂不保证立即删除。模型超时30秒/调用，分类失败不推进；已判定行动的叙事失败用规则文本降级并保存。前端重试复用requestId，不自动无限重试。

## 校验

需要 Node.js 22（node:sqlite）。运行：

```sh
node --test tests/fiction-engine.test.mjs tests/fiction-api.test.mjs
node --check games/lantern-tomb/app.js
```

测试覆盖所有结局、两种安全解谜方法、危险撤离、非法移动/奖励重复、状态私密性、会话恢复、跨站拒绝、幂等、并发与旧owner防覆盖、预算降级与分类失败重试。

浏览器验收还应覆盖开局、建议动作、自由输入、刷新恢复、预算耗尽后改用建议、移动端无横向溢出、来源页。mock测试与真实模型测试分开记录，mock通过不表示上游可用。

2026-09-19发布前验证：18项规则/API测试通过；Chrome模拟接口检查覆盖6种明确失败后继续建议行动、网络重试、键盘标签切换和移动端。真实Sol接口及本地真实浏览器完成5步寻宝撤离路线，自由输入、建议、物品更新、刷新恢复、结局、来源页及大厅入口通过。独立复核关闭了预算错误后输入锁死问题。

## 发布与回退

站点沿用GitHub main触发Cloudflare Pages部署。提交仅本功能文件及首页/大厅入口，保护既有未提交工作。生产发布后核对部署commit、HTTP资源、真实API及浏览器。

需要退回时，对本次功能commit执行git revert并推送main，等待Pages新部署；D1旧存档表可保留，不删除数据库。需要仅停止AI花费时，将FICTION_DAILY_BUDGET_USD设为0并重新部署，建议动作仍可完成故事。

## 已知边界

自由输入映射到当前已支持的行动，并非无限开放世界；人物对话围绕该短篇已写事件。AI描述仍可能不严谨，以规则结果及背包/线索为准。未实现账号、跨设备同步、存档导入、实时生图和多人模式。不要在自由输入中提交敏感信息。
