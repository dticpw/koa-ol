# Render 后端 + koa-ol.com/games 前端整合方案

本文档记录旧德州扑克项目的业务逻辑阅读结果，以及下一步如何把它和当前 `koa-ol.com/games/` 项目结合。

## 结论

建议采用：

```text
koa-ol.com/games/
  -> 作为新的统一游戏入口和前端页面

Render poker-backend
  -> 保留为实时德州扑克后端
  -> 继续负责 WebSocket、房间状态、德州扑克规则、超时、广播
```

也就是说，短期不要把旧德州扑克后端迁入 Cloudflare Pages Functions。

原因：

- 旧项目后端已经是 FastAPI + WebSocket 的实时游戏服务。
- 德州扑克需要常驻房间状态、低延迟广播、超时任务、断线重连，这些更接近 Render 这类常驻后端服务的使用方式。
- 当前 Cloudflare Pages + Functions + D1 更适合静态页面、轻量 API、日志和持久化，不适合作为德州扑克实时运行时。
- 如果未来要完全 Cloudflare 化，应该迁移到 Worker + Durable Object + WebSocket，而不是继续堆 Pages Functions + D1 轮询。

## 旧项目位置

本地路径：

```text
C:\Users\DTICPW\Desktop\texas\code\1117_2128\poker-game
```

GitHub 远端：

```text
https://github.com/dticpw/texas_page.git
```

主要结构：

```text
poker-game/
  render.yml
  docker-compose.yml
  backend/
  frontend/
```

## 旧项目部署方式

旧项目不是直接上传本地文件夹到 Render，而是通过 Git 仓库部署。

`render.yml` 定义了两个 Render web service：

```yaml
services:
  - type: web
    name: poker-backend
    env: docker
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend

  - type: web
    name: poker-frontend
    env: docker
    dockerfilePath: ./frontend/Dockerfile
    dockerContext: ./frontend
```

前端环境变量指向后端：

```yaml
REACT_APP_API_URL: https://poker-backend-2fs9.onrender.com
REACT_APP_WS_URL: wss://poker-backend-2fs9.onrender.com
```

当前线上前端：

```text
https://poker-frontend-pw8u.onrender.com
```

当前线上后端：

```text
https://poker-backend-2fs9.onrender.com
wss://poker-backend-2fs9.onrender.com
```

## 已阅读的核心业务逻辑

### 后端技术栈

位置：

```text
backend/
```

技术：

```text
FastAPI
uvicorn
websockets
pydantic
```

依赖文件：

```text
backend/requirements.txt
```

关键依赖：

```text
fastapi==0.104.1
uvicorn[standard]==0.24.0
websockets==12.0
pydantic==2.5.0
```

### 后端入口

文件：

```text
backend/app/main.py
```

职责：

- 创建 FastAPI 应用。
- 设置 CORS。
- 提供 HTTP API。
- 提供 WebSocket endpoint。
- 管理 WebSocket 连接。
- 广播大厅和房间更新。
- 启动后台任务：
  - 检查玩家超时。
  - 清理空房间。

### WebSocket 连接管理

核心类：

```text
ConnectionManager
```

主要状态：

```python
active_connections: Dict[str, WebSocket]
user_rooms: Dict[str, str]
pending_disconnects: Dict[str, asyncio.Task]
```

能力：

- 用户连接。
- 用户断线。
- 同一用户重连时关闭旧连接。
- 断线后延迟清理，给玩家重连机会。
- 向单个用户发送私有消息。
- 向整个房间广播消息。
- 向大厅广播房间列表更新。

这部分正是德州扑克多人实时游戏需要的常驻后端能力。

### 房间管理

文件：

```text
backend/app/services/room_manager.py
backend/app/models/game_room.py
```

核心类：

```python
RoomManager
GameRoom
```

房间管理逻辑：

- 创建房间。
- 按游戏类型查询房间。
- 加入房间。
- 离开房间。
- 空房间清理。
- 房间状态统计。

房间状态：

```python
WAITING
READY
PLAYING
FINISHED
```

重连逻辑：

