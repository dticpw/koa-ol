# Authored AI adventures

The fiction shelf is `/games/fiction/`. Each adventure has an introduction, a play page, and a credits page. Only the CC-licensed first batch offers a spoiler-marked downloadable `scenario.json`.

## Source layout

- `functions/_lib/adventures/stories.js`: authored maps, ordinary entity properties, NPC motives, secret truths, milestones, ending conditions and attribution.
- `functions/_lib/adventures/engine.js`: state, map/resource checks, pending decisions, milestone prerequisites and the public view.
- `functions/_lib/adventures/host.js`: structured ruling schema, host instructions and consistency/narration review.
- `functions/_lib/fiction-turn.js`: shared bounded adjudication/review flow. The existing tomb lab retains its own engine and prompts.
- `functions/api/adventures/[story].js` and `[story]/archives.js`: per-story API and named snapshots. Unknown stories return 404.
- `scripts/build-adventure-pages.mjs`: regenerates the registered introductions, play pages, credits and public source packages from the authored stories, and updates their shelf cards.
- `games/fiction/adventure.css`: cover-derived dark reading theme. Existing shared play, inspector and collection scripts take the API base from `body[data-api]`.
- `tests/fiction-adventures.test.mjs`: graph, resource, ending, consent-evidence, session, trace and collection tests.

## Context and settlement

Each action is sent as `world` and `player_action` alongside developer-level host instructions. `world` includes the authored graph, current entities, NPC motives and secrets, last known player snapshots, completed flags, milestone requirements, available endings, recent observations/dialogue/events, bounded retrieval from the full history, source-linked memories and any pending decision. Secrets may appear in the opt-in call inspector; they are not included in the ordinary public game view.

The first model call proposes ordered steps, entity changes, discoveries, milestone claims, a pending decision and memory updates. The engine applies a candidate atomically in memory. The second call sees the before/after world and executed steps (including movement, derived objects and the exact memory-offer evidence), checks consistency and writes prose. A failed candidate may be corrected once; a rejected turn does not overwrite the save. This is semantic model review plus structural program checks, not a proof that all arbitrary narration is correct.

Each story gets independent session and collection cookies, a distinct game kind and a collection-owner namespace. Existing tomb sessions and archives retain their old cookies and owner hashes. Trace tables and the daily model budget are shared. Archives are read-only story snapshots, not resumable save slots.

There is no uniform in-world clock. Long actions may stop at a consequential decision. The request budget is separate: new adventures allow at most 120 seconds for adjudication plus review, at most 60 seconds per call, with the existing 150-second session lock. The old lab retains its 90/45-second limits.

## First batch and licenses

| Story | Author | Original source | Adaptation |
|---|---|---|---|
| 深入图书馆 / The Library Delve | Willem-Jan / 1pagedungeons.com | https://1pagedungeons.itch.io/leyebrary-opd | Five areas; voluntary fictional memory exchange, investigation and negotiation |
| 阿拉穆尔的亡魂 / The Ghosts of Aramoor | Jason Renslow | https://junkyardtornado.itch.io/the-ghosts-of-aramoor | Original six coastal/cave areas plus town; cargo, departure and recovery |
| 再见，流星 / Goodbye Shooting Star | Jason Renslow | https://junkyardtornado.itch.io/goodbye-shooting-star | Twelve ship compartments; research, distinct NPC motives and withdrawal |

The three first-batch adventure text adaptations are CC BY-SA 4.0. Each credits page names the author, links the original and license, and describes changes. Original artwork is not reused. New covers use GPT Image 2; final compressed assets are in `games/fiction/assets/`. These are bounded single-player narrative adaptations, not implementations of the original multiplayer combat systems.

## Verification

Run `node --test tests/fiction*.test.mjs` with a Node release supporting `node:sqlite`. Build Cloudflare Pages Functions with `wrangler pages functions build functions --outfile <artifact-path>`.

The first-batch real-model validation reached a library exit after a voluntary memory exchange and thief negotiation, a research-evidence withdrawal from the spaceship, and the pirate ship's departure followed by a report in town. It also exercised an early retreat from the cave. These samples validate selected routes, not every possible branch or an entire novel-length campaign. During validation, the missing consent evidence in review, remote radio interaction and incomplete cargo-unloading guards were corrected. Semantic identity disclosure and multi-step reach errors remain important regression targets.

## Retired stories and live updates

