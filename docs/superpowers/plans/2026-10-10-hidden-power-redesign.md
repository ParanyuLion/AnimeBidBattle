# Hidden Power and Dark Skeuomorphic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide every character's power from clients until the Battle phase, add real character images, and restyle all five screens as a dark neon skeuomorphic bidding console that works well on phones.

**Architecture:** The backend keeps `Character.power` internally and redacts it in the single view-building function (`getRoomView`) unless the phase is `BATTLE` or `RESULTS`; the shared contract gains `CharacterView` with an optional `power`. Images are static files named by character id, fetched once by a script and served from the Next.js `public/` folder. The frontend gets a CSS design system (tokens plus `.panel`/`.key`/`.readout`/`.led` classes) and three small components, then each screen is rewritten on top of them without moving any game logic into the frontend.

**Tech Stack:** TypeScript, Express + Socket.IO (unchanged), Next.js App Router, plain CSS, `next/font/google` (Orbitron, Inter, Noto Sans Thai), vitest, Node `fetch` for the image script.

**Spec:** `docs/superpowers/specs/2026-10-10-hidden-power-redesign-design.md` (amends `docs/superpowers/specs/2026-10-08-anime-bid-battle-design.md`)

## Global Constraints

- No `power` value may appear in any `room:state` payload during `LOBBY` or `AUCTION`; `power` is included only in `BATTLE` and `RESULTS`. `results` is `null` unless revealed.
- `getRoomView` is the single redaction point and runs last; character views are rebuilt by an explicit field list, never an object spread.
- `CharacterView = { id: string; name: string; anime: string; power?: number }`. `Character` (with `power: number`) and `data/characters.json` are unchanged.
- Images live at `apps/frontend/public/characters/<id>.jpg`, named by character id; no change to `data/characters.json` or the `Character` type. A missing or failing image shows a styled placeholder.
- The image script defaults to dry-run (prints a manifest, downloads nothing); `--download` runs only after the user explicitly confirms the manifest. The GitHub repo is public and the user has been told committing the images may invite a takedown request.
- Visual direction: neon cyber arena, skeuomorphic hardware console. Palette: base `#0a0a14`, metals `#1b1c28` / `#2a2c3a`, neon violet and cyan, hot pink for warnings, gold for winners.
- Mobile-first: single column, sticky bottom bid dock, touch targets at least 44 px, animations respect `prefers-reduced-motion`.
- Fonts via `next/font/google` with a Thai-capable fallback so Thai nicknames render.
- No new frontend dependencies, no UI library. No game logic moves into the frontend. Existing behaviours stay (lobby draft/dirty logic, rejoin, error banner, countdown from `endsAt`).
- Existing tests (74 at the start of this work) must keep passing; `npm run typecheck` must pass for all workspaces.
- Out of scope: sound, a second theme, rarity or tier styling derived from power, strength hints, an image uploader, auction rule changes.

## Review Focus

1. A power value leaking into any pre-Battle `room:state` (including the sold-round state, other players' teams, and a stale `results`) → Task 1 unit and integration tests assert no `"power"` and no power numbers in those payloads.
2. A missing or failing character image → the card shows a placeholder with initials, never a broken-image icon → Task 4 pins `initialsOf` and `characterImageUrl` with unit tests; Task 8 checks the fallback in the browser.
3. A 20-character or Thai nickname, or a very long anime title, breaking layout on a ~360 px phone → Task 8 checks no horizontal overflow; CSS uses `min-width: 0` and `overflow-wrap: anywhere`.
4. A Battle/Results card whose `power` is unexpectedly missing, or a player who won nothing (empty team, total 0) → Tasks 4 and 7 render `???` / "No characters" instead of `undefined`/blank.
5. Users who set "reduce motion", and screens at 320–360 px width → Task 4 CSS has a `prefers-reduced-motion` block and Task 8 checks scroll width at 360 and 320.

---

### Task 1: Hide power on the server (shared contract, view redaction, tests)

**Files:**
- Modify: `packages/shared/src/types.ts` (add `CharacterView`; use it in `PlayerView.team` and `AuctionBidView.character`)
- Modify: `apps/backend/src/game/view.ts` (redaction)
- Create: `apps/backend/src/game/view.test.ts`
- Create: `apps/backend/src/hiddenPower.integration.test.ts`
- Modify: `apps/frontend/src/components/Auction.tsx` (remove the two places that render power)
- Modify: `apps/frontend/src/components/Results.tsx` (guard the optional power)

**Interfaces:**
- Consumes: existing `getRoomView(room, viewerId, modes, now): RoomView`; game functions from `apps/backend/src/game/game.ts` (`createRoom`, `makePlayer`, `addPlayer`, `startGame`, `placeBid`, `resolveRound`, `advanceRound`, `showResults`); `createApp` from `apps/backend/src/app.ts`.
- Produces: `CharacterView` exported from `@abb/shared`; `RoomView` whose `PlayerView.team` and `AuctionBidView.character` are `CharacterView`, with `power` present only when `phase` is `BATTLE` or `RESULTS`.

- [ ] **Step 1: Write the failing unit test**

`apps/backend/src/game/view.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Character, type RoomSettings } from '@abb/shared';
import { createAuctionModes } from '../auction';
import {
  addPlayer,
  advanceRound,
  createRoom,
  makePlayer,
  placeBid,
  resolveRound,
  showResults,
  startGame,
} from './game';
import { getRoomView } from './view';

const modes = createAuctionModes();
const characters: Character[] = [
  { id: 'a', name: 'Alpha', anime: 'X', power: 11111 },
  { id: 'b', name: 'Beta', anime: 'X', power: 22222 },
  { id: 'c', name: 'Gamma', anime: 'X', power: 33333 },
];
const settings: RoomSettings = {
  ...DEFAULT_SETTINGS,
  maxPlayers: 3,
  startingCoins: 100,
  rounds: 2,
  roundSeconds: 10,
};
// random() just below 1 keeps the original order => deck = [a, b]
const keepOrder = () => 0.999999;
const POWERS = ['11111', '22222', '33333'];

function lobby() {
  const alice = makePlayer('p1', 'Alice', 't1');
  const bob = makePlayer('p2', 'Bob', 't2');
  const room = createRoom('ABCDE', alice, settings);
  addPlayer(room, bob);
  return room;
}

/** Starts a game; alice wins round 1 (character a), bob wins round 2 (character b). */
function inRound1() {
  const room = lobby();
  startGame(room, 'p1', characters, modes, keepOrder, 0);
  return room;
}

function expectNoPower(room: ReturnType<typeof lobby>) {
  for (const viewer of ['p1', 'p2']) {
    const view = getRoomView(room, viewer, modes, 0);
    const json = JSON.stringify(view);
    expect(json).not.toContain('"power"');
    for (const power of POWERS) expect(json).not.toContain(power);
    expect(view.results).toBeNull();
  }
}

describe('getRoomView power redaction', () => {
  it('has no power in the lobby', () => {
    expectNoPower(lobby());
  });

  it('has no power while a round is open', () => {
    const room = inRound1();
    expect(room.auction?.character.power).toBe(11111); // server still holds it
    expectNoPower(room);
  });

  it('has no power in the sold-round state or in anyone\'s team before Battle', () => {
    const room = inRound1();
    placeBid(room, 'p1', 30, modes, 100);
    resolveRound(room, modes);
    expect(room.auction?.status).toBe('SOLD');
    expectNoPower(room); // alice now owns character a
    const view = getRoomView(room, 'p2', modes, 0);
    expect(view.players.find((p) => p.id === 'p1')?.team).toEqual([
      { id: 'a', name: 'Alpha', anime: 'X' },
    ]);
    advanceRound(room, modes, 5000);
    expectNoPower(room); // round 2 open, alice's team still hidden
  });

  it('hides a stale results value that was set before Battle', () => {
    const room = inRound1();
    room.results = [{ playerId: 'p1', nickname: 'Alice', totalPower: 11111, rank: 1 }];
    const view = getRoomView(room, 'p1', modes, 0);
    expect(view.results).toBeNull();
    expect(JSON.stringify(view)).not.toContain('11111');
  });

  it('reveals power for every team and the results in BATTLE and RESULTS', () => {
    const room = inRound1();
    placeBid(room, 'p1', 30, modes, 100);
    resolveRound(room, modes);
    advanceRound(room, modes, 5000);
    placeBid(room, 'p2', 10, modes, 5100);
    resolveRound(room, modes);
    expect(advanceRound(room, modes, 20000)).toBe('BATTLE');

    for (const phase of ['BATTLE', 'RESULTS'] as const) {
      if (phase === 'RESULTS') showResults(room);
      expect(room.phase).toBe(phase);
      const view = getRoomView(room, 'p1', modes, 0);
      const alice = view.players.find((p) => p.id === 'p1');
      const bob = view.players.find((p) => p.id === 'p2');
      expect(alice?.team).toEqual([{ id: 'a', name: 'Alpha', anime: 'X', power: 11111 }]);
      expect(bob?.team).toEqual([{ id: 'b', name: 'Beta', anime: 'X', power: 22222 }]);
      expect(view.results?.[0]).toMatchObject({ playerId: 'p2', totalPower: 22222, rank: 1 });
      expect(view.auction).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/backend/src/game/view.test.ts`
Expected: FAIL — the "round is open" and "sold-round" tests report that the JSON contains `"power"`.

- [ ] **Step 3: Add `CharacterView` to the shared types**

In `packages/shared/src/types.ts`, add this block directly after the `Character` interface:
```ts
/** A character as clients see it. `power` is present only once the Battle phase has started. */
export interface CharacterView {
  id: string;
  name: string;
  anime: string;
  power?: number;
}
```
Change `PlayerView.team` from `Character[]` to `CharacterView[]`, and `AuctionBidView.character` from `Character` to `CharacterView`. Leave `Character` as is (server-internal).

- [ ] **Step 4: Rewrite the view with redaction**

Replace the whole of `apps/backend/src/game/view.ts` with:
```ts
import type { CharacterView, RoomView } from '@abb/shared';
import type { AuctionModeRegistry } from '../auction';
import type { Room } from './types';

/** Rebuilds a character field by field so nothing extra (like `power`) can slip through. */
function toCharacterView(character: CharacterView, revealed: boolean): CharacterView {
  const view: CharacterView = { id: character.id, name: character.name, anime: character.anime };
  if (revealed && character.power !== undefined) view.power = character.power;
  return view;
}

export function getRoomView(
  room: Room,
  viewerId: string,
  modes: AuctionModeRegistry,
  now: number,
): RoomView {
  const mode = modes[room.settings.auctionMode];
  // Players must guess how strong a character is: power is only revealed for the Battle.
  const revealed = room.phase === 'BATTLE' || room.phase === 'RESULTS';
  const auction = room.auction ? mode.getPublicView(room.auction, viewerId) : null;
  return {
    code: room.code,
    phase: room.phase,
    settings: room.settings,
    hostId: room.hostId,
    youId: viewerId,
    serverNow: now,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      coins: p.coins,
      team: p.team.map((character) => toCharacterView(character, revealed)),
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
    auction: auction
      ? {
          character: toCharacterView(auction.character, revealed),
          price: auction.price,
          leaderId: auction.leaderId,
          endsAt: auction.endsAt,
          status: auction.status,
          roundIndex: room.roundIndex,
          totalRounds: room.deck.length,
        }
      : null,
    results: revealed ? room.results : null,
  };
}
```

- [ ] **Step 5: Run the unit test, then typecheck**

Run: `npx vitest run apps/backend/src/game/view.test.ts`
Expected: PASS (5 tests).

Run: `npm run typecheck`
Expected: exit code 0 for every workspace. (The frontend still compiles because `power` is now `number | undefined`.)

- [ ] **Step 6: Keep the frontend coherent (it must not show an empty power)**

Edit `apps/frontend/src/components/Auction.tsx`: delete the line `<div className="power">Power {auction.character.power}</div>` and, in the "Your team" list, change
`<span className="muted">{character.power}</span>` to `<span className="muted">?</span>`.

Edit `apps/frontend/src/components/Results.tsx`: replace `(${c.power})` with `(${c.power ?? '?'})`.

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 7: Write the failing integration test**

`apps/backend/src/hiddenPower.integration.test.ts`:
```ts
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connectClient, type Socket } from 'socket.io-client';
import {
  SETTINGS_BOUNDS,
  type Ack,
  type Character,
  type ClientToServerEvents,
  type JoinResult,
  type RoomView,
  type ServerToClientEvents,
} from '@abb/shared';
import { OpenAscendingAuction } from './auction';
import { createApp } from './app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const characters: Character[] = [
  { id: 'a', name: 'Alpha', anime: 'X', power: 11111 },
  { id: 'b', name: 'Beta', anime: 'X', power: 22222 },
];
const roomSettings = {
  maxPlayers: 4,
  startingCoins: 1000,
  rounds: 2,
  roundSeconds: 2,
  auctionMode: 'open-ascending' as const,
};

let app: ReturnType<typeof createApp>;
let port: number;
let open: Client[];

beforeEach(async () => {
  app = createApp({
    characters,
    corsOrigins: ['http://localhost:3000'],
    bounds: { ...SETTINGS_BOUNDS, roundSeconds: { min: 1, max: 60 } },
    auctionModes: { 'open-ascending': new OpenAscendingAuction(100) },
    soldPauseMs: 50,
    battlePauseMs: 50,
    emptyRoomTtlMs: 60_000,
    hostGraceMs: 100,
  });
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  port = (app.httpServer.address() as AddressInfo).port;
  open = [];
});

afterEach(async () => {
  for (const client of open) client.disconnect();
  await app.close();
});

/** Records every room:state payload exactly as it was received. */
function track(client: Client) {
  const log: RoomView[] = [];
  const listeners = new Set<() => void>();
  client.on('room:state', (state) => {
    log.push(state);
    for (const listener of [...listeners]) listener();
  });
  return {
    log,
    until(predicate: (s: RoomView) => boolean, timeoutMs = 12000): Promise<RoomView> {
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          listeners.delete(check);
        };
        const check = () => {
          const latest = log[log.length - 1];
          if (latest && predicate(latest)) {
            cleanup();
            resolve(latest);
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('timed out waiting for room state'));
        }, timeoutMs);
        listeners.add(check);
        check();
      });
    },
  };
}

async function connect() {
  const client: Client = connectClient(`http://localhost:${port}`, { transports: ['websocket'] });
  open.push(client);
  const states = track(client);
  await new Promise<void>((resolve) => client.on('connect', resolve));
  return { client, states };
}