- `GameRoom` 会记录 `game_player_ids`。
- 玩家刷新或断线后，如果仍属于游戏玩家，可以重新加入。
- 游戏进行中，新玩家不能随便加入。

### 德州扑克服务

文件：

```text
backend/app/services/texas_holdem_service.py
```

核心类：

```python
TexasHoldemService
```

主要职责：

- 为房间创建 `FullTexasHoldem` 游戏实例。
- 开始游戏。
- 处理玩家动作。
- 获取玩家视角的游戏状态。
- 检查超时。
- 处理超时自动弃牌。
- 删除游戏。
- 重置游戏，再来一局。

当前游戏状态存储在内存中：

```python
self.games: Dict[str, FullTexasHoldem] = {}
```

这说明旧项目的实时游戏状态依赖常驻后端进程，而不是数据库。

### 德州扑克核心规则

文件：

```text
backend/app/models/texas_holdem_game.py
```

核心类：

```python
FullTexasHoldem
PokerPlayer
```

已实现能力：

- 游戏阶段：
  - `waiting`
  - `pre_flop`
  - `flop`
  - `turn`
  - `river`
  - `showdown`
  - `finished`
- 玩家动作：
  - `fold`
  - `check`
  - `call`
  - `bet`
  - `raise`
  - `all_in`
- 玩家状态：
  - `active`
  - `folded`
  - `all_in`
- 盲注机制。
- 发底牌。
- 发公共牌。
- 回合推进。
- 当前玩家行动截止时间。
- 超时自动 fold。
- 摊牌。
- 牌型评估。
- 赢家结算。
- 下一局移动庄家位置。

注意：

- 代码中 `ALL_IN` 枚举存在，但 `_validate_action` 当前禁用了 all-in。
- `max_bet_per_hand` 通过大盲倍数限制单局最大下注。
- 当前实现还不是严格完整的真实德州规则，尤其是 all-in、边池、单挑盲注规则、平局分池等需要后续审查。

### 牌型评估

文件：

```text
backend/app/models/poker_hand.py
backend/app/models/card.py
```

职责：

- 牌和牌堆模型。
- 洗牌、发牌。
- 德州手牌评估。
- 摊牌比较。

这部分可以作为后续迁移 Cloudflare Durable Object 时的规则参考，但 Python 代码不能直接放进 Worker，需要重写为 JavaScript/TypeScript 或继续保留在 Render 后端。

## 旧前端接入方式

位置：

```text
frontend/
```

技术：

```text
React
TypeScript
react-scripts
```

### API 配置

文件：

```text
frontend/src/utils/api.ts
```

核心导出：

```ts
export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();
```

生产环境默认后端：

```text
https://poker-backend-2fs9.onrender.com
wss://poker-backend-2fs9.onrender.com
```

### WebSocket Hook

文件：

```text
frontend/src/hooks/useWebSocket.ts
```

连接格式：

```ts
const wsUrl = `${WS_BASE_URL}/ws/${userId}`;
```

能力：

- 建立 WebSocket。
- 发送 ping。
- 接收消息。
- 自动重连。
- 限制最大重连次数。
- 提供 `sendMessage` 给组件发送消息。

### 前端主要组件

关键文件：

```text
frontend/src/components/GameLobby.tsx
frontend/src/components/GameRoom.tsx
frontend/src/games/TexasHoldem/PokerTable.tsx
frontend/src/games/TexasHoldem/ActionPanel.tsx
frontend/src/games/TexasHoldem/PlayerSeat.tsx
frontend/src/games/TexasHoldem/PlayingCard.tsx
```

这些文件已经包含可复用的：

- 大厅逻辑。
- 房间逻辑。
- 德州牌桌 UI。
- 玩家座位 UI。
- 行动按钮。
- 手牌/公共牌展示。

## 旧后端主要 API

HTTP API：

```text
GET  /api/game-types
GET  /api/rooms/{game_type}
POST /api/rooms/create
POST /api/rooms/{room_id}/join
GET  /api/rooms/{room_id}/details
POST /api/rooms/{room_id}/leave

POST /api/game/texas-holdem/{room_id}/start
POST /api/game/texas-holdem/{room_id}/action
POST /api/game/texas-holdem/{room_id}/reset
```

