# AnimeBidBattle

A realtime multiplayer web game. Create a room, share the 5-letter code, and bid against your friends on anime characters in open ascending auctions (a late bid extends the timer to 5 seconds). When every round is done, the team with the highest total power wins.

## Repo layout

| Path | Purpose |
|---|---|
| `packages/shared` | Types, zod schemas and the socket event contract used by both apps |
| `apps/backend` | Express + Socket.IO game server; all game logic lives here |
| `apps/frontend` | Next.js UI; renders the state it receives and sends intents |
| `data/characters.json` | Characters and their (placeholder) power values |

Design: `docs/superpowers/specs/2026-10-08-anime-bid-battle-design.md`.

## Local development

```bash
npm install
cp apps/frontend/.env.example apps/frontend/.env.local
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:3000
```

Open two browser windows to play against yourself.

## Tests

```bash
npm test            # unit + socket integration tests
npm run typecheck
```

## Hidden power

Players are not told how strong a character is. The backend never sends a character's `power` to clients during the lobby or the auction; it is revealed for everyone at the Battle phase (`apps/backend/src/game/view.ts`).

## Character images

Images are static files at `apps/frontend/public/characters/<id>.jpg` (named by character id from `data/characters.json`). A missing file shows a placeholder card. To (re)fetch them from AniList:

```bash
node scripts/fetch-character-images.mjs              # dry-run: prints what would be downloaded
node scripts/fetch-character-images.mjs --download   # saves the images and SOURCES.md
```

Character artwork belongs to its respective rights holders; this is a non-commercial game for friends.

## Deployment (two services)

The game server needs a long-lived Node process for WebSockets and in-memory rooms, so it cannot run on Vercel's serverless functions. Deploy:

- **Frontend → Vercel.** Import the repo, set the project *Root Directory* to `apps/frontend`, and set `NEXT_PUBLIC_SOCKET_URL` to the backend's public URL (e.g. `https://abb-backend.example.com`).
- **Backend → any host that runs a Node process** (Render, Railway, Fly.io, … — check their current free-tier terms).
  - Install: `npm install`
  - Start: `npm run start -w @abb/backend`
  - Env: `CORS_ORIGIN` = your Vercel URL (comma-separate multiple origins); must list exact origins (scheme + host, no trailing slash, e.g. `https://my-app.vercel.app`); `*` is not supported as a wildcard. `PORT` is normally provided by the host.
  - Health check: `GET /health`

Free hosts often sleep idle services (the first visit is slow) and rooms live in memory, so a restart ends active games. `RoomStore` is an interface so Redis can replace it later.

## Extending

- **New auction mode:** implement `AuctionMode` (`apps/backend/src/auction/types.ts`), register it in `createAuctionModes()`, and add its name to `AUCTION_MODE_NAMES` in `packages/shared`.
- **New power formula:** change `computePower()` in `apps/backend/src/characters/power.ts`.
- **New character source:** implement `CharacterSource` and pass its characters to `createApp()`.
