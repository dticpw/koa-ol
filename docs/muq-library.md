# muQ 图书馆入口

主页主导航与项目区链接到 `/library/`。该目录是 muQ 的静态构建产物，由既有 Cloudflare Pages/GitHub main 部署流程发布。

- `index.html`、`library.css`、`library.js`：目录、搜索、藏书页、馆主解锁界面。
- `catalogue.json`：明确公开的标题、概述、封面与基本元数据。
- `archive.enc.json`：AES-GCM 加密的完整日记、逐条原话与附件。
- `covers/`：已选择公开的封面；无截图时使用根据公开字段生成的内容概览图。

不要向本仓库加入原始日志、明文日记、密码本或馆主口令。浏览器使用口令本地解密，页面不向服务器传送口令。保留 HTTPS 才能使用 WebCrypto。

内容更新从独立 muQ 项目生成；不要直接编辑 catalogue 或密文。`assets/home/library.css` 仅为主页新增入口样式，保持原有主页组件和动效。

本次上线不新增 Cloudflare KV/D1 表，不改现有站点 API 配置。主项目、来源日志和原始产物仍保存在用户本机共享目录。
