# 神社主页

首页以博丽神社微缩场景为主视觉，保留 Chat、Multi-Agent、Galgame、Games、Captcha Test、Stats、GitHub 与 Cloudflare 的原有入口。

## 文件

- `/index.html`：主页内容与语义结构。
- `/assets/home/home.css`：仅用于主页的响应式样式，不影响子项目。
- `/assets/home/home.js`：场景加载状态、预览图降级、离屏暂停通信。
- `/assets/home/shrine-poster.webp`：从实际模型渲染生成的静态预览。
- `/shrine/index.html`、`/shrine/scene.js`：完整、无 UI 覆盖的神社模型。
- `/shrine/vendor/`：固定版本 Three.js 0.170.0 与必要模块、MIT 许可。

## 两种体验

`/shrine/` 提供拖拽旋转、滚轮或双指缩放；画布聚焦后可以使用方向键、加减号及 Home 键。

主页使用 `/shrine/?embed=1`，只启用旋转，滚轮保留给网页滚动；移动端允许纵向页面滚动。首页可直接进入完整场景。iframe 与主页仅接收同源且来自指定窗口的消息。渲染完成后才隐藏预览图，WebGL 不可用或资源失败时仍可查看静态图；关闭 JavaScript 也不影响项目链接。

场景离开可见区域、切换浏览器标签后暂停绘制，系统开启减少动态效果时停止飘落花瓣。未引入运行时外部 CDN 请求、分析 SDK 或构建步骤。

## 本地运行与发布

在仓库根目录执行：

```powershell
& 'D:/python/anaconda/envs/th123/python.exe' -m http.server 8787 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8787/`。通过现有 GitHub main → Cloudflare Pages 流程发布。

本次主页样式独立于历史 `design-system.css`，子项目继续使用它们现有的样式和导航。

## 本次验证

- 1440px 桌面、768px 平板、560px 窄平板、390px 和 320px 手机宽度检查；修正窄平板标题溢出。
- 首页真实鼠标拖拽改变相机；在场景上滚轮操作滚动页面，模型缩放保持不变。
- 滚动离开场景后绘制帧计数停止，回到场景后恢复。
- 模拟场景脚本请求失败，静态预览保持可见，六个项目入口仍可用。
- 全部站内入口在本地返回 HTTP 200；原有外部链接保留。
- 首页脚本、场景脚本通过 Node 语法检查；正常加载无浏览器错误。

## 2026-09-14 灵梦扫庭替换

/shrine/采用模型库的hakurei-shrine-reimu-v2小步行走修订。新增reimu.js与assets/reimu-walk-atlas.png，继续共用现有vendor目录；首页预览、iframe和模块入口带新版本标记。灵梦在脚边小扫动，停顿后提扫帚走到附近，朝向跟随移动，不再跳跃。首页保持透明嵌入、滚轮归页面、离屏暂停及失败时静态预览。

本地验收1440桌面与390手机显示，实际拖拽旋转、滚动不改变缩放、离屏暂停。独立模型仍支持缩放与Home复位。后续维护先改模型库，再同步部署副本。