function call<R = Ack>(client: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<R> {
  return new Promise((resolve) => {
    (client as unknown as { emit: (...args: unknown[]) => void }).emit(event, payload, resolve);
  });
}

describe('hidden power over real sockets', () => {
  it('never sends power before the Battle phase and reveals it for Battle and Results', async () => {
    const alice = await connect();
    const bob = await connect();
    const created = await call<Ack<JoinResult>>(alice.client, 'room:create', {
      nickname: 'Alice',
      settings: roomSettings,
    });
    if (!created.ok) throw new Error('create failed');
    const joined = await call<Ack<JoinResult>>(bob.client, 'room:join', {
      roomCode: created.roomCode,
      nickname: 'Bob',
    });
    if (!joined.ok) throw new Error('join failed');

    expect((await call(alice.client, 'game:start', {})).ok).toBe(true);
    for (let round = 0; round < 2; round++) {
      await alice.states.until(
        (s) => s.phase === 'AUCTION' && s.auction?.roundIndex === round && s.auction.status === 'OPEN',
      );
      expect((await call(alice.client, 'auction:bid', { amount: 100 })).ok).toBe(true);
      await alice.states.until(
        (s) => s.phase !== 'AUCTION' || (s.auction?.roundIndex === round && s.auction.status === 'SOLD'),
      );
    }
    await alice.states.until((s) => s.phase === 'RESULTS');
    await bob.states.until((s) => s.phase === 'RESULTS');

    for (const side of [alice, bob]) {
      const hidden = side.states.log.filter((s) => s.phase === 'LOBBY' || s.phase === 'AUCTION');
      expect(hidden.length).toBeGreaterThan(0);
      for (const state of hidden) {
        expect(JSON.stringify(state)).not.toContain('"power"');
        // every character the client can see has exactly these fields, nothing more
        const visible = [
          ...(state.auction ? [state.auction.character] : []),
          ...state.players.flatMap((p) => p.team),
        ];
        for (const character of visible) {
          expect(Object.keys(character).sort()).toEqual(['anime', 'id', 'name']);
        }
        expect(state.results).toBeNull();
      }

      const revealed = side.states.log.filter((s) => s.phase === 'BATTLE' || s.phase === 'RESULTS');
      expect(revealed.length).toBeGreaterThan(0);
      for (const state of revealed) {
        const team = state.players.find((p) => p.id === created.playerId)?.team ?? [];
        expect(team).toHaveLength(2);
        expect(team.every((c) => typeof c.power === 'number')).toBe(true);
        expect(state.results?.[0]).toMatchObject({ playerId: created.playerId, totalPower: 33333, rank: 1 });
      }
    }
  }, 30000);
});
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: PASS for every file, including the new `view.test.ts` (5 tests) and `hiddenPower.integration.test.ts` (1 test) alongside the existing 74 (80 total). Output has no stray errors.

- [ ] **Step 9: Run the integration test twice more for flakiness**

Run: `npx vitest run apps/backend/src/hiddenPower.integration.test.ts` (twice)
Expected: PASS both times.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/types.ts apps/backend/src/game/view.ts apps/backend/src/game/view.test.ts apps/backend/src/hiddenPower.integration.test.ts apps/frontend/src/components/Auction.tsx apps/frontend/src/components/Results.tsx
git commit -m "feat: hide character power from clients until the Battle phase"
```

---

### Task 2: Character image script (dry-run by default)

**Files:**
- Create: `scripts/fetch-character-images.mjs`
- Create: `scripts/fetch-character-images.test.ts`
- Modify: `vitest.config.ts` (include `scripts/**/*.test.ts`)

**Interfaces:**
- Consumes: `data/characters.json` entries `{ id, name, anime, power }`; AniList public GraphQL endpoint `https://graphql.anilist.co`.
- Produces (exported from the `.mjs`, used by its test): `normalize(text)`, `nameScore(wanted, candidateNames)`, `animeMatches(wantedAnime, mediaNodes)`, `pickMatch(character, candidates)` → `{ candidate, confidence: 'exact' | 'review' } | null`. CLI: `node scripts/fetch-character-images.mjs` (dry-run, prints a manifest, downloads nothing) and `--download` (saves `apps/frontend/public/characters/<id>.jpg` and writes `SOURCES.md`).

- [ ] **Step 1: Include the scripts folder in the test run**

In `vitest.config.ts`, replace the `include` array with:
```ts
    include: [
      'packages/**/*.test.ts',
      'apps/backend/**/*.test.ts',
      'apps/frontend/src/lib/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
```
(`apps/frontend/src/lib` is added now because Task 4 adds a pure-TypeScript test there.)

- [ ] **Step 2: Write the failing test**

`scripts/fetch-character-images.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { animeMatches, nameScore, normalize, pickMatch } from './fetch-character-images.mjs';

describe('normalize', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalize('Monkey D. Luffy')).toBe('monkey d luffy');
    expect(normalize('  One Punch-Man ')).toBe('one punch man');
    expect(normalize('Éclair')).toBe('eclair');
  });
});

describe('nameScore', () => {
  it('scores exact names as 1', () => {
    expect(nameScore('Monkey D. Luffy', ['Monkey D. Luffy'])).toBe(1);
  });

  it('tolerates romanisation differences (Gojo / Gojou)', () => {
    expect(nameScore('Satoru Gojo', ['Satoru Gojou'])).toBe(1);
  });

  it('scores partial names lower and prefers the tighter candidate for a one-letter name', () => {
    expect(nameScore('Son Goku', ['Goku'])).toBe(0.5);
    expect(nameScore('L', ['L Lawliet'])).toBe(0.5);
    expect(nameScore('L', ['L Lawliet', 'L'])).toBe(1);
  });

  it('returns 0 for unrelated names and for empty input', () => {
    expect(nameScore('Naruto Uzumaki', ['Light Yagami'])).toBe(0);
    expect(nameScore('', ['Anything'])).toBe(0);
  });
});

describe('animeMatches', () => {
  it('matches when a title contains the anime name or the reverse', () => {
    expect(animeMatches('Demon Slayer', [{ title: { english: 'Demon Slayer: Kimetsu no Yaiba' } }])).toBe(true);
    expect(animeMatches('One Punch Man', [{ title: { romaji: 'One Punch-Man' } }])).toBe(true);
    expect(animeMatches('Attack on Titan', [{ title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan' } }])).toBe(true);
  });

  it('rejects other franchises and tolerates missing titles', () => {
    expect(animeMatches('Naruto', [{ title: { romaji: 'Bleach' } }])).toBe(false);
    expect(animeMatches('Naruto', [{ title: {} }, {}])).toBe(false);
    expect(animeMatches('Naruto', [])).toBe(false);
  });
});

const luffy = { id: 'monkey-d-luffy', name: 'Monkey D. Luffy', anime: 'One Piece', power: 90 };

function candidate(id: number, full: string, anime: string, image: string | null = 'https://example.test/x.jpg') {
  return {
    id,
    name: { full, alternative: [] as string[] },
    image: image ? { large: image } : { large: null },
    media: { nodes: [{ title: { romaji: anime, english: anime } }] },
  };
}

describe('pickMatch', () => {
  it('picks the candidate from the right anime and reports an exact match', () => {
    const picked = pickMatch(luffy, [
      candidate(1, 'Monkey D. Luffy', 'Some Parody'),
      candidate(2, 'Monkey D. Luffy', 'One Piece'),
    ]);
    expect(picked?.candidate.id).toBe(2);
    expect(picked?.confidence).toBe('exact');
  });

  it('marks a partial name match for review', () => {
    const picked = pickMatch({ ...luffy, name: 'Son Goku', anime: 'Dragon Ball' }, [candidate(7, 'Goku', 'Dragon Ball')]);
    expect(picked?.confidence).toBe('review');
  });

  it('returns null when nothing matches or the match has no image', () => {
    expect(pickMatch(luffy, [candidate(3, 'Light Yagami', 'Death Note')])).toBeNull();
    expect(pickMatch(luffy, [candidate(4, 'Monkey D. Luffy', 'One Piece', null)])).toBeNull();
    expect(pickMatch(luffy, [])).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run scripts`
Expected: FAIL — cannot resolve `./fetch-character-images.mjs`.

- [ ] **Step 4: Write the script**

`scripts/fetch-character-images.mjs`:
```js
#!/usr/bin/env node
// Finds an AniList image for every character in data/characters.json.
//   node scripts/fetch-character-images.mjs              dry-run: prints a manifest, downloads nothing
//   node scripts/fetch-character-images.mjs --download   saves apps/frontend/public/characters/<id>.jpg
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data', 'characters.json');
const OUT_DIR = path.join(ROOT, 'apps', 'frontend', 'public', 'characters');
const ENDPOINT = 'https://graphql.anilist.co';
const MIN_BYTES = 5 * 1024;
const REQUEST_GAP_MS = 1200;

const QUERY = `query ($search: String) {
  Page(perPage: 8) {
    characters(search: $search) {
      id
      name { full alternative }
      image { large }
      media(perPage: 8) { nodes { title { romaji english } } }
    }
  }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/** 0..1 — how well a candidate's names cover the wanted name (extra tokens lower the score). */
export function nameScore(wanted, candidateNames) {
  const wantedTokens = normalize(wanted).split(' ').filter(Boolean);
  if (wantedTokens.length === 0) return 0;
  let best = 0;
  for (const candidate of candidateNames) {
    const candidateTokens = normalize(candidate).split(' ').filter(Boolean);
    if (candidateTokens.length === 0) continue;
    const hits = wantedTokens.filter((w) => candidateTokens.some((c) => tokensMatch(w, c))).length;
    const score = hits / Math.max(wantedTokens.length, candidateTokens.length);
    if (score > best) best = score;
  }
  return best;
}

export function animeMatches(wantedAnime, mediaNodes) {
  const wanted = normalize(wantedAnime);
  return mediaNodes.some((node) =>
    [node?.title?.romaji, node?.title?.english].filter(Boolean).some((title) => {
      const normalized = normalize(title);
      return normalized.includes(wanted) || (normalized.length >= 4 && wanted.includes(normalized));
    }),
  );
}

/** Chooses the AniList candidate for a character, or null if none is trustworthy. */
export function pickMatch(character, candidates) {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      name: nameScore(character.name, [candidate.name?.full ?? '', ...(candidate.name?.alternative ?? [])]),
      anime: animeMatches(character.anime, candidate.media?.nodes ?? []),
    }))
    .filter((s) => s.anime && s.name >= 0.5 && s.candidate.image?.large)
    .sort((a, b) => b.name - a.name);
  if (scored.length === 0) return null;
  const best = scored[0];
  return { candidate: best.candidate, confidence: best.name === 1 ? 'exact' : 'review' };
}

