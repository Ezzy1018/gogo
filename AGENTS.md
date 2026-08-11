# Working on Gathera with an AI coding tool

This file is the project's memory. Cursor, Claude Code and similar tools read it
automatically. Keep it accurate and they will stop breaking things.

## Current phase

V2 complete. Everything in the plan is built. Next up would be screen sharing,
sit and sleep sprite frames, and an in-app map editor.

## Read before you touch anything

1. `README.md` section 6 for the layout and the one architectural rule.
2. `src/shared/config.ts`. Every tuning number lives there. Never hardcode one.
3. `src/styles/tokens.css`. Every colour lives there. Never write a raw hex.

## Rules that must not be broken

- **React and Phaser talk only through `src/game/bridge.ts`.** No exceptions.
  Phaser runs at 60fps and must never trigger a React render directly.
- **A visual change never touches `src/media`, `src/net` or `party/server.ts`.**
  If a visual ticket seems to need it, stop and say so.
- **Colours come from `tokens.css`.** No pure black, no pure white, no cool grey,
  no `backdrop-filter`.
- **Outlines in art are warm dark brown `#3A211D`,** never black.
- `pixelArt: true`, `roundPixels: true` and `antialias: false` in
  `src/game/PhaserGame.tsx` are load bearing. Removing any one makes the art mush.
- Art is generated. Edit `tools/*.py` and run `npm run art`. Do not hand edit
  files in `public/assets`.

## The loop

1. One ticket per chat session. Start a fresh session for the next one.
2. `npm run typecheck` after every change.
3. Test it in the browser in under 60 seconds. Two windows, one incognito.
4. Commit immediately when it works: `git add -A; git commit -m "..."`.
5. If it does not work, paste the actual console error, not a description.
6. Three failed fixes in a row means revert: `git reset --hard HEAD`.

## Prompt preamble to paste at the start of a visual ticket

```
Read AGENTS.md and src/styles/tokens.css before doing anything.
Colours come from tokens.css. Tuning numbers come from src/shared/config.ts.
Never invent a value. If you need something that is not there, stop and ask.

This is a visual change only. Do not touch src/media, src/net or
party/server.ts. If the change requires touching them, stop and tell me.
```

## Where things live

| I want to change | File |
| --- | --- |
| How far away you can hear someone | `src/shared/config.ts` |
| Who connects to whom | `src/media/proximity.ts` |
| Video tile sizing | `src/media/proximity.ts` and `src/ui/VideoTiles.tsx` |
| The floor plan and zones | `tools/generate_map.py` |
| Character art | `tools/generate_chars.py` |
| Furniture and tiles | `tools/generate_art.py` |
| Any colour anywhere | `tools/palette.py` (art) or `src/styles/tokens.css` (UI) |
| Movement, camera, lighting | `src/game/MainScene.ts` |
| Presence, chat, host powers | `party/server.ts` |
