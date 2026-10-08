# Anime Bid Battle — Design Spec

Date: 2026-10-08

## 1. Overview

A realtime multiplayer web game. A player creates a room and friends join with a room code. Anime characters are auctioned one per round; each has a power value. After all rounds, each player's team power is totalled and the highest total wins.

**Success criteria (v1):** 2–8 players can create/join a room, play a full auction through to a winner, survive a page refresh without losing their seat, and the game is deployable on free hosting.

## 2. Decisions

| Topic | Decision |
|---|---|
| Auction mode | Open ascending auction with anti-sniping timer (first mode; pluggable for others, e.g. sealed bid) |
| Economy | Fixed starting budget per player, no cap on team size |
| Winner | Highest total team power |
| Character data | Hand-curated `data/characters.json`, placeholder power values; power computed in one function so it can change later |
| Stack | Node.js + TypeScript, Express, Socket.IO, Next.js frontend |
| State | In-memory behind a `RoomStore` interface |
| Identity | Nickname + rejoin token (localStorage); no accounts |
| Room control | Host configures settings in lobby; backend validates bounds |
| Deploy | Frontend on Vercel; backend on a free host that runs a long-lived Node process (Render/Railway/Fly.io — verify current free terms). Two services |

## 3. Repo layout

```
AnimeBidBattle/
  packages/shared/     types + socket event contracts + zod schemas
  apps/frontend/       Next.js UI, no game logic
  apps/backend/        Express + Socket.IO, all game logic
  data/characters.json
```

npm workspaces monorepo.

### Backend modules
- `rooms/` — create rooms, room code generation, players, rejoin tokens. Backed by `RoomStore` interface (in-memory impl).
- `game/` — pure state machine; no socket code; unit-testable.
- `auction/` — `AuctionMode` interface; `OpenAscendingAuction` is the first implementation, chosen by `settings.auctionMode`.
- `characters/` — `CharacterSource` interface (JSON impl) and a single `computePower()` function.
- `transport/` — Socket.IO handlers: validate input, call `game/`, broadcast result.

Clients send intents; the backend validates and broadcasts new state. Nothing a client claims is trusted.

## 4. Room and game state machine

**Room data:** `code` (5 chars, unique among live rooms), `hostId`, `settings` (max players 2–8, starting coins, number of rounds, round timer, `auctionMode` default `"open-ascending"`; all bounded min/max by the backend), `players[]` (`id`, `nickname`, `rejoinToken`, `coins`, `team[]`, connection status), `phase`.

**Phases:** `LOBBY → AUCTION → BATTLE → RESULTS` (and `RESULTS → LOBBY` on play again).
- `LOBBY`: players join, host edits settings, host starts with ≥2 players.
- `AUCTION`: one round per character, randomly drawn without repeats. Number of rounds = number of characters auctioned. Each round has sub-states `OPEN`, `CLOSING`, `SOLD`.
- `BATTLE`: compute each player's total team power via `computePower()`.
- `RESULTS`: ranking; host can play again.

**Rules:**
- Transitions only in order; commands in the wrong phase are rejected.
- A round with no bids ends unsold with no winner.
- A disconnected player keeps their seat; if they are not participating they do not block the round.
- If the host disconnects, host rights move to the next online player.
- A player with 0 coins stays in the game but cannot bid.
- Empty rooms are deleted after a timeout.

## 5. Auction: open ascending with anti-sniping

**`AuctionMode` interface:**
- `start(character, players, settings)` — initial round state
- `placeBid(state, playerId, amount)` — new state or rejection reason
- `onTimerExpired(state)` — resolve the winner
- `getPublicView(state, playerId)` — what a given client may see (lets future modes hide bids)

**`open-ascending` rules:**
- Starting price 1 coin (code constant, not a host setting).
- A bid must exceed the current price by ≥1 and not exceed the bidder's coins.
- The current leader cannot outbid themselves.
- Each accepted bid resets the timer: if under 5 seconds remain, extend to 5 seconds; otherwise unchanged. The 5 s is a code constant.
- On expiry the leader wins, pays the price, and receives the character.
- If nobody bids, the character goes unsold.

**Concurrency:** Node processes events one at a time; the first bid to arrive is accepted and later bids at an equal or lower price are rejected. Only the backend clock decides expiry; `endsAt` is sent to clients for display only. One timer per round, cleared and re-set on each accepted bid and cleared when the room is deleted.

## 6. Socket protocol (defined in `packages/shared`)

Client → server:
- `room:create` (nickname, settings) → `roomCode`, `rejoinToken`
- `room:join` (roomCode, nickname) → `rejoinToken`
- `room:rejoin` (roomCode, rejoinToken)
- `room:updateSettings` (host only, `LOBBY` only)
- `game:start` (host only)
- `auction:bid` (amount)
- `game:playAgain` (host only)

Server → client:
- `room:state` — full room state (via `getPublicView`), sent on every change
- `error` — `{ code, message }`, e.g. `BID_TOO_LOW`, `NOT_HOST`, `ROOM_FULL`, `WRONG_PHASE`

Full-state broadcast is chosen over fine-grained events: rooms are small (≤8), it keeps code simple, and reconnecting clients get the latest picture immediately. Every incoming message is schema-validated (zod) on the backend.

## 7. Frontend

- `/` — create a room or enter a room code.
- `/room/[code]` — one page rendering by `phase` (Lobby, Auction, Battle, Results).
- A `useRoom()` hook owns the socket, holds the latest `room:state`, stores `rejoinToken` in localStorage, and auto-rejoins on refresh.
- No game logic in the frontend; display and intents only.
- Countdown computed from `endsAt`, compensating for client/server clock skew.
- Socket URL from `NEXT_PUBLIC_SOCKET_URL`; backend CORS allows the Vercel origin.

## 8. Testing

- Unit tests for `game/` and `auction/` without sockets: bid ordering, anti-sniping, coin payment, winner computation.
- Backend integration tests with real socket clients playing from room creation to finish.
- No frontend E2E in v1.

## 9. Known limitations

Free hosts may sleep idle services (slow first visit) and in-memory rooms are lost on restart. Acceptable for a short party game; `RoomStore` allows swapping in Redis later.

## 10. Out of scope (v1)

Accounts, database, chat, other auction modes, anime API for characters, real power formula, multi-language UI.