async function searchAniList(search) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { search } }),
    });
    if (response.status === 429) {
      const waitSeconds = Number(response.headers.get('retry-after') ?? 60);
      console.error(`AniList rate limit hit; waiting ${waitSeconds}s`);
      await sleep(waitSeconds * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
    const json = await response.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data.Page.characters;
  }
  throw new Error('AniList rate limit did not clear');
}

async function downloadImage(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < MIN_BYTES) throw new Error(`suspiciously small (${bytes.length} bytes) for ${url}`);
  await writeFile(destination, bytes);
  return bytes.length;
}

function sourcesMarkdown(rows) {
  const lines = [
    '# Character image sources',
    '',
    'Images are fetched from the AniList public API (https://anilist.co) by `scripts/fetch-character-images.mjs`.',
    'Character artwork belongs to its respective rights holders; this project is a non-commercial game for friends.',
    '',
    '| File | Character | Anime | AniList character | Image URL |',
    '|---|---|---|---|---|',
  ];
  for (const row of rows) {
    if (row.url) {
      lines.push(`| ${row.id}.jpg | ${row.name} | ${row.anime} | https://anilist.co/character/${row.anilistId} | ${row.url} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const shouldDownload = process.argv.includes('--download');
  const characters = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const rows = [];

  for (const character of characters) {
    const destination = path.join(OUT_DIR, `${character.id}.jpg`);
    const row = { id: character.id, name: character.name, anime: character.anime, destination, exists: existsSync(destination) };
    try {
      const picked = pickMatch(character, await searchAniList(character.name));
      if (picked) {
        row.anilistId = picked.candidate.id;
        row.matchedName = picked.candidate.name.full;
        row.url = picked.candidate.image.large;
        row.confidence = picked.confidence;
      } else {
        row.problem = 'NO MATCH (a placeholder will be shown)';
      }
    } catch (error) {
      row.problem = `ERROR: ${error.message}`;
    }
    rows.push(row);
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`\nManifest (${shouldDownload ? 'download' : 'dry-run'}):\n`);
  for (const row of rows) {
    const state = row.problem ?? `${row.confidence} -> ${row.matchedName}`;
    console.log(`${row.id.padEnd(22)} ${state}${row.exists ? ' [file exists]' : ''}`);
    if (row.url) console.log(`${' '.repeat(22)} ${row.url}`);
  }
  const matched = rows.filter((r) => r.url);
  const review = matched.filter((r) => r.confidence === 'review');
  console.log(
    `\n${matched.length}/${rows.length} matched, ${review.length} need review, ${rows.length - matched.length} unmatched.`,
  );

  if (!shouldDownload) {
    console.log('Dry-run only: nothing was downloaded. Re-run with --download to save the images.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  let totalBytes = 0;
  for (const row of matched) {
    if (row.exists) continue;
    try {
      totalBytes += await downloadImage(row.url, row.destination);
    } catch (error) {
      row.problem = `DOWNLOAD FAILED: ${error.message}`;
      row.url = undefined;
      console.error(`${row.id}: ${row.problem}`);
    }
    await sleep(300);
  }
  await writeFile(path.join(OUT_DIR, 'SOURCES.md'), sourcesMarkdown(rows));
  console.log(`\nDownloaded ${(totalBytes / 1024 / 1024).toFixed(2)} MB into ${OUT_DIR}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts`
Expected: PASS (all tests in `fetch-character-images.test.ts`).

Run: `npx vitest run`
Expected: PASS for every file.

- [ ] **Step 6: Verify the script's CLI wiring without touching the network**

Run: `node -e "import('./scripts/fetch-character-images.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"`
Expected: prints `animeMatches,nameScore,normalize,pickMatch` and exits (importing must not start a download or search).

Do NOT run the script itself in this task; running it is Task 3.

- [ ] **Step 7: Commit**

```bash
git add scripts/fetch-character-images.mjs scripts/fetch-character-images.test.ts vitest.config.ts
git commit -m "feat: add AniList character image script (dry-run by default)"
```

---

### Task 3: Fetch the images (controller-run; needs the user's explicit confirmation)

**This task is executed by the controller (the session talking to the user), not by a subagent, because it downloads files and the user must confirm first.**

**Files:**
- Create: `apps/frontend/public/characters/*.jpg` (one per matched character), `apps/frontend/public/characters/SOURCES.md`
- Modify: `README.md` (document hidden power and the image script)

**Interfaces:**
- Consumes: `scripts/fetch-character-images.mjs` from Task 2.
- Produces: `apps/frontend/public/characters/<id>.jpg` files served by Next.js at `/characters/<id>.jpg`.

- [ ] **Step 1: Run the dry-run**

Run: `node scripts/fetch-character-images.mjs`
Expected: a manifest listing each of the 32 ids with its match (`exact` or `review`) and the source URL, ending with a summary line `N/32 matched, M need review, K unmatched.` Nothing is downloaded; `apps/frontend/public/characters/` does not exist yet.

- [ ] **Step 2: Show the manifest to the user and ask for confirmation**

Report: the source (AniList's public API and its image CDN), the file count (matched characters), the approximate total size (roughly 1–3 MB), the destination (`apps/frontend/public/characters/`), every `review`/`NO MATCH` row, and the reminder that the GitHub repo is public so committing the images may invite a takedown request. Ask the user for an explicit yes. Do not continue without it.

- [ ] **Step 3: On a yes, download**

Run: `node scripts/fetch-character-images.mjs --download`
Expected: `Downloaded <size> MB into …\apps\frontend\public\characters`, `SOURCES.md` written, no `DOWNLOAD FAILED` lines.

- [ ] **Step 4: Spot-check the images**

Run: `ls -la apps/frontend/public/characters | head -40`
Expected: one `<id>.jpg` per matched character, each larger than 5 KB, plus `SOURCES.md`.

Open at least six images with the Read tool (include the `review` ones and the awkward names: `l-lawliet`, `light-yagami`, `son-goku`, `satoru-gojo`, `levi-ackerman`, `saitama`) and confirm each shows the right character. If one is wrong, delete that file, tell the user, and note it so the character gets the placeholder instead.

- [ ] **Step 5: Document in the README**

In `README.md`, add this section before "## Deployment (two services)":
````markdown
## Hidden power

Players are not told how strong a character is. The backend never sends a character's `power` to clients during the lobby or the auction; it is revealed for everyone at the Battle phase (`apps/backend/src/game/view.ts`).

## Character images

Images are static files at `apps/frontend/public/characters/<id>.jpg` (named by character id from `data/characters.json`). A missing file shows a placeholder card. To (re)fetch them from AniList:

```bash
node scripts/fetch-character-images.mjs              # dry-run: prints what would be downloaded
node scripts/fetch-character-images.mjs --download   # saves the images and SOURCES.md
```

Character artwork belongs to its respective rights holders; this is a non-commercial game for friends.
````

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/public/characters README.md
git commit -m "feat: add character images and document hidden power"
```

---

### Task 4: Design system and shared UI pieces

**Files:**
- Create: `apps/frontend/src/lib/character.ts`
- Create: `apps/frontend/src/lib/character.test.ts`
- Create: `apps/frontend/src/components/CharacterCard.tsx`, `Readout.tsx`, `LedBar.tsx`
- Modify: `apps/frontend/src/app/layout.tsx` (fonts, viewport)
- Replace: `apps/frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `CharacterView` from `@abb/shared` (Task 1).
- Produces:
  - `characterImageUrl(id: string): string` → `/characters/<id>.jpg`; `initialsOf(name: string): string`
  - `<CharacterCard character={CharacterView} size?: 'lg' | 'sm' />` — renders the image (placeholder with initials on error), name plate, anime, and a power slot that reads `???` while `character.power` is undefined and the number once defined
  - `<Readout label={string} value={string} tone?: 'cyan' | 'warn' | 'good' | 'gold' size?: 'md' | 'lg' flicker?: boolean />`
  - `<LedBar fraction={number 0..1} segments?: number danger?: boolean />`
  - CSS classes used by later tasks: `.shell`, `.panel` (also `.card`), `.plate`, `.key` (also bare `button`) with `.primary` / `.big` modifiers, `.readout`, `.led` / `.led.on`, `.ledbar`, `.char-card`, `.field`, `.row`, `.stack`, `.grid`, `.muted`, `.center`, `.banner`, `.player`, `.code-plate`, `.bid-dock`

- [ ] **Step 1: Write the failing helper test**

`apps/frontend/src/lib/character.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { characterImageUrl, initialsOf } from './character';

describe('characterImageUrl', () => {
  it('points at the static file named by the character id', () => {
    expect(characterImageUrl('son-goku')).toBe('/characters/son-goku.jpg');
  });

  it('encodes unsafe characters', () => {
    expect(characterImageUrl('a b/c')).toBe('/characters/a%20b%2Fc.jpg');
  });
});

describe('initialsOf', () => {
  it('uses the first letter of the first and last word', () => {
    expect(initialsOf('Monkey D. Luffy')).toBe('ML');
    expect(initialsOf('Son Goku')).toBe('SG');
  });

  it('handles a single word and a single letter', () => {
    expect(initialsOf('Saitama')).toBe('S');
    expect(initialsOf('L')).toBe('L');
  });

  it('falls back to a question mark for empty or whitespace names', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/frontend/src/lib`
Expected: FAIL — cannot resolve `./character`.

- [ ] **Step 3: Write the helpers**

`apps/frontend/src/lib/character.ts`:
```ts
export function characterImageUrl(id: string): string {
  return `/characters/${encodeURIComponent(id)}.jpg`;
}

/** Placeholder text for a card whose image is missing. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s.]+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return '?';
  if (words.length === 1) return first.slice(0, 1).toUpperCase();
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}
```

- [ ] **Step 4: Run the helper test**

Run: `npx vitest run apps/frontend/src/lib`
Expected: PASS (6 tests).

- [ ] **Step 5: Layout with fonts and viewport**

Replace `apps/frontend/src/app/layout.tsx` with:
```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Thai, Orbitron } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const display = Orbitron({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const thai = Noto_Sans_Thai({ subsets: ['thai'], variable: '--font-thai', display: 'swap' });

export const metadata: Metadata = {
  title: 'Anime Bid Battle',
  description: 'Bid on anime characters, guess their strength, build the strongest team.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a14',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${thai.variable}`}>
      <body>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: The small components**

`apps/frontend/src/components/Readout.tsx`:
```tsx
interface Props {
  label: string;
  value: string;
  tone?: 'cyan' | 'warn' | 'good' | 'gold';
  size?: 'md' | 'lg';
  flicker?: boolean;
}

/** An LED-style display in a recessed glass window. */
export function Readout({ label, value, tone = 'cyan', size = 'md', flicker = false }: Props) {
  return (
    <div className={`readout tone-${tone} size-${size} ${flicker ? 'flicker' : ''}`}>
      <span className="readout-label">{label}</span>
      <span className="readout-value">{value}</span>
    </div>
  );
}
```

`apps/frontend/src/components/LedBar.tsx`:
```tsx
interface Props {
  /** 0..1 — how much of the bar is lit. */
  fraction: number;
  segments?: number;
  danger?: boolean;
}

export function LedBar({ fraction, segments = 20, danger = false }: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const lit = Math.ceil(clamped * segments);
  return (
    <div
      className={`ledbar ${danger ? 'danger' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <i key={index} className={index < lit ? 'on' : ''} />
      ))}
    </div>
  );
}
```

`apps/frontend/src/components/CharacterCard.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import type { CharacterView } from '@abb/shared';
import { characterImageUrl, initialsOf } from '../lib/character';

interface Props {
  character: CharacterView;
  size?: 'lg' | 'sm';
}

export function CharacterCard({ character, size = 'lg' }: Props) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [character.id]);

  const revealed = character.power !== undefined;
  return (
    <figure className={`char-card ${size}`}>
      <div className="char-art">
        {broken ? (
          <div className="char-fallback" aria-hidden="true">
            {initialsOf(character.name)}
          </div>
        ) : (
          <img
            src={characterImageUrl(character.id)}
            alt={character.name}
            loading="lazy"
            draggable={false}
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <figcaption className="char-plate">
        <span className="char-name">{character.name}</span>
        <span className="char-anime">{character.anime}</span>
        <span className={`power-slot ${revealed ? 'unsealed' : 'sealed'}`}>
          <small>Power</small>
          <b>{revealed ? character.power : '???'}</b>
        </span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 7: The design system CSS**

Replace `apps/frontend/src/app/globals.css` with:
```css
/* Dark neon skeuomorphic bidding console.
   Fonts come from next/font (see layout.tsx): --font-display, --font-body, --font-thai. */
:root {
  --bg: #0a0a14;
  --metal-1: #2a2c3a;
  --metal-2: #1b1c28;
  --metal-3: #12131d;
  --text: #eceefb;
  --muted: #8e92b0;
  --violet: #8b5cf6;
  --cyan: #22d3ee;
  --pink: #ff3d7f;
  --gold: #f5c542;
  --good: #4ade80;
  --edge-hi: rgba(255, 255, 255, 0.12);
  --drop: 0 10px 24px rgba(0, 0, 0, 0.55), 0 2px 0 rgba(0, 0, 0, 0.8);
  --noise: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background: var(--bg);
  font-family: var(--font-body, system-ui), var(--font-thai, system-ui), system-ui, sans-serif;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(900px 500px at 50% -10%, rgba(139, 92, 246, 0.22), transparent 60%),
    radial-gradient(700px 420px at 100% 100%, rgba(34, 211, 238, 0.12), transparent 60%);
}

.shell { width: 100%; max-width: 1040px; margin: 0 auto; padding: 16px 14px calc(32px + env(safe-area-inset-bottom)); }

h1, h2, h3 { margin: 0 0 12px; font-family: var(--font-display, system-ui), sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
h1 { font-size: clamp(1.5rem, 6vw, 2.4rem); text-shadow: 0 0 18px rgba(139, 92, 246, 0.8); }
h2 { font-size: 1.05rem; color: var(--cyan); }
h3 { font-size: 0.95rem; color: var(--muted); }
p { margin: 0 0 12px; }
.muted { color: var(--muted); }
.center { text-align: center; }

/* ---- layout helpers ---- */
.stack { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 900px) { .grid { grid-template-columns: 2fr 1fr; } }
.grid > * { min-width: 0; }

/* ---- metal panel with bevel, noise and corner screws ---- */
.panel, .card {
  position: relative;
  margin-bottom: 16px;
  padding: 18px 16px;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.65);
  background: linear-gradient(145deg, var(--metal-1), var(--metal-2) 55%, var(--metal-3));
  box-shadow: inset 0 1px 0 var(--edge-hi), inset 0 -2px 6px rgba(0, 0, 0, 0.55), var(--drop);
}
.panel::before, .card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: var(--noise);
  opacity: 0.05;
  mix-blend-mode: overlay;
}
.panel::after, .card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(circle at 11px 11px, #8a8da3 0 1.5px, #2b2d3b 2.5px 3.5px, transparent 4.5px),
    radial-gradient(circle at calc(100% - 11px) 11px, #8a8da3 0 1.5px, #2b2d3b 2.5px 3.5px, transparent 4.5px),
    radial-gradient(circle at 11px calc(100% - 11px), #8a8da3 0 1.5px, #2b2d3b 2.5px 3.5px, transparent 4.5px),
    radial-gradient(circle at calc(100% - 11px) calc(100% - 11px), #8a8da3 0 1.5px, #2b2d3b 2.5px 3.5px, transparent 4.5px);
}

/* embossed plate (labels, room code, rank) */
.plate {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 10px;
  background: linear-gradient(180deg, #34374b, #202230);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.5);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.8), 0 -1px 0 rgba(255, 255, 255, 0.1);
  font-family: var(--font-display, system-ui), sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.code-plate { font-size: clamp(1.8rem, 9vw, 2.8rem); letter-spacing: 0.3em; padding: 10px 18px 10px 26px; color: var(--cyan); text-shadow: 0 0 12px rgba(34, 211, 238, 0.7), 0 1px 0 rgba(0, 0, 0, 0.8); }

/* ---- physical keys ---- */
button, .key {
  min-height: 48px;
  padding: 0.6rem 1.1rem;
  border: 1px solid #0b0c12;
  border-radius: 12px;
  background: linear-gradient(180deg, #3a3d52, #22242f);
  color: var(--text);
  font-family: var(--font-display, system-ui), sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -3px 0 rgba(0, 0, 0, 0.45), 0 4px 0 #0b0c12, 0 8px 14px rgba(0, 0, 0, 0.5);
  transition: transform 0.06s, box-shadow 0.06s;
  -webkit-tap-highlight-color: transparent;
}
button:active:not(:disabled), .key:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6), 0 1px 0 #0b0c12;
}
button.primary, .key.primary {
  background: linear-gradient(180deg, #8b5cf6, #5b32c9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -3px 0 rgba(0, 0, 0, 0.35), 0 4px 0 #2a1465, 0 0 0 2px rgba(139, 92, 246, 0.55), 0 0 22px rgba(139, 92, 246, 0.55);
}
button.big, .key.big { min-height: 60px; font-size: 1.15rem; padding-inline: 1.6rem; }
button.big.primary { background: linear-gradient(180deg, #22d3ee, #0e8aa3); color: #031a20; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), inset 0 -3px 0 rgba(0, 0, 0, 0.3), 0 4px 0 #064453, 0 0 0 2px rgba(34, 211, 238, 0.6), 0 0 22px rgba(34, 211, 238, 0.55); }
button.secondary { background: linear-gradient(180deg, #2f3144, #1c1e2a); color: var(--muted); }
button:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 3px 0 #0b0c12; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }

/* ---- recessed inputs ---- */
input {
  min-height: 48px;
  min-width: 0;
  padding: 0.55rem 0.8rem;
  border: 1px solid #000;
  border-radius: 10px;
  background: #07080f;
  color: var(--text);
  font-size: 1rem;
  box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.85), 0 1px 0 rgba(255, 255, 255, 0.07);
}
input:disabled { opacity: 0.6; }
.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.field label { font-size: 0.78rem; color: var(--muted); letter-spacing: 0.04em; }

/* ---- LED readouts in glass windows ---- */
.readout {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 8px 14px;
  border: 2px solid #000;
  border-radius: 10px;
  background: linear-gradient(180deg, #05060b, #0b0d18);
  box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.9), inset 0 -1px 0 rgba(255, 255, 255, 0.07), 0 1px 0 rgba(255, 255, 255, 0.08);
  font-family: var(--font-display, system-ui), sans-serif;
  overflow: hidden;
}
.readout::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 45%);
}
.readout-label { font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.readout-value { font-size: 1.5rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--cyan); text-shadow: 0 0 10px currentColor; }
.readout.size-lg .readout-value { font-size: clamp(2rem, 11vw, 3.2rem); }
.readout.tone-good .readout-value { color: var(--good); }
.readout.tone-gold .readout-value { color: var(--gold); }
.readout.tone-warn .readout-value { color: var(--pink); }
.readout.flicker .readout-value { animation: flicker 0.5s steps(2, end) infinite; }
@keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

/* ---- LED status dots and segment bar ---- */
.led { display: inline-block; width: 10px; height: 10px; flex: none; border-radius: 50%; background: #2a2c3a; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8); }
.led.on { background: var(--good); box-shadow: 0 0 8px var(--good), inset 0 -1px 2px rgba(0, 0, 0, 0.4); }
.ledbar { display: flex; gap: 3px; width: 100%; }
.ledbar i { flex: 1; height: 12px; border-radius: 2px; background: #171925; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8); }
.ledbar i.on { background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
.ledbar.danger i.on { background: var(--pink); box-shadow: 0 0 8px var(--pink); }

/* ---- banners, player rows ---- */
.banner { padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; border: 1px solid #000; box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6); }
.banner.error { background: #2a0f1b; color: #ff8aae; }
.banner.info { background: #0f2230; color: var(--cyan); }
.player { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); min-width: 0; }
.player > span { min-width: 0; }
.player.leader { color: var(--good); font-weight: 700; }
.player.offline { opacity: 0.5; }
.player .who { display: flex; align-items: center; gap: 8px; min-width: 0; }

/* ---- character card: metal frame, glass art window, name plate, sealed power ---- */
.char-card { position: relative; width: 100%; max-width: 280px; margin: 0 auto; padding: 8px; border-radius: 16px; border: 1px solid #000; background: linear-gradient(160deg, #3a3d52, #1a1b27 60%, #2a2c3a); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -2px 6px rgba(0, 0, 0, 0.6), var(--drop), 0 0 24px rgba(139, 92, 246, 0.25); }
.char-art { position: relative; aspect-ratio: 2 / 3; overflow: hidden; border-radius: 10px; background: #05060b; box-shadow: inset 0 4px 12px rgba(0, 0, 0, 0.9); }
.char-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.char-art::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(120deg, rgba(255, 255, 255, 0.2) 0, rgba(255, 255, 255, 0.05) 38%, transparent 39%); }
.char-fallback { display: grid; place-items: center; width: 100%; height: 100%; font-family: var(--font-display, system-ui), sans-serif; font-size: 3rem; font-weight: 800; letter-spacing: 0.08em; color: rgba(139, 92, 246, 0.9); text-shadow: 0 0 18px rgba(139, 92, 246, 0.8); background: radial-gradient(circle at 50% 35%, rgba(139, 92, 246, 0.35), transparent 65%), #0b0c16; }
.char-plate { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: linear-gradient(180deg, #34374b, #202230); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.5); text-shadow: 0 1px 0 rgba(0, 0, 0, 0.8); min-width: 0; }
.char-name { font-weight: 800; line-height: 1.2; }
.char-anime { font-size: 0.78rem; color: var(--muted); }
.power-slot { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 6px; padding: 3px 8px; border-radius: 6px; font-family: var(--font-display, system-ui), sans-serif; background: #07080f; box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.9); }
.power-slot small { font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.power-slot.sealed b { color: var(--pink); text-shadow: 0 0 8px rgba(255, 61, 127, 0.7); letter-spacing: 0.15em; }
.power-slot.unsealed b { color: var(--gold); text-shadow: 0 0 10px rgba(245, 197, 66, 0.8); animation: unseal 0.7s ease-out both; }
@keyframes unseal { 0% { transform: scale(0.5) rotate(-8deg); opacity: 0; filter: brightness(3); } 60% { transform: scale(1.25); } 100% { transform: none; opacity: 1; filter: none; } }
.char-card.sm { max-width: 120px; padding: 5px; border-radius: 12px; }
.char-card.sm .char-plate { margin-top: 5px; padding: 5px 6px; }
.char-card.sm .char-name { font-size: 0.72rem; }
.char-card.sm .char-anime { display: none; }
.char-card.sm .power-slot { margin-top: 3px; padding: 2px 5px; }
.char-card.sm .power-slot small { display: none; }
.char-card.sm .char-fallback { font-size: 1.6rem; }
.cards-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }

/* ---- sticky bid dock on phones ---- */
.bid-dock { position: sticky; bottom: 0; z-index: 5; padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
@media (min-width: 900px) { .bid-dock { position: static; } }

.rank { font-family: var(--font-display, system-ui), sans-serif; font-size: 1.4rem; font-weight: 800; width: 2.6rem; flex: none; }
.winner-plate { background: linear-gradient(180deg, #f7d774, #b8891d); color: #2a1c00; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 8: Typecheck and build**

Run: `npm run typecheck`
Expected: exit code 0 for every workspace.

Run: `npm run build -w @abb/frontend`
Expected: build succeeds (`/` and `/room/[code]` listed). The build downloads the Google fonts, so it needs network access.

Run: `npx vitest run`
Expected: PASS for every file.

Visual verification of the CSS is done in Task 8; the old screens must still render acceptably because `.card` shares the `.panel` styling and bare `button` has the key styling.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/lib apps/frontend/src/components/CharacterCard.tsx apps/frontend/src/components/Readout.tsx apps/frontend/src/components/LedBar.tsx apps/frontend/src/app/layout.tsx apps/frontend/src/app/globals.css
git commit -m "feat: add skeuomorphic design system, fonts and card components"
```

---

### Task 5: Home, join form, error banner and Lobby

**Files:**
- Replace: `apps/frontend/src/app/page.tsx`
- Replace: `apps/frontend/src/components/JoinRoomForm.tsx`, `ErrorBanner.tsx`, `Lobby.tsx`

**Interfaces:**
- Consumes: design-system classes and components from Task 4; `getSocket`, `saveSession` (unchanged); `useRoom` actions (unchanged).
- Produces: same props as before — `JoinRoomForm({ title, onSubmit })`, `ErrorBanner({ error, onDismiss })`, `Lobby({ room, actions })` — so `apps/frontend/src/app/room/[code]/page.tsx` needs no change.

- [ ] **Step 1: Home page**

Replace `apps/frontend/src/app/page.tsx` with:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ErrorPayload } from '@abb/shared';
import { getSocket } from '../lib/socket';
import { saveSession } from '../lib/session';
import { ErrorBanner } from '../components/ErrorBanner';

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<ErrorPayload | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
  }, []);

  const name = nickname.trim();

  function create() {
    getSocket().emit('room:create', { nickname: name }, (res) => {
      if (!res.ok) return setError(res.error);
      saveSession(res.roomCode, { playerId: res.playerId, rejoinToken: res.rejoinToken });
      router.push(`/room/${res.roomCode}`);
    });
  }

  function join() {
    getSocket().emit('room:join', { roomCode: roomCode.trim(), nickname: name }, (res) => {
      if (!res.ok) return setError(res.error);
      saveSession(res.roomCode, { playerId: res.playerId, rejoinToken: res.rejoinToken });
      router.push(`/room/${res.roomCode}`);
    });
  }

  return (
    <div className="stack">
      <header className="center">
        <h1>Anime Bid Battle</h1>
        <p className="muted">Bid on anime characters. Guess their strength. Build the strongest team.</p>
      </header>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="panel">
        <div className="field">
          <label htmlFor="nickname">Your nickname</label>
          <input id="nickname" value={nickname} maxLength={20} autoComplete="off" onChange={(e) => setNickname(e.target.value)} />
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <section className="panel">
          <h2>Create a room</h2>
          <p className="muted">You become the host and choose the settings.</p>
          <button className="primary big" onClick={create} disabled={!name}>
            Create room
          </button>
        </section>
        <section className="panel">
          <h2>Join a room</h2>
          <div className="row">
            <input
              aria-label="Room code"
              value={roomCode}
              maxLength={5}
              placeholder="ROOM CODE"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={{ width: '9em' }}
            />
            <button className="primary" onClick={join} disabled={!name || roomCode.trim().length !== 5}>
              Join
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Join form and error banner**

Replace `apps/frontend/src/components/JoinRoomForm.tsx` with:
```tsx
'use client';

import { useState } from 'react';

export function JoinRoomForm({ title, onSubmit }: { title: string; onSubmit: (nickname: string) => void }) {
  const [nickname, setNickname] = useState('');
  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (nickname.trim()) onSubmit(nickname.trim());
      }}
    >
      <h2>{title}</h2>
      <div className="row">
        <input
          aria-label="Your nickname"
          value={nickname}
          maxLength={20}
          placeholder="Your nickname"
          autoComplete="off"
          onChange={(event) => setNickname(event.target.value)}
          autoFocus
        />
        <button className="primary" type="submit" disabled={!nickname.trim()}>
          Join
        </button>
      </div>
    </form>
  );
}
```

Replace `apps/frontend/src/components/ErrorBanner.tsx` with:
```tsx
import type { ErrorPayload } from '@abb/shared';

export function ErrorBanner({ error, onDismiss }: { error: ErrorPayload | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="banner error" role="alert">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <span>{error.message}</span>
        <button className="secondary" onClick={onDismiss} aria-label="Dismiss error">
          OK
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Lobby (same logic, new markup)**

Replace `apps/frontend/src/components/Lobby.tsx` with the following. The state logic (`draft`, `dirty`, resync effect, `draftValid`, `save`, `copyLink`) is carried over unchanged from the current file; only the markup changed.
```tsx
'use client';

import { useEffect, useState } from 'react';
import { MIN_PLAYERS_TO_START, SETTINGS_BOUNDS, type RoomSettings, type RoomView, type UpdateSettingsPayload } from '@abb/shared';

interface Props {
  room: RoomView;
  actions: { updateSettings(patch: UpdateSettingsPayload): void; start(): void };
}

const FIELDS = [
  { key: 'maxPlayers', label: 'Max players' },
  { key: 'startingCoins', label: 'Starting coins' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'roundSeconds', label: 'Seconds per round' },
] as const;

export function Lobby({ room, actions }: Props) {
  const isHost = room.youId === room.hostId;
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(room.settings));
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const { maxPlayers, startingCoins, rounds, roundSeconds } = room.settings;

  // Resync from the server unless the user has pending edits.
  useEffect(() => {
    if (!dirty) setDraft(toDraft({ maxPlayers, startingCoins, rounds, roundSeconds }));
  }, [dirty, maxPlayers, startingCoins, rounds, roundSeconds, room.hostId, isHost]);

  const draftValid = FIELDS.every(({ key }) => draft[key] !== '' && Number.isInteger(Number(draft[key])));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; the code is shown on screen anyway
    }
  }

  function save() {
    const patch: UpdateSettingsPayload = {};
    for (const { key } of FIELDS) patch[key] = Number(draft[key]);
    actions.updateSettings(patch);
    setDirty(false);
  }

  const needsPlayers = room.players.length < MIN_PLAYERS_TO_START;

  return (
    <div className="grid">
      <div className="stack">
        <section className="panel center">
          <div className="muted" style={{ marginBottom: 8 }}>Room code</div>
          <div className="plate code-plate">{room.code}</div>
          <div style={{ marginTop: 14 }}>
            <button className="secondary" onClick={copyLink}>
              {copied ? 'Link copied!' : 'Copy invite link'}
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Settings</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            {FIELDS.map(({ key, label }) => (
              <div className="field" key={key} style={{ flex: '1 1 140px' }}>
                <label htmlFor={key}>
                  {label} ({SETTINGS_BOUNDS[key].min}–{SETTINGS_BOUNDS[key].max})
                </label>
                <input
                  id={key}
                  type="number"
                  inputMode="numeric"
                  value={isHost ? draft[key] : String(room.settings[key])}
                  disabled={!isHost}
                  onChange={(e) => {
                    setDraft({ ...draft, [key]: e.target.value });
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>
          {isHost && (
            <div className="row" style={{ marginTop: 14 }}>
              <button className="secondary" onClick={save} disabled={!draftValid}>
                Save settings
              </button>
              {dirty && <span className="muted">Unsaved changes</span>}
            </div>
          )}
        </section>
      </div>

      <div className="stack">
        <section className="panel">
          <h2>
            Players ({room.players.length}/{room.settings.maxPlayers})
          </h2>
          {room.players.map((player) => (
            <div key={player.id} className={`player ${player.connected ? '' : 'offline'}`}>
              <span className="who">
                <span className={`led ${player.connected ? 'on' : ''}`} aria-label={player.connected ? 'online' : 'offline'} />
                <span>
                  {player.nickname}
                  {player.id === room.youId ? ' (you)' : ''}
                  {player.isHost ? ' 👑' : ''}
                </span>
              </span>
            </div>
          ))}
        </section>

        {isHost ? (
          <button className="primary big" onClick={actions.start} disabled={needsPlayers || dirty}>
            {needsPlayers ? `Need ${MIN_PLAYERS_TO_START}+ players` : 'Start game'}
          </button>
        ) : (
          <p className="muted center">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

function toDraft(settings: Pick<RoomSettings, (typeof FIELDS)[number]['key']>): Record<string, string> {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(settings[key])]));
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run build -w @abb/frontend`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/page.tsx apps/frontend/src/components/JoinRoomForm.tsx apps/frontend/src/components/ErrorBanner.tsx apps/frontend/src/components/Lobby.tsx
git commit -m "feat: restyle home, join form, error banner and lobby"
```

---

### Task 6: Auction screen

**Files:**
- Replace: `apps/frontend/src/components/Auction.tsx`

**Interfaces:**
- Consumes: `CharacterCard`, `Readout`, `LedBar` (Task 4); `useCountdown(endsAt, clockOffset): number` (existing); `RoomView`, `AuctionView` from `@abb/shared`.
- Produces: `Auction({ room, auction, clockOffset, onBid })` with unchanged props, so the room page needs no change.

- [ ] **Step 1: Rewrite the Auction screen**

Replace `apps/frontend/src/components/Auction.tsx` with the following. The bidding rules (`minBid`, `canBid`, quick amounts, custom amount validation) are carried over unchanged from the current file; power is never shown here.
```tsx
'use client';

import { useState } from 'react';
import type { AuctionView, RoomView } from '@abb/shared';
import { useCountdown } from '../hooks/useCountdown';
import { CharacterCard } from './CharacterCard';
import { LedBar } from './LedBar';
import { Readout } from './Readout';

interface Props {
  room: RoomView;
  auction: AuctionView;
  clockOffset: number;
  onBid: (amount: number) => void;
}

export function Auction({ room, auction, clockOffset, onBid }: Props) {
  const me = room.players.find((p) => p.id === room.youId);
  const remainingMs = useCountdown(auction.endsAt, clockOffset);
  const [custom, setCustom] = useState('');

  const open = auction.status === 'OPEN';
  const closing = open && remainingMs < 5000;
  const minBid = auction.leaderId === null ? 1 : auction.price + 1;
  const coins = me?.coins ?? 0;
  const isLeader = auction.leaderId === room.youId;
  const canBid = open && !isLeader && coins >= minBid;
  const leader = room.players.find((p) => p.id === auction.leaderId);

  const quick = [...new Set([minBid, auction.price + 5, auction.price + 10])].filter(
    (amount) => amount >= minBid && amount <= coins,
  );
  const customAmount = Number(custom);
  const roundMs = room.settings.roundSeconds * 1000;

  const timeText = open ? (remainingMs / 1000).toFixed(1) : auction.status === 'SOLD' ? 'SOLD' : 'NONE';
  const status = (() => {
    if (auction.status === 'SOLD' && leader) return `Sold to ${leader.nickname}`;
    if (auction.status === 'UNSOLD') return 'Nobody bid — unsold';
    if (leader) return `Leader: ${leader.nickname}${isLeader ? ' (you)' : ''}${closing ? ' — going once!' : ''}`;
    return 'No bids yet';
  })();

  return (
    <div className="grid">
      <div className="stack">
        <section className="panel center">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <span className="plate">
              Round {auction.roundIndex + 1}/{auction.totalRounds}
            </span>
            <Readout label="Time" value={timeText} tone={closing ? 'warn' : 'cyan'} flicker={closing} />
          </div>

          <div style={{ margin: '16px 0' }}>
            <CharacterCard character={auction.character} />
          </div>

          <LedBar fraction={open ? remainingMs / roundMs : 0} danger={closing} />

          <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
            <Readout label="Current bid" value={auction.price > 0 ? String(auction.price) : '--'} tone="good" size="lg" />
          </div>
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>{status}</p>
        </section>

        <section className="panel bid-dock">
          <h3>Your bid — {coins} coins</h3>
          <div className="row">
            {quick.map((amount) => (
              <button key={amount} disabled={!canBid} onClick={() => onBid(amount)}>
                {amount}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'nowrap' }}>
            <input
              aria-label="Custom bid"
              type="number"
              inputMode="numeric"
              min={minBid}
              value={custom}
              placeholder={`min ${minBid}`}
              onChange={(e) => setCustom(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="primary big"
              disabled={!canBid || !Number.isInteger(customAmount) || customAmount < minBid || customAmount > coins}
              onClick={() => {
                onBid(customAmount);
                setCustom('');
              }}
            >
              Bid
            </button>
          </div>
          {isLeader && open && <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>You are the highest bidder.</p>}
        </section>
      </div>

      <div className="stack">
        <section className="panel">
          <h3>Players</h3>
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`player ${player.id === auction.leaderId ? 'leader' : ''} ${player.connected ? '' : 'offline'}`}
            >
              <span className="who">
                <span className={`led ${player.connected ? 'on' : ''}`} />
                <span>
                  {player.nickname}
                  {player.id === room.youId ? ' (you)' : ''}
                </span>
              </span>
              <span>
                {player.coins}¢ · {player.team.length} 🎴
              </span>
            </div>
          ))}
        </section>

        <section className="panel">
          <h3>Your team</h3>
          {me && me.team.length > 0 ? (
            <div className="cards-row">
              {me.team.map((character) => (
                <CharacterCard key={character.id} character={character} size="sm" />
              ))}
            </div>
          ) : (
            <p className="muted">No characters yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run build -w @abb/frontend`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/Auction.tsx
git commit -m "feat: restyle the auction screen as a bidding console"
```

---

### Task 7: Battle and Results screens

**Files:**
- Create: `apps/frontend/src/hooks/useCountUp.ts`
- Replace: `apps/frontend/src/components/Battle.tsx`, `apps/frontend/src/components/Results.tsx`

**Interfaces:**
- Consumes: `CharacterCard`, `Readout` (Task 4); `RoomView` (`players[].team` with `power` set, `results: BattleResult[]` sorted by rank).
- Produces: `useCountUp(target: number, durationMs: number, delayMs: number): number`; `Battle({ room })` and `Results({ room, onPlayAgain })` with unchanged props.

- [ ] **Step 1: Count-up hook**

`apps/frontend/src/hooks/useCountUp.ts`:
```ts
'use client';

import { useEffect, useState } from 'react';

/** Animates 0 -> target after a delay; jumps straight to the target when reduced motion is requested. */
export function useCountUp(target: number, durationMs: number, delayMs: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || durationMs <= 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (time: number) => {
      if (start === 0) start = time;
      const progress = Math.min(1, (time - start) / durationMs);
      setValue(Math.round(target * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, delayMs]);

  return value;
}
```

- [ ] **Step 2: Battle screen**

Replace `apps/frontend/src/components/Battle.tsx` with:
```tsx
'use client';

import type { RoomView } from '@abb/shared';
import { useCountUp } from '../hooks/useCountUp';
import { CharacterCard } from './CharacterCard';
import { Readout } from './Readout';

function Total({ value, delayMs }: { value: number; delayMs: number }) {
  const shown = useCountUp(value, 1200, delayMs);
  return <Readout label="Total power" value={String(shown)} tone="gold" size="lg" />;
}

export function Battle({ room }: { room: RoomView }) {
  const results = room.results ?? [];
  return (
    <div className="stack">
      <header className="center">
        <h1>Battle!</h1>
        <p className="muted">Powers revealed — comparing teams…</p>
      </header>
      {results.map((result, index) => {
        const player = room.players.find((p) => p.id === result.playerId);
        // the strongest team is revealed last
        const delayMs = (results.length - 1 - index) * 500;
        return (
          <section key={result.playerId} className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{result.nickname}</strong>
              <Total value={result.totalPower} delayMs={delayMs} />
            </div>
            {player && player.team.length > 0 ? (
              <div className="cards-row" style={{ marginTop: 12 }}>
                {player.team.map((character) => (
                  <CharacterCard key={character.id} character={character} size="sm" />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>No characters</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Results screen**

Replace `apps/frontend/src/components/Results.tsx` with:
```tsx
import type { RoomView } from '@abb/shared';
import { CharacterCard } from './CharacterCard';

export function Results({ room, onPlayAgain }: { room: RoomView; onPlayAgain: () => void }) {
  const results = room.results ?? [];
  const winners = results.filter((r) => r.rank === 1);
  const isHost = room.youId === room.hostId;

  return (
    <div className="stack">
      <header className="center">
        <h1>
          {winners.length > 0 ? `${winners.map((w) => w.nickname).join(' & ')} ${winners.length > 1 ? 'tie!' : 'wins!'}` : 'Game over'}
        </h1>
      </header>
      {results.map((result) => {
        const player = room.players.find((p) => p.id === result.playerId);
        return (
          <section key={result.playerId} className="panel">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <span className={`plate rank ${result.rank === 1 ? 'winner-plate' : ''}`}>#{result.rank}</span>
              <strong style={{ flex: 1, minWidth: 0 }}>
                {result.nickname}
                {result.playerId === room.youId ? ' (you)' : ''}
              </strong>
              <span className="plate">{result.totalPower} power</span>
            </div>
            {player && player.team.length > 0 ? (
              <div className="cards-row" style={{ marginTop: 12 }}>
                {player.team.map((character) => (
                  <CharacterCard key={character.id} character={character} size="sm" />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>No characters</p>
            )}
          </section>
        );
      })}
      <div className="center">
        {isHost ? (
          <button className="primary big" onClick={onPlayAgain}>
            Play again
          </button>
        ) : (
          <p className="muted">Waiting for the host to start another game…</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, build, full test run**

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run build -w @abb/frontend`
Expected: build succeeds.

Run: `npx vitest run`
Expected: PASS for every file.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/hooks/useCountUp.ts apps/frontend/src/components/Battle.tsx apps/frontend/src/components/Results.tsx
git commit -m "feat: restyle battle and results with power reveal"
```

---

### Task 8: Real-browser verification and polish (controller-run)

**This task is executed by the controller with the Chrome tools, not by a subagent. Findings are fixed by one dispatched fix subagent.**

**Files:** none planned; any fixes touch `apps/frontend/src/app/globals.css` and the components above.

**Interfaces:**
- Consumes: the finished frontend and backend from Tasks 1–7; the Chrome browser tools (`resize_window`, `navigate`, `computer`, `get_page_text`, `javascript_tool`).

- [ ] **Step 1: Start both servers**

Run the backend (`npm run start -w @abb/backend`) and the frontend (`npm run dev:frontend`) in the background. Before starting, check ports 3000 and 4000 are free (`netstat -ano | grep -E ":(3000|4000) "`); stop any leftover node process from this worktree first. Confirm `curl localhost:4000/health` returns `{"ok":true}`.

- [ ] **Step 2: Play a game in two tabs at phone width**

Resize the browser window to 390 × 844, then in two tabs: create a room as "Alice", join as a second player whose nickname is Thai and 20 characters long (for example `สมชายนักประมูลตัวจริง`), set rounds to 2 and seconds to 10, start, bid, let the game finish, and press Play again. Note that tabs in one browser profile share localStorage (so do not refresh the first tab after the second joins). Check, with screenshots at each screen:
1. Home, Lobby, Auction, Battle and Results all render in the dark skeuomorphic style; the bid dock stays at the bottom of the viewport during the auction; keys are comfortably tappable (at least 44 px tall).
2. During the auction no power number is visible anywhere; the card's power slot shows `???`; teams show cards with `???`.
3. At Battle every card shows its power, totals count up, and Results ranks with a gold plate for #1; a player with no characters shows "No characters".
4. The Thai 20-character nickname does not overflow any panel (no clipped text, no horizontal scrolling).
5. Network panel (or `read_network_requests`): `room:state` frames during the auction contain no `power`.

- [ ] **Step 3: Check the image fallback**

In the page, request a missing image (for example run `document.querySelector('.char-art img').src = '/characters/does-not-exist.jpg'` with the `javascript_tool`) and confirm the card shows the initials placeholder, not a broken-image icon.

- [ ] **Step 4: Check overflow at small widths and at desktop width**

For widths 360 and 320, on each screen run with `javascript_tool`: `document.documentElement.scrollWidth <= window.innerWidth` and expect `true`. Then resize to 1280 × 800 and confirm the two-column layouts and a static (non-sticky) bid dock look right.

- [ ] **Step 5: Check reduced motion**

With the `javascript_tool`, confirm the stylesheet contains the `prefers-reduced-motion` block (`[...document.styleSheets].some(s => [...s.cssRules].some(r => r.conditionText?.includes('prefers-reduced-motion')))` returns `true`).

- [ ] **Step 6: Fix findings**

If any check fails, collect every finding into one list and dispatch one fix subagent with the whole list (CSS and component fixes only), then re-verify the failing checks. Stop both servers and confirm ports 3000 and 4000 are free.

- [ ] **Step 7: Commit any fixes**

```bash
git add apps/frontend
git commit -m "fix: polish layout issues found in browser verification"
```

---

## Release (user approval required — not a subagent task)

After the final branch review and the merge to `main`:
1. Ask the user before pushing: `git push origin main` redeploys Vercel (frontend) and Render (backend). Mixed versions are harmless (an old frontend against the new backend shows missing power values; a new frontend tolerates an old backend).
2. The Render `CORS_ORIGIN` must list `https://animebidbattle.vercel.app` (a user action in Render's dashboard).
3. After both deploys are live, open `https://animebidbattle.vercel.app`, create a room, and confirm a hidden-power round works against the real backend.

## Self-Review Notes

- **Spec coverage:** hidden power and redaction rules (Task 1, sections 3 and 6 of the spec); `CharacterView` contract (Task 1); images script, dry-run/confirm/download, `SOURCES.md`, fallback (Tasks 2–4); visual design (Tasks 4–7); mobile-first, 44 px targets, reduced motion, Thai-capable fonts (Task 4 CSS/layout, Task 8 checks); testing section (Tasks 1, 2, 4 unit/integration, Task 8 browser); deployment (Release section). Out-of-scope items are not implemented.
- **Type consistency:** `CharacterView` (Task 1) is what `CharacterCard` accepts (Task 4); `Readout`/`LedBar` props match their uses in Tasks 6–7; `useCountUp(target, durationMs, delayMs)` matches `Battle`; component prop shapes for `Auction`, `Lobby`, `Battle`, `Results`, `ErrorBanner`, `JoinRoomForm` are unchanged so `room/[code]/page.tsx` and `useRoom` need no edits.
- **Plan-mandated judgment calls for reviewers:** the Task 1 frontend patch is deliberately minimal and is replaced wholesale by Tasks 6 and 7; `.card` and bare `button` share the new styling so every commit renders acceptably before its screen is rewritten.
