# Koa-OL Chat 部署指南

这是一个基于 Cloudflare Workers + Pages 的 Claude 聊天系统，可以让你在自己的域名下与 Claude 对话。

## 📁 项目结构

```
git_koa-ol/
├── chat/                    # 前端聊天界面
│   ├── index.html
│   ├── style.css
│   └── script.js
└── reverse_proxy/           # Cloudflare Worker (API 代理)
    ├── src/
    │   └── index.js
    ├── package.json
    └── wrangler.toml
```

## 🚀 部署步骤

### 1. 安装 Wrangler CLI

```bash
cd reverse_proxy
npm install
```

或全局安装：
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器，让你授权 Wrangler 访问你的 Cloudflare 账户。

### 3. 配置 API 密钥

你需要一个 Anthropic API 密钥。如果还没有，请访问：https://console.anthropic.com/

设置密钥（这会安全地存储在 Cloudflare）：

```bash
wrangler secret put ANTHROPIC_API_KEY
```

输入你的 API 密钥后按 Enter。

### 4. 部署 Worker

```bash
wrangler deploy
```

部署成功后，你会看到 Worker 的 URL，类似：
```
https://koa-ol-api-proxy.your-subdomain.workers.dev
```

### 5. 部署前端到 Cloudflare Pages

#### 方法 A：通过 GitHub（推荐）

1. 将代码推送到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
3. 进入 **Pages** → **Create a project** → **Connect to Git**
4. 选择你的 `git_koa-ol` 仓库
5. 配置构建设置：
   - **Build command**: 留空
   - **Build output directory**: `/chat`
   - **Root directory**: `/`
6. 点击 **Save and Deploy**

#### 方法 B：使用 Wrangler 直接部署

```bash
cd ..
npx wrangler pages deploy chat --project-name=koa-ol-chat
```

### 6. 配置自定义域名

#### 6.1 配置 Pages 域名

1. 在 Cloudflare Dashboard 中，进入 **Pages** → 你的项目
2. 点击 **Custom domains** → **Set up a custom domain**
3. 输入 `koa-ol.com` 或 `chat.koa-ol.com`
4. Cloudflare 会自动配置 DNS

#### 6.2 配置 Worker 路由

1. 在 Cloudflare Dashboard 中，进入 **Workers & Pages**
2. 选择你的 Worker (`koa-ol-api-proxy`)
3. 进入 **Settings** → **Triggers** → **Routes**
4. 添加路由：
   - **Route**: `koa-ol.com/api/*`
   - **Zone**: `koa-ol.com`

或者编辑 `reverse_proxy/wrangler.toml`，然后重新部署：

```toml
routes = [
  { pattern = "koa-ol.com/api/*", zone_name = "koa-ol.com" }
]
```

### 7. 访问你的聊天应用

现在你可以访问：
- **聊天界面**: https://koa-ol.com/chat/
- **API 端点**: https://koa-ol.com/api/chat

## 🔧 本地开发

### 启动 Worker 开发服务器

```bash
cd reverse_proxy
npm run dev
```

Worker 会运行在 `http://localhost:8787`

### 本地测试前端

你可以使用任何静态服务器，例如：

```bash
cd chat
npx serve
```

或使用 Python：
```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`

**注意**：本地开发时，需要修改 `chat/script.js` 中的 API_URL：

```javascript
const API_URL = 'http://localhost:8787/api/chat';
```

## 📝 配置说明

### Worker 配置 (wrangler.toml)

- `name`: Worker 名称
- `main`: 入口文件
- `compatibility_date`: 兼容性日期
- `routes`: 路由配置

### API 端点

**POST /api/chat**

请求体：
```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096
}
```

响应：
```json
{
  "id": "msg_xxx",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "你好！有什么我可以帮助你的吗？"
    }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "usage": { ... }
}
```

## 🔒 安全说明

- API 密钥存储在 Cloudflare Workers 的环境变量中，不会暴露给前端
- 所有请求通过你的域名代理，保护 API 密钥安全
- 建议启用 Cloudflare 的安全功能（WAF、Rate Limiting）

## 💰 费用说明

### Cloudflare Workers
- 免费额度：每天 100,000 次请求
- 超出后：$0.50 / 百万次请求

### Cloudflare Pages
- 免费额度：每月 500 次构建，无限流量
- 完全免费用于个人项目

### Anthropic API
- 根据使用的 tokens 计费
- Claude Sonnet 4.5: $3 / MTok (输入), $15 / MTok (输出)

## 🛠️ 故障排查

### Worker 部署失败
- 检查是否已登录：`wrangler whoami`
- 检查 wrangler.toml 配置是否正确

### API 请求失败
- 检查 API 密钥是否正确设置：`wrangler secret list`
- 查看 Worker 日志：在 Cloudflare Dashboard → Workers → 你的 Worker → Logs

### CORS 错误
- 确保 Worker 正确处理了 CORS 头
- 检查前端请求的 URL 是否正确

### 域名无法访问
- 检查 DNS 是否已生效（可能需要几分钟）
- 确认 Worker 路由配置正确

## 📚 相关文档

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Anthropic API 文档](https://docs.anthropic.com/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

## 🎉 完成！

现在你可以在 `koa-ol.com/chat/` 与 Claude 对话了！
