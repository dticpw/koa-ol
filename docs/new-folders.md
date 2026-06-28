# New Folder Notes

This document records the purpose of folders newly added for the card-game work.

## `games/`

`games/` is the public static entry for private card-game rooms under the existing Cloudflare Pages site.

Current route:

```text
https://koa-ol.com/games/
```

Current files intended for upload:

```text
games/index.html
games/style.css
games/app.js
```

Responsibilities:

- Render the Games lobby page.
- Let visitors enter a display name.
- Let visitors choose Blackjack or Texas Hold'em.
- Generate a temporary room code.
- Join an existing room code.
- Produce invite links such as `https://koa-ol.com/games/?room=ABC123&game=blackjack`.
- Preserve lightweight lobby state in browser `localStorage`.

Not responsible yet:

- Real-time multiplayer synchronization.
- Server-authoritative room state.
- Card dealing or game settlement.
- WebSocket connection management.
- Durable Object deployment configuration.

Local planning documents may also live under `games/`, but they are excluded from Git by `.git/info/exclude`:

```text
games/games-phase-1-project-plan.md
games/games-subpage-durable-object-plan.md
```

These files are for local implementation planning and should not be uploaded by default.

## `docs/`

`docs/` is for stable repository-facing notes that are safe to keep with the project source.

For the game work, `docs/` should only contain high-level folder/function notes, not active phase plans or deployment drafts. Active planning files belong under `games/` and are locally ignored unless explicitly added later.