管理 API：

```text
POST   /api/admin/login
POST   /api/admin/logout
GET    /api/admin/stats
GET    /api/admin/rooms
DELETE /api/admin/rooms/{room_id}
POST   /api/admin/rooms/{room_id}/kick/{user_id}
POST   /api/admin/rooms/{room_id}/end-game
POST   /api/admin/cleanup
POST   /api/admin/broadcast
```

WebSocket：

```text
GET /ws/{user_id}
```

WebSocket 消息类型包括：

```text
ping
pong
chat
subscribe_lobby
lobby_update
sync_room
room_state
sync_game_state
game_state_sync
player_joined
player_left
player_reconnected
player_disconnected
player_timeout
game_started
game_state_update
player_action_result
room_closed
kicked
player_kicked
game_ended_by_admin
admin_broadcast
```

## 推荐整合方案

### 方案选择

短期推荐：

```text
Render 继续运行 poker-backend
koa-ol.com/games 逐步替代 poker-frontend
```

不建议短期：

```text
把 FastAPI 后端迁入 Cloudflare Pages Functions
```

原因：

- Pages Functions 没有传统常驻进程模型。
- 当前旧后端依赖内存房间和后台任务。
- WebSocket 广播和延迟断线清理更适合 Render 当前模型。
- 直接迁 Cloudflare 会变成 Durable Object 重写工程，不是简单搬运。

### 前端整合方式

有两种可选路线。

#### 路线 1：iframe 嵌入旧前端

最快方式：

```text
koa-ol.com/games/
  -> 显示入口
  -> iframe 打开 https://poker-frontend-pw8u.onrender.com
```

优点：

- 几乎不用改旧项目。
- 最快能把旧游戏挂到 koa-ol.com 下。

缺点：

- UI 风格割裂。
- 地址栏和房间链接不优雅。
- 跨域、焦点、移动端适配、复制链接体验一般。
- 不能真正把游戏体验变成 koa-ol 原生页面。

不推荐作为长期方案。

#### 路线 2：复用旧前端逻辑，重做 koa-ol 前端

推荐方式：

```text
koa-ol.com/games/
  -> 原生游戏入口
  -> 使用旧后端 API
  -> 使用旧后端 WebSocket
  -> 逐步移植旧 React 组件逻辑/样式
```

优点：

- `koa-ol.com/games/` 成为真正统一入口。
- 可以沿用旧后端成熟实时逻辑。
- 可以重新设计更适合当前站点的 UI。
- 后续如果迁移 Durable Object，前端入口不用再大改。

缺点：

- 需要把当前纯 HTML/JS 前端和旧 React 前端做一次取舍。
- 如果继续保持当前无构建静态页面，移植 React 组件不直接。
- 若想完整复用旧 React 组件，可能要在 `games/` 下引入构建流程，或把旧前端单独构建后作为静态资源接入。

## 建议下一步

我建议分三步做。

### 第一步：保留旧 Render 后端，只替换连接目标

当前 `koa-ol.com/games/` 先不要再调用 Cloudflare D1 房间 API，而是改为调用：

```text
https://poker-backend-2fs9.onrender.com
wss://poker-backend-2fs9.onrender.com
```

先实现最小闭环：

- 从 koa-ol 页面连接旧 WebSocket。
- 创建旧后端房间。
- 加入旧后端房间。
- 启动旧后端德州扑克。
- 执行 fold/check/call/bet/raise。
- 接收 `game_state_update`。

### 第二步：迁移旧前端的德州牌桌 UI

优先阅读和迁移：

```text
frontend/src/games/TexasHoldem/PokerTable.tsx
frontend/src/games/TexasHoldem/ActionPanel.tsx
frontend/src/games/TexasHoldem/PlayerSeat.tsx
frontend/src/games/TexasHoldem/PlayingCard.tsx
```

如果继续坚持当前 `koa-ol` 无构建模式，需要把这些 React 逻辑改写成原生 JS/HTML。

如果接受构建流程，则可以在 `games/` 下引入一个小型 React/Vite 子项目，把旧组件迁入后构建成静态资源部署到 Cloudflare Pages。

