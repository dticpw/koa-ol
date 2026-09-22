# GPT Image 2 生图更新

现有客户端 Key 增加独立的 `gpt-image-2` 权限，通过 Koa 图像 MCP 工具在 Codex 内生成或编辑图片。继续选 Astra / Sol 等聊天模型，由它调用 `koa_images.generate_image` 或 `koa_images.edit_image`；不要把 `gpt-image-2` 当作聊天模型选中。

## Windows 安装

下载并完整解压 [生图更新包](https://koa-ol.com/docs/codex-client/koa-images-update.zip)。完全退出桌面 App，在解压目录的 PowerShell 执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-images.ps1
```

脚本无需管理员权限：备份当前 TOML，只追加一个 MCP 注册段，再复制工具文件。ExecutionPolicy 仅对这次进程生效。原有 `auth.json` 和 `koa-models.json` 不需要更新；已有聊天、插件、MCP 设置保留。更新包没有 Key，也不包含个人配置。

```text
C:\Users\chenwenjin\.codex\
  config.toml                # 增加 [mcp_servers.koa_images]
  auth.json                  # 原文件继续使用
  koa-models.json             # 原聊天模型目录继续使用
  koa-images\
    start.ps1                # 新增，找到 App 自带的 Node 后启动工具
    server.mjs               # 新增，生图/改图工具
```

完全退出 App 再打开，新建会话。例如：

> 使用 koa_images 的 generate_image 工具，生成一张水彩风格的小猫图片，先用 low 质量、1024×1024。请保存到我的桌面图片文件夹，使用一个新 PNG 文件名，然后显示图片。

改图时提供原图路径和需要修改的内容。工具上传选定图片并另存结果，不覆盖原图。上传内容会经过站主的第三方模型中转。

工具优先使用 Codex App 已有的 Node 运行时，无 npm 或 Python 包依赖。找不到 Node 时会明确报错，可先打开或更新 App，或者安装 Node.js 22 LTS。Windows 启动器和桌面工具发现仍需在 Windows 实机核验，Linux 测试不代表 Windows 已测试。

## 范围与限制

- 固定使用 `gpt-image-2`，不静默换成其他模型。每次生成一张 PNG；质量 low/medium/high/auto，默认 auto，多张通过多次调用生成。
- 支持文生图，以及以一张本地 PNG/JPEG/WebP 为参考的编辑；本地输入上限 16 MiB。
- 不支持透明背景。支持 auto 或符合模型约束的尺寸，例如 1024x1024、1536x1024、1024x1536。
- 图片调用消耗站主上游额度。超时或失败不自动重试，避免重复收费；收到成功结果才写新图片。
- API 为 `/ai/v1/images/generations`（JSON）和 `/ai/v1/images/edits`（multipart）；图片权限与聊天权限独立。
- 统计只记模型、操作、状态等元数据，不记录图片、提示词或 Key；token 数为 0，不可据此估算图片费用。
- 本包提供独立 `koa_images` 工具，不开通原生 ChatGPT 生图按钮、原生 image_gen 工具或账户订阅权限。

回退：关闭 App，恢复本次 `config.toml.before-images-*.bak`，即可停用工具；无需更换聊天 Key。

## 维护入口

服务端：`functions/_lib/codex-access.js` 的图片权限、`functions/_lib/codex-images.js` 的校验与转发、`functions/ai/v1/images/*.js` 路由、`functions/ai/v1/models.js` 模型列表。

Cloudflare：在既有 `CODEX_CLIENT_POLICIES` 的指定 Key 摘要策略中增加 `"image_models": ["gpt-image-2"]`。其他 Key 不自动获得权限。

客户端：本目录 `koa-images/`、`install-images.ps1` 和 `koa-images-update.zip`。聊天模型目录保持不变。

测试：设置 `KOA_IMAGE_TEST_ROOT` 为任务暂存目录，运行 `node --test tests/codex-proxy.test.mjs tests/codex-images.test.mjs tests/koa-image-mcp.test.mjs`。

官方参考：[GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2)、[图像 API](https://developers.openai.com/api/docs/guides/image-generation)、[Codex MCP 配置](https://learn.chatgpt.com/docs/config-file/config-reference)。