The classic serpent-tomb story is retired: its shelf card is removed, former introduction/play URLs show a retirement notice, and `/api/fiction` rejects fresh starts or resets with `410 game_retired`. Existing session reads and turns remain accepted so already-open play pages are not forcibly interrupted. The `games/lantern-tomb/` scripts, styles and credited assets also serve active stories and must not be deleted as if they were exclusive to the retired title.

Adding a distinct story does not recreate existing D1 sessions. A visitor's loaded document remains until navigation/reload; later API calls use the current deployment. Sessions currently do not pin an immutable story/rules version, so changes to shared logic or an existing story's authored configuration require backward compatibility. The daily model-spend budget is shared across stories.


## Author-permitted imports (2026-09-21)

《并蒂殇》 (`bindi-shang`, 13 scenes) and 《市中心的孤岛》 (`downtown-island`, 17 scenes) are by **梅姐**. The site owner confirmed author permission to adapt and publish, with this attribution required. They are NOT CC licensed and do not inherit the first batch's redistribution grant. The original DOCX files and original map artwork remain in the local source library; no public raw scenario package is generated for these two. Both introductions, credits, play footers and exported adventure snapshots carry author attribution.

`meijie-stories.js` contains the new bounded single-player adaptations. The mansion mystery starts the morning after the first murder and preserves identity deception, evidence investigation and opportunities to prevent later harm. The urban outbreak compresses the original seven-day timetable into exploration and causal decisions, with laboratory permission levels, a willing companion, distinct vaccines and prepared exit routes. These are not full reproductions of the original timed or dice-based rules. The credits list omitted branches and altered endings; the public introduction describes the scope without disclosing the culprit.

`authored-events.js` implements optional, script-owned milestone effects and willing companion movement. An event may update distant story entities, but never updates the player's old observation merely because the backend changed. Model narration review receives `scriptedChanges` and `companionMoves`; a hidden disguise must stay hidden in public prose. Milestone/ending `excludes` prevent mutually exclusive rescue/tragedy conclusions. Secret doors may have `hidden:true`; until discovered, the ordinary map and travel suggestions do not reveal the secret destination.

There is no database migration or session reset. Optional fields default to empty for older stories and saved games. Story resource quantities are still tracked in natural-language facts and checked semantically, not a general numerical survival simulator. `tests/fiction-imported-stories.test.mjs` covers identity knowledge boundaries, event rollback, rescue exclusion, companion reach, locks, fuel/vaccine prerequisites, and author/permission presentation.


## v10 完整候选：通信、阶段停点与复核差量

相邻开放通路的 NPC 对话可使用 `communicate`，保持玩家原位，仅修改 NPC 的交谈/知情事实；不能传送、搬物、修复或改变完整性。无线电仍需要随身终端与原剧本条件。纯通信可取得的剧情标记由剧本在 milestone 中显式声明 `communication: true`（当前包括图书馆调查与钢铁猎犬协议），同时仍检查原有地点、前提与证据。该声明属于静态剧本规则，不增加玩家存档字段。

同房准备与取放可合并；跨房移动和抵达后的操作仍分别结算。确有必要分段时保留已执行前缀、用 pendingDecision 保存剩余授权，复核接受合理阶段停点，不以“未一口气做完”拒绝整轮。执行满六步且末步 partial / decision.needed 时，程序向复核补充 stage_boundary，明确合理技术分段属于不重复确认原则的有限例外；不接受越权或漏掉前缀必要操作。已暂停时提供对应的继续/取消按钮。通信可达不代表 NPC 必然愿意回答；空间硬约束和语义复核各负其责。

正式主持的输出 Schema 同步限制步数、数组长度和合法地点 ID，减少已知格式错误；不能给共享字符串 schema 对象直接加枚举，否则会污染其他叙述字段。相关回归测试见 `tests/fiction-candidate.test.mjs`。

正式冒险复核采用 `world_delta_v1`，详见 `docs/ai-fiction-context.md`。地图公开名称来自已访问地点、叙述与实际观察，玩家猜测不计为发现；隐藏出口未揭露前不进入 publicNavigation。关键独立携带物须有独立实体或已有实体位置更新，不能仅藏在来源物件的 facts 描述中。并非自动扫描旧正文生成物品，旧存档不会凭空补发或复制钥匙。

断线恢复使用原 requestId 与已有回执表，无数据库迁移；查询凭当前会话 Cookie 授权。未确认行动保存在本机 localStorage，完成后清除，隐私模式不可用时仍保留内存恢复。详细回退与隔离策略见 `docs/ai-fiction-release.md`。