### 第三步：再决定是否 Cloudflare Durable Object 化

当玩法在 koa-ol 前端 + Render 后端上稳定后，再判断是否迁移到：

```text
Cloudflare Worker + Durable Object + WebSocket
```

迁移时只迁移运行时，不要重做 UI：

- 前端继续保留。
- 游戏规则从 Python 迁移为 TypeScript。
- 房间状态从 Render 内存迁移到 Durable Object。
- WebSocket 广播改由 Durable Object 负责。

## 当前最推荐的技术路线

短期：

```text
koa-ol.com/games/
  -> Cloudflare Pages 静态前端
  -> 连接 Render FastAPI/WebSocket 后端
```

中期：

```text
koa-ol.com/games/
  -> 更完整的游戏 UI
  -> 仍连接 Render 后端
```

长期：

```text
koa-ol.com/games/
  -> Cloudflare Pages 前端
  -> Cloudflare Worker + Durable Object 实时后端
  -> D1 记录历史和结果
```

## 需要注意的风险

### Render 冷启动

旧前端打开时可能出现：

```text
Render - Application loading
```

说明服务会休眠或冷启动。

如果保留 Render 后端，前端需要显示：

```text
正在唤醒游戏服务器...
```

并做好重试。

### CORS 和 WebSocket Origin

旧后端当前 CORS 允许：

```python
allow_origins=[
    "https://poker-frontend-pw8u.onrender.com",
    "http://localhost:3000",
    "http://localhost:8000",
    "*"
]
```

虽然 `*` 当前能让 `koa-ol.com` 访问，但长期建议明确加入：

```text
https://koa-ol.com
https://www.koa-ol.com
```

### 内存状态不持久

旧后端房间和游戏状态存在内存中：

```python
RoomManager.rooms
TexasHoldemService.games
```

如果 Render 服务重启，房间会丢失。

短期可以接受，长期需要：

- Redis。
- Postgres。
- 或迁移 Durable Object。

### 旧规则还需要复核

旧德州扑克实现已经可玩，但仍需要复核：

- heads-up 盲注/庄位规则。
- all-in 当前被禁用。
- 边池未完整处理。
- 平局分池逻辑需要确认。
- `_showdown` 中部分结果保存代码顺序看起来有历史修改痕迹，需要专门测试。

## 推荐立即执行项

1. 在 `koa-ol.com/games/` 中增加 Render 后端配置：

```js
const POKER_API_BASE = "https://poker-backend-2fs9.onrender.com";
const POKER_WS_BASE = "wss://poker-backend-2fs9.onrender.com";
```

2. 新增 WebSocket 客户端模块：

```text
games/poker-client.js
```

3. 将当前 D1 房间创建逻辑暂时替换为旧后端房间创建逻辑。

4. 先实现最小联通测试：

```text
koa-ol.com/games -> Render backend -> 创建房间 -> WebSocket 收到 room_state
```

5. 再移植德州扑克牌桌 UI。

## 最终判断

现在不是“后端内容留到 Render，前端全部立刻搬到 koa-ol”这么简单。

更准确的拆分是：

```text
旧 Render backend
  保留，作为实时德州扑克服务

旧 Render frontend
  暂时作为参考和备份

koa-ol.com/games
  逐步替代旧前端，成为新的入口和 UI
```

这样最稳：

- 不丢掉已经成功跑通的实时游戏后端。
- 不被 Cloudflare Pages Functions 的实时能力限制卡住。
- 又能逐步把用户入口收回到自己的 `koa-ol.com` 域名下。

## 前端迁移到 koa-ol.com/games 的具体实施计划

目标：

```text
Render
  -> 只保留 poker-backend
  -> 继续负责 FastAPI、WebSocket、房间、德州扑克规则

koa-ol.com/games/
  -> 替代旧 poker-frontend
  -> 作为玩家进入游戏的唯一前端入口
```

### 需要改 Render 后端的内容

短期 Render 后端可以继续沿用当前部署：

```text
https://poker-backend-2fs9.onrender.com
wss://poker-backend-2fs9.onrender.com
```

