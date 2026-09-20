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
