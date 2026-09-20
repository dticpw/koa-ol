# Authored AI adventures

The fiction shelf is `/games/fiction/`. Each adventure has an introduction, a play page, a credits page, and an explicitly spoiler-marked downloadable `scenario.json`.

## Source layout

- `functions/_lib/adventures/stories.js`: authored maps, ordinary entity properties, NPC motives, secret truths, milestones, ending conditions and attribution.
- `functions/_lib/adventures/engine.js`: state, map/resource checks, pending decisions, milestone prerequisites and the public view.
- `functions/_lib/adventures/host.js`: structured ruling schema, host instructions and consistency/narration review.
- `functions/_lib/fiction-turn.js`: shared bounded adjudication/review flow. The existing tomb lab retains its own engine and prompts.
- `functions/api/adventures/[story].js` and `[story]/archives.js`: per-story API and named snapshots. Unknown stories return 404.
- `scripts/build-adventure-pages.mjs`: regenerates the three introductions, play pages, credits and public source packages from the authored stories, and updates their shelf cards.
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

Adventure text adaptations are CC BY-SA 4.0. Each credits page names the author, links the original and license, and describes changes. Original artwork is not reused. New covers use GPT Image 2; final compressed assets are in `games/fiction/assets/`. These are bounded single-player narrative adaptations, not implementations of the original multiplayer combat systems.

## Verification

Run `node --test tests/fiction*.test.mjs` with a Node release supporting `node:sqlite`. Build Cloudflare Pages Functions with `wrangler pages functions build functions --outfile <artifact-path>`.

The first-batch real-model validation reached a library exit after a voluntary memory exchange and thief negotiation, a research-evidence withdrawal from the spaceship, and the pirate ship's departure followed by a report in town. It also exercised an early retreat from the cave. These samples validate selected routes, not every possible branch or an entire novel-length campaign. During validation, the missing consent evidence in review, remote radio interaction and incomplete cargo-unloading guards were corrected. Semantic identity disclosure and multi-step reach errors remain important regression targets.

## Retired stories and live updates

The classic serpent-tomb story is retired: its shelf card is removed, former introduction/play URLs show a retirement notice, and `/api/fiction` rejects fresh starts or resets with `410 game_retired`. Existing session reads and turns remain accepted so already-open play pages are not forcibly interrupted. The `games/lantern-tomb/` scripts, styles and credited assets also serve active stories and must not be deleted as if they were exclusive to the retired title.

Adding a distinct story does not recreate existing D1 sessions. A visitor's loaded document remains until navigation/reload; later API calls use the current deployment. Sessions currently do not pin an immutable story/rules version, so changes to shared logic or an existing story's authored configuration require backward compatibility. The daily model-spend budget is shared across stories.