需要确认或修改：

1. CORS 明确允许 koa-ol 域名。

```python
allow_origins=[
    "https://koa-ol.com",
    "https://www.koa-ol.com",
    "http://localhost:8788",
]
```

当前后端有 `*`，短期能工作，但正式使用建议改成显式域名。

2. WebSocket endpoint 保持可用：

```text
wss://poker-backend-2fs9.onrender.com/ws/{user_id}
```

3. 继续保留现有游戏 API：

```text
GET  /api/game-types
GET  /api/rooms/{game_type}
POST /api/rooms/create
POST /api/rooms/{room_id}/join
GET  /api/rooms/{room_id}/details
POST /api/rooms/{room_id}/leave
POST /api/game/texas-holdem/{room_id}/start
POST /api/game/texas-holdem/{room_id}/action
POST /api/game/texas-holdem/{room_id}/reset
```

### 需要改 koa-ol/games 的内容

当前 `koa-ol/games` 使用的是 Cloudflare 本地接口：

```text
/api/games/rooms
/api/games/rooms/:roomId
```

迁移后应改为连接 Render：

```js
const POKER_API_BASE = "https://poker-backend-2fs9.onrender.com";
const POKER_WS_BASE = "wss://poker-backend-2fs9.onrender.com";
```

需要新增前端能力：

- 生成并保存 `userId`。
- 连接 Render WebSocket。
- 自动 ping。
- 断线重连。
- 创建 Render 房间。
- 加入 Render 房间。
- 拉取房间详情。
- 订阅大厅更新。
- 同步房间状态。
- 启动德州扑克。
- 发送玩家动作：
  - `fold`
  - `check`
  - `call`
  - `bet`
  - `raise`
- 接收后端广播：
  - `room_state`
  - `player_joined`
  - `player_left`
  - `game_started`
  - `game_state_update`
  - `game_state_sync`
  - `player_timeout`
  - `player_disconnected`
  - `player_reconnected`

### 字段适配

当前 koa-ol 房间字段：

```js
room.roomId
room.gameType
room.players[].displayName
```

Render 后端字段：

```js
room.room_id
room.game_type
room.players[].name
room.creator_id
room.status
```

Render 德州扑克状态：

```js
game_state.phase
game_state.pot
game_state.current_bet
game_state.min_raise
game_state.community_cards
game_state.dealer_position
game_state.current_player
game_state.time_remaining
game_state.players
game_state.winners
game_state.game_results
game_state.small_blind
game_state.big_blind
game_state.max_bet_per_hand
```

迁移时建议前端直接适配 Render 字段，减少中间转换层。

### 实施顺序

1. 在 `games/app.js` 中加入 Render API 和 WebSocket 配置。
2. 新增 WebSocket 连接、ping、重连和消息分发逻辑。
3. 将“开新房”改为调用：

```text
POST https://poker-backend-2fs9.onrender.com/api/rooms/create
```

4. 将“加入房间”改为调用：

```text
POST https://poker-backend-2fs9.onrender.com/api/rooms/{room_id}/join
```

5. 将房间同步改为：

```text
GET https://poker-backend-2fs9.onrender.com/api/rooms/{room_id}/details
WebSocket: sync_room
```

6. 将“开始游戏”改为调用：

```text
POST https://poker-backend-2fs9.onrender.com/api/game/texas-holdem/{room_id}/start
```

7. 增加德州扑克游戏状态渲染：

- 公共牌。
- 底池。
- 当前下注。
- 当前行动玩家。
- 倒计时。
- 玩家筹码。
- 玩家底牌。
- 当前可操作按钮。

8. 增加玩家动作 API：

```text
POST https://poker-backend-2fs9.onrender.com/api/game/texas-holdem/{room_id}/action
```

9. 在 koa-ol 页面完成两浏览器窗口联调。
10. 等 koa-ol 前端可用后，旧 Render 前端可以保留为备份，不再作为主入口。

### 当前开始实施的最小目标

第一轮先做到：

```text
koa-ol.com/games/
  -> 连接 Render WebSocket
  -> 创建 Render 房间
  -> 加入 Render 房间
  -> 房间玩家列表同步
  -> 房主开始德州扑克
  -> 展示 Render 返回的 game_state
  -> 支持 fold/check/call/bet/raise 的基础动作
```

暂不做：

- 完整美化牌桌。
- 重构旧 React 组件。
- 迁移 Durable Object。
- 处理所有德州扑克边界规则。

## 当前实施进度

截至当前阶段，`koa-ol.com/games/` 已经开始替代旧 Render 前端作为新入口。

已完成：

- `games/app.js` 已接入 Render 后端地址：

```text
https://poker-backend-2fs9.onrender.com
wss://poker-backend-2fs9.onrender.com
```

- “开新房”会创建 Render 德州扑克房间。
- “加入房间”会加入 Render 德州扑克房间。
- 房间链接使用 `koa-ol.com/games/?room=...&game=texas`。
- 房间玩家列表会显示房主、玩家数、筹码和座位信息。
- 房主在 2 到 8 人时可以开始游戏。
- 开局后会展示：
  - 阶段。
  - 底池。
  - 当前下注。
  - 倒计时。
  - 公共牌。
  - 玩家筹码。
  - 当前玩家自己的底牌。
  - 其他玩家的隐藏底牌。
- 已接入基础动作：
  - `fold`
  - `check`
  - `call`
  - `bet`
  - `raise`
- 游戏结束后房主可以点“再来一局”。

已增加的稳定性兜底：

- WebSocket 正常时，使用 Render 后端推送同步房间和牌局。
- WebSocket 连接失败或 Render 冷启动返回 502 时，前端会继续自动重连。
- 房间信息每 3 秒通过 HTTP 轮询刷新一次，保证玩家加入后房主能看到人数变化。
- 游戏进行中也会用 Render 的重连接口拉取当前玩家的私有 `game_state`，避免 WebSocket 不可用时看不到自己的真实手牌。

本地验证结果：

- 本地 `http://127.0.0.1:8788/games/` 创建房间成功。
- 通过 Render API 模拟第二个玩家加入成功。
- 轮询能把房间人数刷新到 `2 / 8 玩家`，并启用“开始游戏”。
- 房主开始游戏后，页面进入“翻牌前”阶段。
- 房主自己的两张底牌能显示为真实牌面，其他玩家底牌保持隐藏。

当前仍需注意：

- Render WebSocket 偶尔会出现 `502` 握手失败，尤其是服务冷启动或免费实例休眠后。
- 现在已经有 HTTP 兜底，但真正流畅的多人实时体验仍依赖 WebSocket 稳定性。
- 下一步需要做两浏览器真实联调，验证两名真人玩家分别操作时的行动同步、超时、结算和下一局流程。

## 当前状态记录

当前推进整体顺利。

已经跑通的链路：

- `koa-ol.com/games/` 前端可以创建 Render 德州扑克房间。
- 第二个玩家可以通过房间链接或房间号加入。
- 房间人数可以刷新到 `2 / 8 玩家`。
- 房主可以开始游戏。
- 开局后可以展示玩家筹码、阶段、底池、公共牌区域和玩家底牌。
- 当前玩家能看到自己的真实手牌，其他玩家的底牌保持隐藏。

当前遇到的问题：

- Render 后端 WebSocket 偶发 `502` 握手失败。
- 这个问题通常出现在 Render 服务冷启动、休眠恢复或代理层不稳定时。
- 目前前端已经加入 HTTP 轮询和私有状态同步兜底，所以即使 WebSocket 暂时失败，开房、加入、开始游戏和显示自己手牌仍可继续工作。
- 但如果要达到真正顺畅的多人实时体验，后续仍需要重点验证和优化 WebSocket 稳定性。

下一步建议：

- 用两个真实浏览器窗口或两台设备做真人联调。
- 验证两名玩家轮流行动时，`fold/check/call/bet/raise` 是否能稳定同步。
- 验证超时、摊牌、结算、再来一局流程。
- 如果 Render WebSocket 502 频率较高，优先检查 Render 服务是否处于免费休眠实例，必要时升级实例或迁移实时后端到更稳定的常驻服务。
