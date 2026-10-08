# Anime Bid Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realtime multiplayer web game where players join a room by code, bid on anime characters in open ascending auctions with an anti-sniping timer, and the team with the highest total power wins.

**Architecture:** An npm-workspaces monorepo. `packages/shared` holds types, zod schemas and the socket event contract. `apps/backend` (Express + Socket.IO) owns all game logic as a pure state machine (`game/`) with pluggable `AuctionMode`, `CharacterSource` and `RoomStore` interfaces, wrapped by a timer-owning `RoomService` and a thin socket `transport`. `apps/frontend` (Next.js) only renders the `room:state` it receives and sends intents.

**Tech Stack:** Node.js, TypeScript, Express, Socket.IO, zod, Next.js (App Router), React, vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-10-08-anime-bid-battle-design.md`

## Global Constraints

- Monorepo layout: `packages/shared`, `apps/frontend`, `apps/backend`, `data/characters.json`. Use the names `frontend` and `backend` (never `web`/`server`).
- npm workspaces; packages named `@abb/shared`, `@abb/backend`, `@abb/frontend`.
- Room code: 5 characters, unique among live rooms.
- Settings (host-configurable, validated by the backend): max players 2–8, starting coins, number of rounds, round seconds, `auctionMode` default `"open-ascending"`. Defaults: 6 players, 1000 coins, 10 rounds, 15 s.
- Phases in order only: `LOBBY → AUCTION → BATTLE → RESULTS`, and `RESULTS → LOBBY` on play again. Wrong-phase commands are rejected with `WRONG_PHASE`.
- Open-ascending rules: first bid ≥ 1; later bids ≥ current price + 1; bid ≤ bidder's coins; the current leader cannot outbid themselves; an accepted bid sets `endsAt = max(endsAt, now + 5000 ms)`; no bids → character unsold.
- Number of rounds = number of characters auctioned; characters are drawn randomly without repeats.
- The backend clock is the only authority for expiry; `endsAt` and `serverNow` are sent to clients for display only.
- Clients send intents; the backend validates every message with zod and broadcasts full `room:state` (via `getPublicView`). Nothing a client claims is trusted.
- Identity: nickname + rejoin token (stored in the browser's localStorage). No accounts. Rejoin tokens never appear in `room:state`.
- State is in memory behind a `RoomStore` interface. Winner = highest total team power (computed only through `computePower()`).
- Host disconnects → host rights move to the next connected player. Empty (all-disconnected) rooms are deleted after a timeout.
- Socket URL comes from `NEXT_PUBLIC_SOCKET_URL`; backend CORS origins come from `CORS_ORIGIN` (comma-separated).
- The UI sub-state "CLOSING" is display-only: the frontend derives it from `endsAt - now < 5000`; the backend auction status is `OPEN | SOLD | UNSOLD`.
- Out of scope: accounts, database, chat, other auction modes, anime API, real power formula, i18n, frontend E2E tests.

## Review Focus

1. Two bids at the same price arriving back to back → only the first is accepted, the second gets `BID_TOO_LOW` (Task 3 unit test, Task 6 integration test).
2. A player refreshes/reconnects mid-game → `room:rejoin` returns the same player with coins and team intact (Task 5 and Task 6 tests).
3. Nickname that is whitespace-only, or duplicates another player's nickname with different case → rejected (Task 1 schema test, Task 4 game test).
4. Room code typed in lowercase or with surrounding spaces → normalized and still joins (Task 1 schema test).
5. Malformed socket payloads (missing fields, float/negative/string bid amount, junk settings) → `BAD_REQUEST`/`INVALID_SETTINGS` ack, server keeps running (Task 6 integration test).

---

### Task 1: Monorepo scaffold and shared package

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`, `constants.ts`, `errors.ts`, `schemas.ts`, `protocol.ts`, `index.ts`
- Test: `packages/shared/src/schemas.test.ts`

**Interfaces:**
- Produces (used by every later task, import from `@abb/shared`):
  - Types: `AuctionModeName`, `Phase`, `AuctionStatus`, `Character`, `RoomSettings`, `SettingsBounds`, `PlayerView`, `AuctionBidView`, `AuctionView`, `BattleResult`, `RoomView`, `JoinResult`
  - Constants: `AUCTION_MODE_NAMES`, `DEFAULT_SETTINGS`, `SETTINGS_BOUNDS`, `MIN_PLAYERS_TO_START`, `ROOM_CODE_LENGTH`, `NICKNAME_MAX`
  - Errors: `ErrorCode`, `ErrorPayload`, `GameError(code, message?)`
  - Schemas: `characterSchema`, `nicknameSchema`, `settingsSchema`, `createRoomSchema`, `joinRoomSchema`, `rejoinSchema`, `updateSettingsSchema`, `bidSchema`, `emptySchema` and payload types `CreateRoomPayload`, `JoinRoomPayload`, `RejoinPayload`, `UpdateSettingsPayload`, `BidPayload`
  - Protocol: `Ack<T>`, `ClientToServerEvents`, `ServerToClientEvents`

- [ ] **Step 1: Create the root workspace files**

`package.json`:
```json
{
  "name": "anime-bid-battle",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "dev:backend": "npm run dev -w @abb/backend",
    "dev:frontend": "npm run dev -w @abb/frontend"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "types": []
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/backend/**/*.test.ts'],
    environment: 'node',
  },
});
```

`.gitignore`:
```
node_modules
.next
dist
.env
.env.local
*.tsbuildinfo
next-env.d.ts
```

`packages/shared/package.json`:
```json
{
  "name": "@abb/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^3.23.8" }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: completes without errors, creates `node_modules` and `package-lock.json`.

- [ ] **Step 3: Write the failing schema test**

`packages/shared/src/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  bidSchema,
  characterSchema,
  createRoomSchema,
  joinRoomSchema,
  nicknameSchema,
} from './schemas';

describe('nicknameSchema', () => {
  it('trims surrounding whitespace', () => {
    expect(nicknameSchema.parse('  Bob  ')).toBe('Bob');
  });

  it('rejects whitespace-only and over-long nicknames', () => {
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('').success).toBe(false);
    expect(nicknameSchema.safeParse('x'.repeat(21)).success).toBe(false);
  });
});

describe('joinRoomSchema', () => {
  it('normalizes a lowercase, padded room code', () => {
    const parsed = joinRoomSchema.parse({ roomCode: ' ab12c ', nickname: 'Bob' });
    expect(parsed.roomCode).toBe('AB12C');
  });

  it('rejects a room code of the wrong length', () => {
    expect(joinRoomSchema.safeParse({ roomCode: 'ABC', nickname: 'Bob' }).success).toBe(false);
  });
});

describe('createRoomSchema', () => {
  it('accepts a partial settings patch', () => {
    const parsed = createRoomSchema.parse({ nickname: 'Al', settings: { rounds: 5 } });
    expect(parsed.settings).toEqual({ rounds: 5 });
  });

  it('rejects non-integer settings', () => {
    expect(
      createRoomSchema.safeParse({ nickname: 'Al', settings: { rounds: 2.5 } }).success,
    ).toBe(false);
  });
});

describe('bidSchema', () => {
  it('accepts positive integers only', () => {
    expect(bidSchema.safeParse({ amount: 10 }).success).toBe(true);
    expect(bidSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(bidSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(bidSchema.safeParse({ amount: 1.5 }).success).toBe(false);
    expect(bidSchema.safeParse({ amount: '10' }).success).toBe(false);
    expect(bidSchema.safeParse({}).success).toBe(false);
  });
});

describe('characterSchema', () => {
  it('rejects negative power', () => {
    expect(
      characterSchema.safeParse({ id: 'a', name: 'A', anime: 'X', power: -1 }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run packages/shared`
Expected: FAIL — cannot resolve `./schemas`.

- [ ] **Step 5: Write the shared sources**

`packages/shared/src/types.ts`:
```ts
export const AUCTION_MODE_NAMES = ['open-ascending'] as const;
export type AuctionModeName = (typeof AUCTION_MODE_NAMES)[number];

export type Phase = 'LOBBY' | 'AUCTION' | 'BATTLE' | 'RESULTS';
export type AuctionStatus = 'OPEN' | 'SOLD' | 'UNSOLD';

export interface Character {
  id: string;
  name: string;
  anime: string;
  power: number;
}

export interface RoomSettings {
  maxPlayers: number;
  startingCoins: number;
  rounds: number;
  roundSeconds: number;
  auctionMode: AuctionModeName;
}

export type SettingsBounds = Record<
  'maxPlayers' | 'startingCoins' | 'rounds' | 'roundSeconds',
  { min: number; max: number }
>;

export interface PlayerView {
  id: string;
  nickname: string;
  coins: number;
  team: Character[];
  connected: boolean;
  isHost: boolean;
}

/** What an auction mode exposes about a round to one viewer. */
export interface AuctionBidView {
  character: Character;
  price: number;
  leaderId: string | null;
  endsAt: number;
  status: AuctionStatus;
}

export interface AuctionView extends AuctionBidView {
  roundIndex: number;
  totalRounds: number;
}

export interface BattleResult {
  playerId: string;
  nickname: string;
  totalPower: number;
  rank: number;
}

export interface RoomView {
  code: string;
  phase: Phase;
  settings: RoomSettings;
  hostId: string;
  youId: string;
  serverNow: number;
  players: PlayerView[];
  auction: AuctionView | null;
  results: BattleResult[] | null;
}

export interface JoinResult {
  roomCode: string;
  playerId: string;
  rejoinToken: string;
}
```

`packages/shared/src/constants.ts`:
```ts
import type { RoomSettings, SettingsBounds } from './types';

export const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 6,
  startingCoins: 1000,
  rounds: 10,
  roundSeconds: 15,
  auctionMode: 'open-ascending',
};

export const SETTINGS_BOUNDS: SettingsBounds = {
  maxPlayers: { min: 2, max: 8 },
  startingCoins: { min: 100, max: 10000 },
  rounds: { min: 1, max: 30 },
  roundSeconds: { min: 10, max: 60 },
};

export const MIN_PLAYERS_TO_START = 2;
export const ROOM_CODE_LENGTH = 5;
export const NICKNAME_MAX = 20;
```

`packages/shared/src/errors.ts`:
```ts
export const ERROR_CODES = [
  'BAD_REQUEST',
  'INTERNAL',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NOT_HOST',
  'NOT_IN_ROOM',
  'WRONG_PHASE',
  'NICKNAME_TAKEN',
  'INVALID_SETTINGS',
  'INVALID_TOKEN',
  'NOT_ENOUGH_PLAYERS',
  'BID_TOO_LOW',
  'INSUFFICIENT_COINS',
  'ALREADY_LEADING',
  'AUCTION_CLOSED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export class GameError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GameError';
  }
}
```

`packages/shared/src/schemas.ts`:
```ts
import { z } from 'zod';
import { NICKNAME_MAX, ROOM_CODE_LENGTH } from './constants';
import { AUCTION_MODE_NAMES } from './types';

export const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  anime: z.string().min(1),
  power: z.number().finite().nonnegative(),
});

export const nicknameSchema = z.string().trim().min(1).max(NICKNAME_MAX);

export const settingsSchema = z.object({
  maxPlayers: z.number().int(),
  startingCoins: z.number().int(),
  rounds: z.number().int(),
  roundSeconds: z.number().int(),
  auctionMode: z.enum(AUCTION_MODE_NAMES),
});

const roomCodeSchema = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH);

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  settings: settingsSchema.partial().optional(),
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  nickname: nicknameSchema,
});

export const rejoinSchema = z.object({
  roomCode: roomCodeSchema,
  rejoinToken: z.string().min(1),
});

export const updateSettingsSchema = settingsSchema.partial();
export const bidSchema = z.object({ amount: z.number().int().positive() });
export const emptySchema = z.object({});

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type RejoinPayload = z.infer<typeof rejoinSchema>;
export type UpdateSettingsPayload = z.infer<typeof updateSettingsSchema>;
export type BidPayload = z.infer<typeof bidSchema>;
```

`packages/shared/src/protocol.ts`:
```ts
import type { ErrorPayload } from './errors';
import type {
  BidPayload,
  CreateRoomPayload,
  JoinRoomPayload,
  RejoinPayload,
  UpdateSettingsPayload,
} from './schemas';
import type { JoinResult, RoomView } from './types';

export type Ack<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorPayload };

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (res: Ack<JoinResult>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Ack<JoinResult>) => void) => void;
  'room:rejoin': (payload: RejoinPayload, ack: (res: Ack<JoinResult>) => void) => void;
  'room:updateSettings': (payload: UpdateSettingsPayload, ack: (res: Ack) => void) => void;
  'game:start': (payload: object, ack: (res: Ack) => void) => void;
  'auction:bid': (payload: BidPayload, ack: (res: Ack) => void) => void;
  'game:playAgain': (payload: object, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  error: (error: ErrorPayload) => void;
}
```

`packages/shared/src/index.ts`:
```ts
export * from './types';
export * from './constants';
export * from './errors';
export * from './schemas';
export * from './protocol';
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run packages/shared`
Expected: PASS (all tests in `schemas.test.ts`).

Run: `npm run typecheck -w @abb/shared`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts .gitignore packages/shared
git commit -m "feat: scaffold monorepo and shared contracts"
```

---

### Task 2: Characters (data, source, power)

**Files:**
- Create: `data/characters.json`
- Create: `apps/backend/package.json`, `apps/backend/tsconfig.json`
- Create: `apps/backend/src/characters/power.ts`, `apps/backend/src/characters/source.ts`
- Test: `apps/backend/src/characters/characters.test.ts`

**Interfaces:**
- Consumes: `Character`, `characterSchema` from `@abb/shared`.
- Produces:
  - `computePower(character: Character): number`
  - `teamPower(team: readonly Character[]): number`
  - `interface CharacterSource { getAll(): Character[] }`
  - `class JsonCharacterSource implements CharacterSource` with `constructor(characters: unknown)` (validates, throws on bad/duplicate data) and `static fromDefaultFile(): JsonCharacterSource`

- [ ] **Step 1: Create the backend package files**

`apps/backend/package.json`:
```json
{
  "name": "@abb/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@abb/shared": "*",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "socket.io": "^4.8.0",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "socket.io-client": "^4.8.0"
  }
}
```

`apps/backend/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

Run: `npm install`
Expected: completes without errors.

- [ ] **Step 2: Create the character data**

`data/characters.json` (power values are placeholders; the formula will change later):
```json
[
  { "id": "naruto-uzumaki", "name": "Naruto Uzumaki", "anime": "Naruto", "power": 88 },
  { "id": "sasuke-uchiha", "name": "Sasuke Uchiha", "anime": "Naruto", "power": 86 },
  { "id": "kakashi-hatake", "name": "Kakashi Hatake", "anime": "Naruto", "power": 78 },
  { "id": "monkey-d-luffy", "name": "Monkey D. Luffy", "anime": "One Piece", "power": 90 },
  { "id": "roronoa-zoro", "name": "Roronoa Zoro", "anime": "One Piece", "power": 84 },
  { "id": "sanji", "name": "Sanji", "anime": "One Piece", "power": 76 },
  { "id": "son-goku", "name": "Son Goku", "anime": "Dragon Ball", "power": 98 },
  { "id": "vegeta", "name": "Vegeta", "anime": "Dragon Ball", "power": 92 },
  { "id": "son-gohan", "name": "Son Gohan", "anime": "Dragon Ball", "power": 85 },
  { "id": "ichigo-kurosaki", "name": "Ichigo Kurosaki", "anime": "Bleach", "power": 87 },
  { "id": "rukia-kuchiki", "name": "Rukia Kuchiki", "anime": "Bleach", "power": 66 },
  { "id": "eren-yeager", "name": "Eren Yeager", "anime": "Attack on Titan", "power": 82 },
  { "id": "levi-ackerman", "name": "Levi Ackerman", "anime": "Attack on Titan", "power": 85 },
  { "id": "mikasa-ackerman", "name": "Mikasa Ackerman", "anime": "Attack on Titan", "power": 75 },
  { "id": "tanjiro-kamado", "name": "Tanjiro Kamado", "anime": "Demon Slayer", "power": 74 },
  { "id": "nezuko-kamado", "name": "Nezuko Kamado", "anime": "Demon Slayer", "power": 68 },
  { "id": "zenitsu-agatsuma", "name": "Zenitsu Agatsuma", "anime": "Demon Slayer", "power": 70 },
  { "id": "izuku-midoriya", "name": "Izuku Midoriya", "anime": "My Hero Academia", "power": 80 },
  { "id": "katsuki-bakugo", "name": "Katsuki Bakugo", "anime": "My Hero Academia", "power": 77 },
  { "id": "shoto-todoroki", "name": "Shoto Todoroki", "anime": "My Hero Academia", "power": 79 },
  { "id": "satoru-gojo", "name": "Satoru Gojo", "anime": "Jujutsu Kaisen", "power": 97 },
  { "id": "yuji-itadori", "name": "Yuji Itadori", "anime": "Jujutsu Kaisen", "power": 72 },
  { "id": "megumi-fushiguro", "name": "Megumi Fushiguro", "anime": "Jujutsu Kaisen", "power": 69 },
  { "id": "light-yagami", "name": "Light Yagami", "anime": "Death Note", "power": 40 },
  { "id": "l-lawliet", "name": "L", "anime": "Death Note", "power": 38 },
  { "id": "edward-elric", "name": "Edward Elric", "anime": "Fullmetal Alchemist", "power": 73 },
  { "id": "alphonse-elric", "name": "Alphonse Elric", "anime": "Fullmetal Alchemist", "power": 65 },
  { "id": "saitama", "name": "Saitama", "anime": "One Punch Man", "power": 100 },
  { "id": "genos", "name": "Genos", "anime": "One Punch Man", "power": 71 },
  { "id": "killua-zoldyck", "name": "Killua Zoldyck", "anime": "Hunter x Hunter", "power": 83 },
  { "id": "gon-freecss", "name": "Gon Freecss", "anime": "Hunter x Hunter", "power": 78 },
  { "id": "lelouch-lamperouge", "name": "Lelouch Lamperouge", "anime": "Code Geass", "power": 45 }
]
```

- [ ] **Step 3: Write the failing test**

`apps/backend/src/characters/characters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Character } from '@abb/shared';
import { computePower, teamPower } from './power';
import { JsonCharacterSource } from './source';

const a: Character = { id: 'a', name: 'A', anime: 'X', power: 10 };
const b: Character = { id: 'b', name: 'B', anime: 'X', power: 25 };

describe('power', () => {
  it('computePower returns the character power', () => {
    expect(computePower(a)).toBe(10);
  });

  it('teamPower sums computePower over the team and is 0 for an empty team', () => {
    expect(teamPower([a, b])).toBe(35);
    expect(teamPower([])).toBe(0);
  });
});

describe('JsonCharacterSource', () => {
  it('loads and validates the default data file', () => {
    const all = JsonCharacterSource.fromDefaultFile().getAll();
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  it('rejects duplicate ids', () => {
    expect(() => new JsonCharacterSource([a, a])).toThrow(/duplicate/i);
  });

  it('rejects invalid entries', () => {
    expect(() => new JsonCharacterSource([{ id: 'x' }])).toThrow();
    expect(() => new JsonCharacterSource('nope')).toThrow();
  });

  it('getAll returns a copy', () => {
    const source = new JsonCharacterSource([a, b]);
    source.getAll().pop();
    expect(source.getAll()).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run apps/backend/src/characters`
Expected: FAIL — cannot resolve `./power` / `./source`.

- [ ] **Step 5: Implement**

`apps/backend/src/characters/power.ts`:
```ts
import type { Character } from '@abb/shared';

/** The single place that decides how strong a character is. Replace the body to change the formula. */
export function computePower(character: Character): number {
  return character.power;
}

export function teamPower(team: readonly Character[]): number {
  return team.reduce((sum, character) => sum + computePower(character), 0);
}
```

`apps/backend/src/characters/source.ts`:
```ts
import { readFileSync } from 'node:fs';
import { characterSchema, type Character } from '@abb/shared';
import { z } from 'zod';

export interface CharacterSource {
  getAll(): Character[];
}

export class JsonCharacterSource implements CharacterSource {
  private readonly characters: Character[];

  constructor(raw: unknown) {
    const characters = z.array(characterSchema).parse(raw);
    const ids = new Set<string>();
    for (const character of characters) {
      if (ids.has(character.id)) {
        throw new Error(`Duplicate character id: ${character.id}`);
      }
      ids.add(character.id);
    }
    this.characters = characters;
  }

  static fromDefaultFile(): JsonCharacterSource {
    const url = new URL('../../../../data/characters.json', import.meta.url);
    return new JsonCharacterSource(JSON.parse(readFileSync(url, 'utf8')));
  }

  getAll(): Character[] {
    return [...this.characters];
  }
}
```

Note: `zod` is imported directly here; add it to the backend dependencies by running `npm install zod@^3.23.8 -w @abb/backend`.

- [ ] **Step 6: Run the tests**

Run: `npm install zod@^3.23.8 -w @abb/backend`
Run: `npx vitest run apps/backend/src/characters`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add data apps/backend package.json package-lock.json
git commit -m "feat: add character data, source and power calculation"
```

---

### Task 3: Auction modes (interface + open ascending)

**Files:**
- Create: `apps/backend/src/auction/types.ts`, `openAscending.ts`, `index.ts`
- Test: `apps/backend/src/auction/openAscending.test.ts`

**Interfaces:**
- Consumes: `Character`, `AuctionBidView`, `AuctionModeName`, `ErrorCode` from `@abb/shared`.
- Produces:
  - `interface AuctionState { character: Character; price: number; leaderId: string | null; endsAt: number; status: AuctionStatus }` (`price` is 0 until the first bid)
  - `interface BidInput { playerId: string; coins: number; amount: number }`
  - `type BidResult = { ok: true; state: AuctionState } | { ok: false; code: ErrorCode }`
  - `interface AuctionMode { readonly name: AuctionModeName; start(character, roundSeconds, now): AuctionState; placeBid(state, bid, now): BidResult; onTimerExpired(state): AuctionState; getPublicView(state, viewerId): AuctionBidView }`
  - `class OpenAscendingAuction implements AuctionMode` (`constructor(snipeWindowMs = 5000)`), constants `START_PRICE = 1`, `DEFAULT_SNIPE_WINDOW_MS = 5000`
  - `type AuctionModeRegistry = Record<AuctionModeName, AuctionMode>`, `createAuctionModes(): AuctionModeRegistry`

- [ ] **Step 1: Write the failing test**

`apps/backend/src/auction/openAscending.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Character } from '@abb/shared';
import { OpenAscendingAuction } from './openAscending';
import type { AuctionState, BidResult } from './types';

const character: Character = { id: 'a', name: 'A', anime: 'X', power: 10 };
const mode = new OpenAscendingAuction(5000);

function started(now = 0): AuctionState {
  return mode.start(character, 10, now);
}

function accepted(result: BidResult): AuctionState {
  if (!result.ok) throw new Error(`expected accepted bid, got ${result.code}`);
  return result.state;
}

function rejectedCode(result: BidResult): string {
  if (result.ok) throw new Error('expected rejected bid');
  return result.code;
}

describe('OpenAscendingAuction', () => {
  it('starts open with no leader and the timer set', () => {
    const state = started(1000);
    expect(state).toMatchObject({ price: 0, leaderId: null, endsAt: 11000, status: 'OPEN' });
  });

  it('accepts a first bid of 1 and rejects 0', () => {
    expect(accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 1 }, 100)).price).toBe(1);
    expect(rejectedCode(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 0 }, 100))).toBe('BID_TOO_LOW');
  });

  it('requires later bids to beat the price by at least 1', () => {
    const afterFirst = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 10 }, 100));
    expect(rejectedCode(mode.placeBid(afterFirst, { playerId: 'p2', coins: 100, amount: 10 }, 200))).toBe('BID_TOO_LOW');
    expect(rejectedCode(mode.placeBid(afterFirst, { playerId: 'p2', coins: 100, amount: 9 }, 200))).toBe('BID_TOO_LOW');
    const afterSecond = accepted(mode.placeBid(afterFirst, { playerId: 'p2', coins: 100, amount: 11 }, 200));
    expect(afterSecond).toMatchObject({ price: 11, leaderId: 'p2' });
  });

  it('accepts only the first of two same-price bids', () => {
    const base = started();
    const first = accepted(mode.placeBid(base, { playerId: 'p1', coins: 100, amount: 20 }, 100));
    expect(rejectedCode(mode.placeBid(first, { playerId: 'p2', coins: 100, amount: 20 }, 100))).toBe('BID_TOO_LOW');
    expect(first.leaderId).toBe('p1');
  });

  it('rejects a bid above the bidder coins', () => {
    expect(rejectedCode(mode.placeBid(started(), { playerId: 'p1', coins: 50, amount: 51 }, 100))).toBe('INSUFFICIENT_COINS');
  });

  it('does not let the leader outbid themselves', () => {
    const led = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 100));
    expect(rejectedCode(mode.placeBid(led, { playerId: 'p1', coins: 100, amount: 6 }, 200))).toBe('ALREADY_LEADING');
  });

  it('rejects bids at or after endsAt and after resolution', () => {
    expect(rejectedCode(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 10000))).toBe('AUCTION_CLOSED');
    const resolved = mode.onTimerExpired(started());
    expect(rejectedCode(mode.placeBid(resolved, { playerId: 'p1', coins: 100, amount: 5 }, 1))).toBe('AUCTION_CLOSED');
  });

  it('extends the timer to the snipe window when under 5 seconds remain', () => {
    const state = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 8000));
    expect(state.endsAt).toBe(13000);
  });

  it('leaves the timer alone when plenty of time remains', () => {
    const state = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 1000));
    expect(state.endsAt).toBe(10000);
  });

  it('resolves to SOLD with a leader and UNSOLD without', () => {
    const led = accepted(mode.placeBid(started(), { playerId: 'p1', coins: 100, amount: 5 }, 100));
    expect(mode.onTimerExpired(led)).toMatchObject({ status: 'SOLD', leaderId: 'p1', price: 5 });
    expect(mode.onTimerExpired(started())).toMatchObject({ status: 'UNSOLD', leaderId: null });
  });

  it('exposes a public view with the bid fields', () => {
    expect(mode.getPublicView(started(), 'p1')).toMatchObject({ character, price: 0, status: 'OPEN' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/backend/src/auction`
Expected: FAIL — cannot resolve `./openAscending`.

- [ ] **Step 3: Implement**

`apps/backend/src/auction/types.ts`:
```ts
import type {
  AuctionBidView,
  AuctionModeName,
  AuctionStatus,
  Character,
  ErrorCode,
} from '@abb/shared';

export interface AuctionState {
  character: Character;
  /** Highest accepted bid; 0 until the first bid. */
  price: number;
  leaderId: string | null;
  endsAt: number;
  status: AuctionStatus;
}

export interface BidInput {
  playerId: string;
  coins: number;
  amount: number;
}

export type BidResult = { ok: true; state: AuctionState } | { ok: false; code: ErrorCode };

export interface AuctionMode {
  readonly name: AuctionModeName;
  start(character: Character, roundSeconds: number, now: number): AuctionState;
  placeBid(state: AuctionState, bid: BidInput, now: number): BidResult;
  onTimerExpired(state: AuctionState): AuctionState;
  getPublicView(state: AuctionState, viewerId: string): AuctionBidView;
}
```

`apps/backend/src/auction/openAscending.ts`:
```ts
import type { AuctionBidView, Character } from '@abb/shared';
import type { AuctionMode, AuctionState, BidInput, BidResult } from './types';

export const START_PRICE = 1;
export const DEFAULT_SNIPE_WINDOW_MS = 5000;

export class OpenAscendingAuction implements AuctionMode {
  readonly name = 'open-ascending' as const;

  constructor(private readonly snipeWindowMs: number = DEFAULT_SNIPE_WINDOW_MS) {}

  start(character: Character, roundSeconds: number, now: number): AuctionState {
    return {
      character,
      price: 0,
      leaderId: null,
      endsAt: now + roundSeconds * 1000,
      status: 'OPEN',
    };
  }

  placeBid(state: AuctionState, bid: BidInput, now: number): BidResult {
    if (state.status !== 'OPEN' || now >= state.endsAt) {
      return { ok: false, code: 'AUCTION_CLOSED' };
    }
    if (state.leaderId === bid.playerId) {
      return { ok: false, code: 'ALREADY_LEADING' };
    }
    const minimum = state.leaderId === null ? START_PRICE : state.price + 1;
    if (!Number.isInteger(bid.amount) || bid.amount < minimum) {
      return { ok: false, code: 'BID_TOO_LOW' };
    }
    if (bid.amount > bid.coins) {
      return { ok: false, code: 'INSUFFICIENT_COINS' };
    }
    return {
      ok: true,
      state: {
        ...state,
        price: bid.amount,
        leaderId: bid.playerId,
        endsAt: Math.max(state.endsAt, now + this.snipeWindowMs),
      },
    };
  }

  onTimerExpired(state: AuctionState): AuctionState {
    if (state.status !== 'OPEN') return state;
    return { ...state, status: state.leaderId === null ? 'UNSOLD' : 'SOLD' };
  }

  getPublicView(state: AuctionState): AuctionBidView {
    return {
      character: state.character,
      price: state.price,
      leaderId: state.leaderId,
      endsAt: state.endsAt,
      status: state.status,
    };
  }
}
```

`apps/backend/src/auction/index.ts`:
```ts
import type { AuctionModeName } from '@abb/shared';
import { OpenAscendingAuction } from './openAscending';
import type { AuctionMode } from './types';

export * from './types';
export { OpenAscendingAuction, START_PRICE, DEFAULT_SNIPE_WINDOW_MS } from './openAscending';

export type AuctionModeRegistry = Record<AuctionModeName, AuctionMode>;

export function createAuctionModes(): AuctionModeRegistry {
  return { 'open-ascending': new OpenAscendingAuction() };
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run apps/backend/src/auction`
Expected: PASS (11 tests).

Run: `npm run typecheck -w @abb/backend`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auction
git commit -m "feat: add AuctionMode interface and open ascending auction"
```

---

### Task 4: Game state machine (pure)

**Files:**
- Create: `apps/backend/src/game/types.ts`, `game.ts`, `view.ts`
- Test: `apps/backend/src/game/game.test.ts`

**Interfaces:**
- Consumes: Task 1 shared types/`GameError`/constants; Task 2 `teamPower`; Task 3 `AuctionModeRegistry`, `AuctionState`.
- Produces (all in `game/`; functions mutate the passed `Room` and throw `GameError` on rule violations):
  - `interface Player { id; nickname; rejoinToken; coins; team: Character[]; connected: boolean }`
  - `interface Room { code; hostId; settings: RoomSettings; players: Player[]; phase: Phase; deck: Character[]; roundIndex: number; auction: AuctionState | null; results: BattleResult[] | null }`
  - `makePlayer(id, nickname, rejoinToken): Player`
  - `createRoom(code, host, settings): Room`
  - `validateSettings(settings, bounds, characterCount): void`
  - `addPlayer(room, player): void`
  - `updateSettings(room, actorId, patch, bounds, characterCount): void`
  - `startGame(room, actorId, characters, modes, random, now): void`
  - `placeBid(room, playerId, amount, modes, now): void`
  - `resolveRound(room, modes): void`
  - `advanceRound(room, modes, now): Phase` (returns the new phase: `'AUCTION'` or `'BATTLE'`)
  - `showResults(room): void`
  - `playAgain(room, actorId): void`
  - `markConnection(room, playerId, connected): void`
  - `rankPlayers(players): BattleResult[]`, `shuffle(items, random)`
  - `getRoomView(room, viewerId, modes, now): RoomView` (in `view.ts`)

- [ ] **Step 1: Write the failing test**

`apps/backend/src/game/game.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  GameError,
  SETTINGS_BOUNDS,
  type Character,
  type RoomSettings,
} from '@abb/shared';
import { createAuctionModes } from '../auction';
import {
  addPlayer,
  advanceRound,
  createRoom,
  makePlayer,
  markConnection,
  placeBid,
  playAgain,
  rankPlayers,
  resolveRound,
  showResults,
  startGame,
  updateSettings,
} from './game';
import { getRoomView } from './view';

const modes = createAuctionModes();
const characters: Character[] = [
  { id: 'a', name: 'A', anime: 'X', power: 10 },
  { id: 'b', name: 'B', anime: 'X', power: 30 },
  { id: 'c', name: 'C', anime: 'X', power: 20 },
];
const settings: RoomSettings = {
  ...DEFAULT_SETTINGS,
  maxPlayers: 3,
  startingCoins: 100,
  rounds: 2,
  roundSeconds: 10,
};
// random() just below 1 makes the shuffle keep the original order => deck = [a, b]
const keepOrder = () => 0.999999;

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof GameError ? err.code : 'NOT_A_GAME_ERROR';
  }
  return undefined;
}

function lobby() {
  const alice = makePlayer('p1', 'Alice', 't1');
  const bob = makePlayer('p2', 'Bob', 't2');
  const room = createRoom('ABCDE', alice, settings);
  addPlayer(room, bob);
  return { room, alice, bob };
}

function started(now = 0) {
  const ctx = lobby();
  startGame(ctx.room, 'p1', characters, modes, keepOrder, now);
  return ctx;
}

describe('addPlayer', () => {
  it('rejects duplicate nicknames ignoring case', () => {
    const { room } = lobby();
    expect(codeOf(() => addPlayer(room, makePlayer('p3', 'aLiCe', 't3')))).toBe('NICKNAME_TAKEN');
  });

  it('rejects joining a full room', () => {
    const { room } = lobby();
    addPlayer(room, makePlayer('p3', 'Cara', 't3'));
    expect(codeOf(() => addPlayer(room, makePlayer('p4', 'Dan', 't4')))).toBe('ROOM_FULL');
  });

  it('rejects joining after the game started', () => {
    const { room } = started();
    expect(codeOf(() => addPlayer(room, makePlayer('p3', 'Cara', 't3')))).toBe('WRONG_PHASE');
  });
});

describe('updateSettings', () => {
  it('lets only the host change settings, only in the lobby', () => {
    const { room } = lobby();
    expect(codeOf(() => updateSettings(room, 'p2', { rounds: 1 }, SETTINGS_BOUNDS, 3))).toBe('NOT_HOST');
    updateSettings(room, 'p1', { rounds: 1 }, SETTINGS_BOUNDS, 3);
    expect(room.settings.rounds).toBe(1);
    startGame(room, 'p1', characters, modes, keepOrder, 0);
    expect(codeOf(() => updateSettings(room, 'p1', { rounds: 2 }, SETTINGS_BOUNDS, 3))).toBe('WRONG_PHASE');
  });

  it('rejects out-of-bounds values, too many rounds, and maxPlayers below current players', () => {
    const { room } = lobby();
    expect(codeOf(() => updateSettings(room, 'p1', { roundSeconds: 1 }, SETTINGS_BOUNDS, 3))).toBe('INVALID_SETTINGS');
    expect(codeOf(() => updateSettings(room, 'p1', { rounds: 4 }, SETTINGS_BOUNDS, 3))).toBe('INVALID_SETTINGS');
    addPlayer(room, makePlayer('p3', 'Cara', 't3'));
    expect(codeOf(() => updateSettings(room, 'p1', { maxPlayers: 2 }, SETTINGS_BOUNDS, 3))).toBe('INVALID_SETTINGS');
  });
});

describe('startGame', () => {
  it('deals coins, builds the deck and opens round one', () => {
    const { room } = started(1000);
    expect(room.phase).toBe('AUCTION');
    expect(room.players.every((p) => p.coins === 100 && p.team.length === 0)).toBe(true);
    expect(room.deck.map((c) => c.id)).toEqual(['a', 'b']);
    expect(room.auction).toMatchObject({ status: 'OPEN', endsAt: 11000 });
    expect(room.auction?.character.id).toBe('a');
  });

  it('requires the host, two players, and the lobby phase', () => {
    const { room } = lobby();
    expect(codeOf(() => startGame(room, 'p2', characters, modes, keepOrder, 0))).toBe('NOT_HOST');
    const solo = createRoom('SOLO1', makePlayer('p1', 'Alice', 't1'), settings);
    expect(codeOf(() => startGame(solo, 'p1', characters, modes, keepOrder, 0))).toBe('NOT_ENOUGH_PLAYERS');
    startGame(room, 'p1', characters, modes, keepOrder, 0);
    expect(codeOf(() => startGame(room, 'p1', characters, modes, keepOrder, 0))).toBe('WRONG_PHASE');
  });
});

describe('placeBid', () => {
  it('records an accepted bid and rejects a lower one with the mode error code', () => {
    const { room } = started();
    placeBid(room, 'p1', 30, modes, 100);
    expect(room.auction).toMatchObject({ price: 30, leaderId: 'p1' });
    expect(codeOf(() => placeBid(room, 'p2', 30, modes, 100))).toBe('BID_TOO_LOW');
  });

  it('is rejected outside the auction phase and for unknown players', () => {
    const { room } = lobby();
    expect(codeOf(() => placeBid(room, 'p1', 5, modes, 0))).toBe('WRONG_PHASE');
    const live = started().room;
    expect(codeOf(() => placeBid(live, 'ghost', 5, modes, 0))).toBe('NOT_IN_ROOM');
  });
});

describe('resolveRound and advanceRound', () => {
  it('charges the winner and gives them the character', () => {
    const { room } = started();
    placeBid(room, 'p1', 30, modes, 100);
    resolveRound(room, modes);
    expect(room.auction?.status).toBe('SOLD');
    const alice = room.players[0]!;
    expect(alice.coins).toBe(70);
    expect(alice.team.map((c) => c.id)).toEqual(['a']);
  });

  it('charges nobody when nobody bid', () => {
    const { room } = started();
    resolveRound(room, modes);
    expect(room.auction?.status).toBe('UNSOLD');
    expect(room.players.every((p) => p.coins === 100 && p.team.length === 0)).toBe(true);
  });

  it('resolving twice does not charge twice', () => {
    const { room } = started();
    placeBid(room, 'p1', 30, modes, 100);
    resolveRound(room, modes);
    resolveRound(room, modes);
    expect(room.players[0]!.coins).toBe(70);
  });

  it('refuses to advance while the round is still open', () => {
    const { room } = started();
    expect(codeOf(() => advanceRound(room, modes, 0))).toBe('WRONG_PHASE');
  });

  it('starts the next round, then enters BATTLE with ranked results after the last one', () => {
    const { room } = started();
    placeBid(room, 'p1', 30, modes, 100);
    resolveRound(room, modes);
    expect(advanceRound(room, modes, 5000)).toBe('AUCTION');
    expect(room.roundIndex).toBe(1);
    expect(room.auction?.character.id).toBe('b');
    placeBid(room, 'p2', 10, modes, 5100);
    resolveRound(room, modes);
    expect(advanceRound(room, modes, 20000)).toBe('BATTLE');
    expect(room.phase).toBe('BATTLE');
    expect(room.auction).toBeNull();
    expect(room.results).toEqual([
      { playerId: 'p2', nickname: 'Bob', totalPower: 30, rank: 1 },
      { playerId: 'p1', nickname: 'Alice', totalPower: 10, rank: 2 },
    ]);
    showResults(room);
    expect(room.phase).toBe('RESULTS');
  });
});

describe('rankPlayers', () => {
  it('gives tied players the same rank', () => {
    const players = [makePlayer('p1', 'Alice', 't1'), makePlayer('p2', 'Bob', 't2')];
    expect(rankPlayers(players).map((r) => r.rank)).toEqual([1, 1]);
  });
});

describe('playAgain', () => {
  it('resets players and returns to the lobby, host only', () => {
    const { room } = started();
    placeBid(room, 'p1', 30, modes, 100);
    resolveRound(room, modes);
    advanceRound(room, modes, 5000);
    resolveRound(room, modes);
    advanceRound(room, modes, 20000);
    showResults(room);
    expect(codeOf(() => playAgain(room, 'p2'))).toBe('NOT_HOST');
    playAgain(room, 'p1');
    expect(room.phase).toBe('LOBBY');
    expect(room.results).toBeNull();
    expect(room.players.every((p) => p.team.length === 0)).toBe(true);
  });

  it('is rejected before the results are shown', () => {
    const { room } = started();
    expect(codeOf(() => playAgain(room, 'p1'))).toBe('WRONG_PHASE');
  });
});

describe('markConnection', () => {
  it('moves host rights to the next connected player when the host disconnects', () => {
    const { room } = lobby();
    markConnection(room, 'p1', false);
    expect(room.hostId).toBe('p2');
    markConnection(room, 'p1', true);
    expect(room.hostId).toBe('p2');
  });

  it('keeps the host when nobody else is connected', () => {
    const { room } = lobby();
    markConnection(room, 'p2', false);
    markConnection(room, 'p1', false);
    expect(room.hostId).toBe('p1');
  });
});

describe('getRoomView', () => {
  it('shapes a per-viewer view and never leaks rejoin tokens', () => {
    const { room } = started();
    placeBid(room, 'p1', 30, modes, 100);
    const view = getRoomView(room, 'p2', modes, 1234);
    expect(view).toMatchObject({
      code: 'ABCDE',
      phase: 'AUCTION',
      youId: 'p2',
      serverNow: 1234,
      hostId: 'p1',
    });
    expect(view.auction).toMatchObject({ price: 30, leaderId: 'p1', roundIndex: 0, totalRounds: 2 });
    expect(view.players.find((p) => p.id === 'p1')?.isHost).toBe(true);
    const json = JSON.stringify(view);
    expect(json).not.toContain('t1');
    expect(json).not.toContain('rejoinToken');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/backend/src/game`
Expected: FAIL — cannot resolve `./game`.

- [ ] **Step 3: Implement**

`apps/backend/src/game/types.ts`:
```ts
import type { BattleResult, Character, Phase, RoomSettings } from '@abb/shared';
import type { AuctionState } from '../auction';

export interface Player {
  id: string;
  nickname: string;
  rejoinToken: string;
  coins: number;
  team: Character[];
  connected: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  settings: RoomSettings;
  players: Player[];
  phase: Phase;
  deck: Character[];
  roundIndex: number;
  auction: AuctionState | null;
  results: BattleResult[] | null;
}
```

`apps/backend/src/game/game.ts`:
```ts
import {
  GameError,
  MIN_PLAYERS_TO_START,
  type BattleResult,
  type Character,
  type Phase,
  type RoomSettings,
  type SettingsBounds,
} from '@abb/shared';
import type { AuctionModeRegistry } from '../auction';
import { teamPower } from '../characters/power';
import type { Player, Room } from './types';

export function makePlayer(id: string, nickname: string, rejoinToken: string): Player {
  return { id, nickname, rejoinToken, coins: 0, team: [], connected: true };
}

export function createRoom(code: string, host: Player, settings: RoomSettings): Room {
  return {
    code,
    hostId: host.id,
    settings,
    players: [host],
    phase: 'LOBBY',
    deck: [],
    roundIndex: 0,
    auction: null,
    results: null,
  };
}

export function validateSettings(
  settings: RoomSettings,
  bounds: SettingsBounds,
  characterCount: number,
): void {
  for (const key of ['maxPlayers', 'startingCoins', 'rounds', 'roundSeconds'] as const) {
    const value = settings[key];
    const { min, max } = bounds[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new GameError('INVALID_SETTINGS', `${key} must be an integer between ${min} and ${max}`);
    }
  }
  if (settings.rounds > characterCount) {
    throw new GameError('INVALID_SETTINGS', `rounds cannot exceed ${characterCount} available characters`);
  }
}

function requireHost(room: Room, actorId: string): void {
  if (room.hostId !== actorId) throw new GameError('NOT_HOST', 'Only the host can do that');
}

export function addPlayer(room: Room, player: Player): void {
  if (room.phase !== 'LOBBY') throw new GameError('WRONG_PHASE', 'The game has already started');
  if (room.players.length >= room.settings.maxPlayers) throw new GameError('ROOM_FULL', 'Room is full');
  const taken = room.players.some((p) => p.nickname.toLowerCase() === player.nickname.toLowerCase());
  if (taken) throw new GameError('NICKNAME_TAKEN', 'That nickname is already in use');
  room.players.push(player);
}

export function updateSettings(
  room: Room,
  actorId: string,
  patch: Partial<RoomSettings>,
  bounds: SettingsBounds,
  characterCount: number,
): void {
  requireHost(room, actorId);
  if (room.phase !== 'LOBBY') throw new GameError('WRONG_PHASE', 'Settings can only change in the lobby');
  const next: RoomSettings = { ...room.settings, ...patch };
  validateSettings(next, bounds, characterCount);
  if (next.maxPlayers < room.players.length) {
    throw new GameError('INVALID_SETTINGS', 'maxPlayers is below the current number of players');
  }
  room.settings = next;
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function startGame(
  room: Room,
  actorId: string,
  characters: readonly Character[],
  modes: AuctionModeRegistry,
  random: () => number,
  now: number,
): void {
  requireHost(room, actorId);
  if (room.phase !== 'LOBBY') throw new GameError('WRONG_PHASE', 'The game has already started');
  if (room.players.length < MIN_PLAYERS_TO_START) {
    throw new GameError('NOT_ENOUGH_PLAYERS', `Need at least ${MIN_PLAYERS_TO_START} players`);
  }
  if (characters.length < room.settings.rounds) {
    throw new GameError('INVALID_SETTINGS', 'Not enough characters for the chosen number of rounds');
  }
  for (const player of room.players) {
    player.coins = room.settings.startingCoins;
    player.team = [];
  }
  room.deck = shuffle(characters, random).slice(0, room.settings.rounds);
  room.roundIndex = 0;
  room.results = null;
  room.phase = 'AUCTION';
  room.auction = modes[room.settings.auctionMode].start(room.deck[0]!, room.settings.roundSeconds, now);
}

export function placeBid(
  room: Room,
  playerId: string,
  amount: number,
  modes: AuctionModeRegistry,
  now: number,
): void {
  if (room.phase !== 'AUCTION' || !room.auction) throw new GameError('WRONG_PHASE', 'No auction in progress');
  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new GameError('NOT_IN_ROOM', 'You are not in this room');
  const result = modes[room.settings.auctionMode].placeBid(
    room.auction,
    { playerId, coins: player.coins, amount },
    now,
  );
  if (!result.ok) throw new GameError(result.code);
  room.auction = result.state;
}

export function resolveRound(room: Room, modes: AuctionModeRegistry): void {
  if (room.phase !== 'AUCTION' || !room.auction) throw new GameError('WRONG_PHASE', 'No auction in progress');
  if (room.auction.status !== 'OPEN') return;
  const resolved = modes[room.settings.auctionMode].onTimerExpired(room.auction);
  room.auction = resolved;
  if (resolved.status === 'SOLD' && resolved.leaderId !== null) {
    const winner = room.players.find((p) => p.id === resolved.leaderId);
    if (winner) {
      winner.coins -= resolved.price;
      winner.team.push(resolved.character);
    }
  }
}

export function rankPlayers(players: readonly Player[]): BattleResult[] {
  const totals = players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, totalPower: teamPower(p.team) }))
    .sort((a, b) => b.totalPower - a.totalPower);
  return totals.map((t) => ({
    ...t,
    rank: 1 + totals.filter((other) => other.totalPower > t.totalPower).length,
  }));
}

/** Moves to the next round, or to BATTLE after the last one. Returns the new phase. */
export function advanceRound(room: Room, modes: AuctionModeRegistry, now: number): Phase {
  if (room.phase !== 'AUCTION' || !room.auction || room.auction.status === 'OPEN') {
    throw new GameError('WRONG_PHASE', 'The current round is not finished');
  }
  const next = room.roundIndex + 1;
  if (next < room.deck.length) {
    room.roundIndex = next;
    room.auction = modes[room.settings.auctionMode].start(room.deck[next]!, room.settings.roundSeconds, now);
    return room.phase;
  }
  room.auction = null;
  room.results = rankPlayers(room.players);
  room.phase = 'BATTLE';
  return room.phase;
}

export function showResults(room: Room): void {
  if (room.phase !== 'BATTLE') throw new GameError('WRONG_PHASE', 'No battle to finish');
  room.phase = 'RESULTS';
}

export function playAgain(room: Room, actorId: string): void {
  requireHost(room, actorId);
  if (room.phase !== 'RESULTS') throw new GameError('WRONG_PHASE', 'The game is not finished');
  for (const player of room.players) {
    player.coins = 0;
    player.team = [];
  }
  room.deck = [];
  room.roundIndex = 0;
  room.auction = null;
  room.results = null;
  room.phase = 'LOBBY';
}

export function markConnection(room: Room, playerId: string, connected: boolean): void {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  player.connected = connected;
  if (!connected && room.hostId === playerId) {
    const successor = room.players.find((p) => p.connected && p.id !== playerId);
    if (successor) room.hostId = successor.id;
  }
}
```

`apps/backend/src/game/view.ts`:
```ts
import type { RoomView } from '@abb/shared';
import type { AuctionModeRegistry } from '../auction';
import type { Room } from './types';

export function getRoomView(
  room: Room,
  viewerId: string,
  modes: AuctionModeRegistry,
  now: number,
): RoomView {
  const mode = modes[room.settings.auctionMode];
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
      team: p.team,
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
    auction: room.auction
      ? {
          ...mode.getPublicView(room.auction, viewerId),
          roundIndex: room.roundIndex,
          totalRounds: room.deck.length,
        }
      : null,
    results: room.results,
  };
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run apps/backend/src/game`
Expected: PASS (all tests in `game.test.ts`).

Run: `npm run typecheck -w @abb/backend`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/game
git commit -m "feat: add pure game state machine and room view"
```

---

### Task 5: Room store and RoomService (timers, tokens, cleanup)

**Files:**
- Create: `apps/backend/src/rooms/store.ts`, `ids.ts`, `service.ts`
- Test: `apps/backend/src/rooms/service.test.ts`

**Interfaces:**
- Consumes: Task 4 game functions and types; Task 3 `AuctionModeRegistry`; shared `DEFAULT_SETTINGS`, `GameError`, `ROOM_CODE_LENGTH`.
- Produces:
  - `interface RoomStore { get(code: string): Room | undefined; set(room: Room): void; delete(code: string): void; has(code: string): boolean }`, `class InMemoryRoomStore implements RoomStore`
  - `generateRoomCode(isTaken: (code: string) => boolean, random: () => number): string`, `newId(): string`, `newToken(): string`
  - `interface RoomServiceConfig { characters: Character[]; store: RoomStore; auctionModes: AuctionModeRegistry; bounds: SettingsBounds; soldPauseMs: number; battlePauseMs: number; emptyRoomTtlMs: number; now: () => number; random: () => number; onRoomChanged: (room: Room) => void }`
  - `class RoomService` with: `createRoom(nickname, patch?) → { room, player }`, `joinRoom(code, nickname) → { room, player }`, `rejoin(code, token) → { room, player }`, `updateSettings(code, playerId, patch)`, `startGame(code, playerId)`, `placeBid(code, playerId, amount)`, `playAgain(code, playerId)`, `disconnect(code, playerId)`, `getRoom(code) → Room`, `viewFor(room, playerId) → RoomView`, `dispose()`. Every state change calls `config.onRoomChanged(room)`.

- [ ] **Step 1: Write the failing test**

`apps/backend/src/rooms/service.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameError, SETTINGS_BOUNDS, type Character, type RoomSettings } from '@abb/shared';
import { createAuctionModes } from '../auction';
import type { Room } from '../game/types';
import { InMemoryRoomStore } from './store';
import { generateRoomCode } from './ids';
import { RoomService } from './service';

const characters: Character[] = [
  { id: 'a', name: 'A', anime: 'X', power: 10 },
  { id: 'b', name: 'B', anime: 'X', power: 30 },
];
const settings: RoomSettings = {
  maxPlayers: 4,
  startingCoins: 100,
  rounds: 2,
  roundSeconds: 10,
  auctionMode: 'open-ascending',
};

let changes: Room[];
let service: RoomService;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  changes = [];
  service = new RoomService({
    characters,
    store: new InMemoryRoomStore(),
    auctionModes: createAuctionModes(),
    bounds: SETTINGS_BOUNDS,
    soldPauseMs: 1000,
    battlePauseMs: 1000,
    emptyRoomTtlMs: 60_000,
    now: () => Date.now(),
    random: () => 0, // shuffle => deck [b, a]
    onRoomChanged: (room) => changes.push(room),
  });
});

afterEach(() => {
  service.dispose();
  vi.useRealTimers();
});

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof GameError ? err.code : 'NOT_A_GAME_ERROR';
  }
  return undefined;
}

function startedGame() {
  const { room, player: alice } = service.createRoom('Alice', settings);
  const { player: bob } = service.joinRoom(room.code, 'Bob');
  service.startGame(room.code, alice.id);
  return { room, alice, bob };
}

describe('generateRoomCode', () => {
  it('returns a 5-character code that is not taken', () => {
    const taken = new Set<string>();
    const code = generateRoomCode((c) => taken.has(c), Math.random);
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
  });

  it('retries when a code is taken and fails after too many attempts', () => {
    let calls = 0;
    const code = generateRoomCode(() => ++calls < 3, Math.random);
    expect(code).toHaveLength(5);
    expect(() => generateRoomCode(() => true, Math.random)).toThrow();
  });
});

describe('RoomService lobby', () => {
  it('creates a room whose host is the creator and notifies listeners', () => {
    const { room, player } = service.createRoom('Alice', settings);
    expect(room.hostId).toBe(player.id);
    expect(service.getRoom(room.code)).toBe(room);
    expect(changes.length).toBeGreaterThan(0);
  });

  it('rejects invalid settings on create', () => {
    expect(codeOf(() => service.createRoom('Alice', { roundSeconds: 1 }))).toBe('INVALID_SETTINGS');
  });

  it('throws ROOM_NOT_FOUND for unknown rooms', () => {
    expect(codeOf(() => service.joinRoom('ZZZZZ', 'Bob'))).toBe('ROOM_NOT_FOUND');
  });
});

describe('RoomService rejoin', () => {
  it('returns the same player with coins and team intact', () => {
    const { room, alice, bob } = startedGame();
    service.placeBid(room.code, bob.id, 40);
    service.disconnect(room.code, bob.id);
    expect(room.players.find((p) => p.id === bob.id)?.connected).toBe(false);
    const rejoined = service.rejoin(room.code, bob.rejoinToken);
    expect(rejoined.player.id).toBe(bob.id);
    expect(rejoined.player.connected).toBe(true);
    expect(rejoined.player.coins).toBe(100);
    expect(service.viewFor(room, bob.id).youId).toBe(bob.id);
    expect(alice.id).not.toBe(bob.id);
  });

  it('rejects a wrong token', () => {
    const { room } = startedGame();
    expect(codeOf(() => service.rejoin(room.code, 'nope'))).toBe('INVALID_TOKEN');
  });
});

describe('RoomService game flow with timers', () => {
  it('plays a full game: sold, next round, battle, results', () => {
    const { room, alice, bob } = startedGame();
    expect(room.auction?.character.id).toBe('b');

    service.placeBid(room.code, alice.id, 30);
    vi.advanceTimersByTime(10_000);
    expect(room.auction?.status).toBe('SOLD');
    expect(room.players.find((p) => p.id === alice.id)?.coins).toBe(70);

    vi.advanceTimersByTime(1000);
    expect(room.roundIndex).toBe(1);
    expect(room.auction?.status).toBe('OPEN');

    service.placeBid(room.code, bob.id, 5);
    vi.advanceTimersByTime(10_000);
    vi.advanceTimersByTime(1000);
    expect(room.phase).toBe('BATTLE');

    vi.advanceTimersByTime(1000);
    expect(room.phase).toBe('RESULTS');
    expect(room.results?.[0]).toMatchObject({ playerId: alice.id, totalPower: 30, rank: 1 });
    expect(room.results?.[1]).toMatchObject({ playerId: bob.id, totalPower: 10, rank: 2 });
  });

  it('extends the round when a late bid arrives (anti-sniping)', () => {
    const { room, alice } = startedGame();
    vi.advanceTimersByTime(8000);
    service.placeBid(room.code, alice.id, 5);
    expect(room.auction?.endsAt).toBe(13_000);
    vi.advanceTimersByTime(2000); // t = 10s: original end, must still be open
    expect(room.auction?.status).toBe('OPEN');
    vi.advanceTimersByTime(3000); // t = 13s
    expect(room.auction?.status).toBe('SOLD');
  });

  it('leaves a round unsold when nobody bids', () => {
    const { room } = startedGame();
    vi.advanceTimersByTime(10_000);
    expect(room.auction?.status).toBe('UNSOLD');
    expect(room.players.every((p) => p.coins === 100)).toBe(true);
  });

  it('play again returns to the lobby', () => {
    const { room, alice } = startedGame();
    vi.advanceTimersByTime(10_000 + 1000 + 10_000 + 1000 + 1000);
    expect(room.phase).toBe('RESULTS');
    service.playAgain(room.code, alice.id);
    expect(room.phase).toBe('LOBBY');
  });
});

describe('RoomService cleanup', () => {
  it('deletes a room once everyone has been disconnected for the TTL', () => {
    const { room, alice, bob } = startedGame();
    service.disconnect(room.code, alice.id);
    service.disconnect(room.code, bob.id);
    vi.advanceTimersByTime(59_000);
    expect(service.getRoom(room.code)).toBe(room);
    vi.advanceTimersByTime(2000);
    expect(codeOf(() => service.getRoom(room.code))).toBe('ROOM_NOT_FOUND');
  });

  it('cancels deletion when a player rejoins', () => {
    const { room, alice, bob } = startedGame();
    service.disconnect(room.code, alice.id);
    service.disconnect(room.code, bob.id);
    service.rejoin(room.code, alice.rejoinToken);
    vi.advanceTimersByTime(120_000);
    expect(service.getRoom(room.code)).toBe(room);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/backend/src/rooms`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Implement**

`apps/backend/src/rooms/store.ts`:
```ts
import type { Room } from '../game/types';

export interface RoomStore {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  has(code: string): boolean;
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  set(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }
}
```

`apps/backend/src/rooms/ids.ts`:
```ts
import { randomBytes, randomUUID } from 'node:crypto';
import { ROOM_CODE_LENGTH } from '@abb/shared';

// No 0/O/1/I so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ATTEMPTS = 100;

export function generateRoomCode(isTaken: (code: string) => boolean, random: () => number): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(random() * ALPHABET.length)];
    }
    if (!isTaken(code)) return code;
  }
  throw new Error('Could not generate a free room code');
}

export const newId = (): string => randomUUID();
export const newToken = (): string => randomBytes(16).toString('hex');
```

`apps/backend/src/rooms/service.ts`:
```ts
import {
  DEFAULT_SETTINGS,
  GameError,
  type Character,
  type RoomSettings,
  type RoomView,
  type SettingsBounds,
} from '@abb/shared';
import type { AuctionModeRegistry } from '../auction';
import {
  addPlayer,
  advanceRound,
  createRoom,
  makePlayer,
  markConnection,
  placeBid,
  playAgain,
  resolveRound,
  showResults,
  startGame,
  updateSettings,
  validateSettings,
} from '../game/game';
import type { Player, Room } from '../game/types';
import { getRoomView } from '../game/view';
import { generateRoomCode, newId, newToken } from './ids';
import type { RoomStore } from './store';

export interface RoomServiceConfig {
  characters: Character[];
  store: RoomStore;
  auctionModes: AuctionModeRegistry;
  bounds: SettingsBounds;
  soldPauseMs: number;
  battlePauseMs: number;
  emptyRoomTtlMs: number;
  now: () => number;
  random: () => number;
  onRoomChanged: (room: Room) => void;
}

export class RoomService {
  /** One game timer per room: round end, then the pause after SOLD, then the battle pause. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly ttlTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly config: RoomServiceConfig) {}

  createRoom(nickname: string, patch: Partial<RoomSettings> = {}): { room: Room; player: Player } {
    const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...patch };
    validateSettings(settings, this.config.bounds, this.config.characters.length);
    const player = makePlayer(newId(), nickname, newToken());
    const code = generateRoomCode((c) => this.config.store.has(c), this.config.random);
    const room = createRoom(code, player, settings);
    this.config.store.set(room);
    this.emit(room);
    return { room, player };
  }

  joinRoom(code: string, nickname: string): { room: Room; player: Player } {
    const room = this.getRoom(code);
    const player = makePlayer(newId(), nickname, newToken());
    addPlayer(room, player);
    this.emit(room);
    return { room, player };
  }

  rejoin(code: string, rejoinToken: string): { room: Room; player: Player } {
    const room = this.getRoom(code);
    const player = room.players.find((p) => p.rejoinToken === rejoinToken);
    if (!player) throw new GameError('INVALID_TOKEN', 'Unknown player for this room');
    markConnection(room, player.id, true);
    this.clearTtl(room.code);
    this.emit(room);
    return { room, player };
  }

  updateSettings(code: string, playerId: string, patch: Partial<RoomSettings>): void {
    const room = this.getRoom(code);
    updateSettings(room, playerId, patch, this.config.bounds, this.config.characters.length);
    this.emit(room);
  }

  startGame(code: string, playerId: string): void {
    const room = this.getRoom(code);
    startGame(room, playerId, this.config.characters, this.config.auctionModes, this.config.random, this.config.now());
    this.scheduleRoundEnd(room);
    this.emit(room);
  }

  placeBid(code: string, playerId: string, amount: number): void {
    const room = this.getRoom(code);
    placeBid(room, playerId, amount, this.config.auctionModes, this.config.now());
    this.scheduleRoundEnd(room); // the bid may have extended endsAt
    this.emit(room);
  }

  playAgain(code: string, playerId: string): void {
    const room = this.getRoom(code);
    playAgain(room, playerId);
    this.emit(room);
  }

  disconnect(code: string, playerId: string): void {
    const room = this.config.store.get(code);
    if (!room) return;
    markConnection(room, playerId, false);
    this.emit(room);
    if (room.players.every((p) => !p.connected)) this.startTtl(room.code);
  }

  getRoom(code: string): Room {
    const room = this.config.store.get(code.toUpperCase());
    if (!room) throw new GameError('ROOM_NOT_FOUND', 'Room not found');
    return room;
  }

  viewFor(room: Room, playerId: string): RoomView {
    return getRoomView(room, playerId, this.config.auctionModes, this.config.now());
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const timer of this.ttlTimers.values()) clearTimeout(timer);
    this.timers.clear();
    this.ttlTimers.clear();
  }

  private emit(room: Room): void {
    this.config.onRoomChanged(room);
  }

  private setTimer(code: string, ms: number, fn: () => void): void {
    this.clearTimer(code);
    this.timers.set(code, setTimeout(fn, Math.max(0, ms)));
  }

  private clearTimer(code: string): void {
    const timer = this.timers.get(code);
    if (timer) clearTimeout(timer);
    this.timers.delete(code);
  }

  private startTtl(code: string): void {
    this.clearTtl(code);
    this.ttlTimers.set(
      code,
      setTimeout(() => this.deleteRoom(code), this.config.emptyRoomTtlMs),
    );
  }

  private clearTtl(code: string): void {
    const timer = this.ttlTimers.get(code);
    if (timer) clearTimeout(timer);
    this.ttlTimers.delete(code);
  }

  private deleteRoom(code: string): void {
    this.clearTimer(code);
    this.clearTtl(code);
    this.config.store.delete(code);
  }

  private scheduleRoundEnd(room: Room): void {
    if (!room.auction) return;
    this.setTimer(room.code, room.auction.endsAt - this.config.now(), () => this.onRoundExpired(room.code));
  }

  private onRoundExpired(code: string): void {
    const room = this.config.store.get(code);
    if (!room || room.phase !== 'AUCTION' || !room.auction) return;
    if (room.auction.status === 'OPEN' && this.config.now() < room.auction.endsAt) {
      this.scheduleRoundEnd(room); // timer fired early; wait for the real end
      return;
    }
    resolveRound(room, this.config.auctionModes);
    this.emit(room);
    this.setTimer(code, this.config.soldPauseMs, () => this.onAdvance(code));
  }

  private onAdvance(code: string): void {
    const room = this.config.store.get(code);
    if (!room || room.phase !== 'AUCTION') return;
    const phase = advanceRound(room, this.config.auctionModes, this.config.now());
    this.emit(room);
    if (phase === 'AUCTION') {
      this.scheduleRoundEnd(room);
    } else {
      this.setTimer(code, this.config.battlePauseMs, () => this.onShowResults(code));
    }
  }

  private onShowResults(code: string): void {
    const room = this.config.store.get(code);
    if (!room || room.phase !== 'BATTLE') return;
    showResults(room);
    this.emit(room);
  }
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run apps/backend/src/rooms`
Expected: PASS (all tests in `service.test.ts`).

Run: `npm run typecheck -w @abb/backend`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/rooms
git commit -m "feat: add RoomService with timers, rejoin and room cleanup"
```

---

### Task 6: Socket transport, app factory and integration test

**Files:**
- Create: `apps/backend/src/transport/errors.ts`, `apps/backend/src/transport/handlers.ts`
- Create: `apps/backend/src/app.ts`, `apps/backend/src/index.ts`, `apps/backend/.env.example`
- Test: `apps/backend/src/integration.test.ts`

**Interfaces:**
- Consumes: `RoomService` (Task 5); shared protocol/schemas; `createAuctionModes`, `OpenAscendingAuction`; `JsonCharacterSource`.
- Produces:
  - `toErrorPayload(err: unknown): ErrorPayload`
  - `registerHandlers(io: AppServer, socket: AppSocket, service: RoomService): void`
  - `interface AppConfig { characters: Character[]; corsOrigins: string[]; bounds?: SettingsBounds; auctionModes?: AuctionModeRegistry; soldPauseMs?: number; battlePauseMs?: number; emptyRoomTtlMs?: number }`
  - `createApp(config: AppConfig): { httpServer: http.Server; io: AppServer; service: RoomService; close(): Promise<void> }`
  - Socket behaviour: every intent is acked with `{ ok: true, ...result }` or `{ ok: false, error }` (and a failure also emits `error`); each player's sockets join channel `player:<id>`; every room change sends each player their own `room:state`.

- [ ] **Step 1: Write the failing integration test**

`apps/backend/src/integration.test.ts`:
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
  { id: 'a', name: 'A', anime: 'X', power: 10 },
  { id: 'b', name: 'B', anime: 'X', power: 30 },
];
const roomSettings = {
  maxPlayers: 4,
  startingCoins: 1000,
  rounds: 2,
  roundSeconds: 1,
  auctionMode: 'open-ascending' as const,
};

let app: ReturnType<typeof createApp>;
let port: number;
let open: Client[];

beforeEach(async () => {
  app = createApp({
    characters,
    corsOrigins: ['*'],
    bounds: { ...SETTINGS_BOUNDS, roundSeconds: { min: 1, max: 60 } },
    auctionModes: { 'open-ascending': new OpenAscendingAuction(100) },
    soldPauseMs: 50,
    battlePauseMs: 50,
    emptyRoomTtlMs: 60_000,
  });
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  port = (app.httpServer.address() as AddressInfo).port;
  open = [];
});

afterEach(async () => {
  for (const client of open) client.disconnect();
  await app.close();
});

function track(client: Client) {
  let latest: RoomView | undefined;
  const listeners = new Set<() => void>();
  client.on('room:state', (state) => {
    latest = state;
    for (const listener of [...listeners]) listener();
  });
  return {
    get latest() {
      return latest;
    },
    until(predicate: (s: RoomView) => boolean, timeoutMs = 8000): Promise<RoomView> {
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          listeners.delete(check);
        };
        const check = () => {
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
  const tracker = track(client);
  await new Promise<void>((resolve) => client.on('connect', resolve));
  return { client, tracker };
}

function call<R = Ack>(client: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<R> {
  return new Promise((resolve) => {
    (client as unknown as { emit: (...args: unknown[]) => void }).emit(event, payload, resolve);
  });
}

function errorCode(res: Ack): string | undefined {
  return res.ok ? undefined : res.error.code;
}

async function twoPlayerLobby() {
  const alice = await connect();
  const created = await call<Ack<JoinResult>>(alice.client, 'room:create', {
    nickname: 'Alice',
    settings: roomSettings,
  });
  if (!created.ok) throw new Error('create failed');
  const bob = await connect();
  const joined = await call<Ack<JoinResult>>(bob.client, 'room:join', {
    roomCode: created.roomCode.toLowerCase(),
    nickname: 'Bob',
  });
  if (!joined.ok) throw new Error('join failed');
  return { alice, bob, created, joined };
}

describe('lobby rules over sockets', () => {
  it('rejects non-host start, bids in the lobby, and malformed payloads', async () => {
    const { alice, bob } = await twoPlayerLobby();
    expect(errorCode(await call(bob.client, 'game:start', {}))).toBe('NOT_HOST');
    expect(errorCode(await call(bob.client, 'auction:bid', { amount: 10 }))).toBe('WRONG_PHASE');

    expect(errorCode(await call(alice.client, 'auction:bid', { amount: 1.5 }))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'auction:bid', { amount: -3 }))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'auction:bid', { amount: '10' }))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'auction:bid', {}))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'auction:bid', null))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'room:create', { nickname: '   ' }))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'room:updateSettings', { rounds: 'many' }))).toBe('BAD_REQUEST');
    expect(errorCode(await call(alice.client, 'room:updateSettings', { rounds: 99 }))).toBe('INVALID_SETTINGS');
    expect(errorCode(await call(bob.client, 'room:updateSettings', { rounds: 1 }))).toBe('NOT_HOST');

    // server is still alive and responsive
    expect((await call(alice.client, 'room:updateSettings', { rounds: 1 })).ok).toBe(true);
  });

  it('rejects a duplicate nickname with different case', async () => {
    const { created } = await twoPlayerLobby();
    const cara = await connect();
    const res = await call(cara.client, 'room:join', { roomCode: created.roomCode, nickname: 'aLICE' });
    expect(errorCode(res)).toBe('NICKNAME_TAKEN');
  });

  it('reports ROOM_NOT_FOUND for an unknown room', async () => {
    const stranger = await connect();
    const res = await call(stranger.client, 'room:join', { roomCode: 'ZZZZZ', nickname: 'Eve' });
    expect(errorCode(res)).toBe('ROOM_NOT_FOUND');
  });
});

describe('rejoin', () => {
  it('lets a reconnecting player resume the same seat', async () => {
    const { alice, bob, created, joined } = await twoPlayerLobby();
    bob.client.disconnect();
    await alice.tracker.until((s) => s.players.some((p) => p.id === joined.playerId && !p.connected));

    const bob2 = await connect();
    const res = await call<Ack<JoinResult>>(bob2.client, 'room:rejoin', {
      roomCode: created.roomCode,
      rejoinToken: joined.rejoinToken,
    });
    expect(res.ok && res.playerId).toBe(joined.playerId);
    const state = await bob2.tracker.until((s) => s.youId === joined.playerId);
    expect(state.players.find((p) => p.id === joined.playerId)?.connected).toBe(true);
    await alice.tracker.until((s) => s.players.every((p) => p.connected));
  });

  it('rejects a bad token', async () => {
    const { created } = await twoPlayerLobby();
    const intruder = await connect();
    const res = await call(intruder.client, 'room:rejoin', { roomCode: created.roomCode, rejoinToken: 'bad' });
    expect(errorCode(res)).toBe('INVALID_TOKEN');
  });
});

describe('full game over sockets', () => {
  it('runs from lobby to ranked results', async () => {
    const { alice, bob, joined, created } = await twoPlayerLobby();
    expect((await call(alice.client, 'game:start', {})).ok).toBe(true);

    for (let round = 0; round < 2; round++) {
      await alice.tracker.until((s) => s.phase === 'AUCTION' && s.auction?.roundIndex === round && s.auction.status === 'OPEN');
      expect((await call(alice.client, 'auction:bid', { amount: 100 })).ok).toBe(true);
      // same-price bid from the other player must lose
      expect(errorCode(await call(bob.client, 'auction:bid', { amount: 100 }))).toBe('BID_TOO_LOW');
      await alice.tracker.until((s) => s.phase !== 'AUCTION' || (s.auction?.roundIndex === round && s.auction.status === 'SOLD'));
    }

    const finalState = await alice.tracker.until((s) => s.phase === 'RESULTS');
    expect(finalState.results).toEqual([
      { playerId: created.playerId, nickname: 'Alice', totalPower: 40, rank: 1 },
      { playerId: joined.playerId, nickname: 'Bob', totalPower: 0, rank: 2 },
    ]);
    expect(finalState.players.find((p) => p.id === created.playerId)?.coins).toBe(800);

    expect((await call(alice.client, 'game:playAgain', {})).ok).toBe(true);
    await bob.tracker.until((s) => s.phase === 'LOBBY');
  }, 15000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/backend/src/integration.test.ts`
Expected: FAIL — cannot resolve `./app`.

- [ ] **Step 3: Implement the transport**

`apps/backend/src/transport/errors.ts`:
```ts
import { GameError, type ErrorPayload } from '@abb/shared';

export function toErrorPayload(err: unknown): ErrorPayload {
  if (err instanceof GameError) return { code: err.code, message: err.message };
  console.error('Unexpected error in socket handler:', err);
  return { code: 'INTERNAL', message: 'Internal server error' };
}
```

`apps/backend/src/transport/handlers.ts`:
```ts
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  GameError,
  bidSchema,
  createRoomSchema,
  emptySchema,
  joinRoomSchema,
  rejoinSchema,
  updateSettingsSchema,
  type ClientToServerEvents,
  type JoinResult,
  type ServerToClientEvents,
} from '@abb/shared';
import type { Player, Room } from '../game/types';
import type { RoomService } from '../rooms/service';
import { toErrorPayload } from './errors';

export interface SocketData {
  session?: { roomCode: string; playerId: string };
}

type NoServerEvents = Record<string, never>;
export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, NoServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, NoServerEvents, SocketData>;

export const playerChannel = (playerId: string): string => `player:${playerId}`;

export function registerHandlers(io: AppServer, socket: AppSocket, service: RoomService): void {
  // The generic event typing cannot express a schema-driven helper, so use one narrow untyped view.
  const on = socket.on.bind(socket) as unknown as (
    event: string,
    listener: (raw: unknown, ack?: unknown) => void,
  ) => void;

  function handle<S extends z.ZodTypeAny>(
    event: keyof ClientToServerEvents,
    schema: S,
    fn: (payload: z.infer<S>) => object,
  ): void {
    on(event, (raw, ack) => {
      const reply = typeof ack === 'function' ? (ack as (res: unknown) => void) : () => undefined;
      try {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          throw new GameError('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'Invalid request');
        }
        reply({ ok: true, ...fn(parsed.data) });
      } catch (err) {
        const error = toErrorPayload(err);
        reply({ ok: false, error });
        socket.emit('error', error);
      }
    });
  }

  function requireSession(): { roomCode: string; playerId: string } {
    const session = socket.data.session;
    if (!session) throw new GameError('NOT_IN_ROOM', 'Join or create a room first');
    return session;
  }

  /** Marks a player disconnected once none of their sockets remain. */
  function releaseIfOrphaned(session: { roomCode: string; playerId: string }): void {
    const members = io.sockets.adapter.rooms.get(playerChannel(session.playerId));
    if (!members || members.size === 0) service.disconnect(session.roomCode, session.playerId);
  }

  function bind(room: Room, player: Player): JoinResult {
    const previous = socket.data.session;
    socket.data.session = { roomCode: room.code, playerId: player.id };
    socket.join(playerChannel(player.id));
    if (previous && previous.playerId !== player.id) {
      socket.leave(playerChannel(previous.playerId));
      releaseIfOrphaned(previous);
    }
    socket.emit('room:state', service.viewFor(room, player.id));
    return { roomCode: room.code, playerId: player.id, rejoinToken: player.rejoinToken };
  }

  handle('room:create', createRoomSchema, ({ nickname, settings }) => {
    const { room, player } = service.createRoom(nickname, settings);
    return bind(room, player);
  });

  handle('room:join', joinRoomSchema, ({ roomCode, nickname }) => {
    const { room, player } = service.joinRoom(roomCode, nickname);
    return bind(room, player);
  });

  handle('room:rejoin', rejoinSchema, ({ roomCode, rejoinToken }) => {
    const { room, player } = service.rejoin(roomCode, rejoinToken);
    return bind(room, player);
  });

  handle('room:updateSettings', updateSettingsSchema, (patch) => {
    const { roomCode, playerId } = requireSession();
    service.updateSettings(roomCode, playerId, patch);
    return {};
  });

  handle('game:start', emptySchema, () => {
    const { roomCode, playerId } = requireSession();
    service.startGame(roomCode, playerId);
    return {};
  });

  handle('auction:bid', bidSchema, ({ amount }) => {
    const { roomCode, playerId } = requireSession();
    service.placeBid(roomCode, playerId, amount);
    return {};
  });

  handle('game:playAgain', emptySchema, () => {
    const { roomCode, playerId } = requireSession();
    service.playAgain(roomCode, playerId);
    return {};
  });

  socket.on('disconnect', () => {
    const session = socket.data.session;
    if (session) releaseIfOrphaned(session);
  });
}
```

`apps/backend/src/app.ts`:
```ts
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { SETTINGS_BOUNDS, type Character, type SettingsBounds } from '@abb/shared';
import { createAuctionModes, type AuctionModeRegistry } from './auction';
import { InMemoryRoomStore } from './rooms/store';
import { RoomService } from './rooms/service';
import { registerHandlers, playerChannel, type AppServer } from './transport/handlers';

export interface AppConfig {
  characters: Character[];
  corsOrigins: string[];
  bounds?: SettingsBounds;
  auctionModes?: AuctionModeRegistry;
  soldPauseMs?: number;
  battlePauseMs?: number;
  emptyRoomTtlMs?: number;
}

export function createApp(config: AppConfig) {
  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = http.createServer(app);
  const io: AppServer = new Server(httpServer, { cors: { origin: config.corsOrigins } });

  const service: RoomService = new RoomService({
    characters: config.characters,
    store: new InMemoryRoomStore(),
    auctionModes: config.auctionModes ?? createAuctionModes(),
    bounds: config.bounds ?? SETTINGS_BOUNDS,
    soldPauseMs: config.soldPauseMs ?? 3000,
    battlePauseMs: config.battlePauseMs ?? 4000,
    emptyRoomTtlMs: config.emptyRoomTtlMs ?? 10 * 60 * 1000,
    now: () => Date.now(),
    random: Math.random,
    onRoomChanged: (room) => {
      for (const player of room.players) {
        io.to(playerChannel(player.id)).emit('room:state', service.viewFor(room, player.id));
      }
    },
  });

  io.on('connection', (socket) => registerHandlers(io, socket, service));

  return {
    httpServer,
    io,
    service,
    close: () =>
      new Promise<void>((resolve) => {
        service.dispose();
        io.close(() => resolve());
      }),
  };
}
```

`apps/backend/src/index.ts`:
```ts
import { createApp } from './app';
import { JsonCharacterSource } from './characters/source';

const port = Number(process.env.PORT ?? 4000);
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const characters = JsonCharacterSource.fromDefaultFile().getAll();
const { httpServer } = createApp({ characters, corsOrigins });

httpServer.listen(port, () => {
  console.log(`Backend listening on :${port} (CORS: ${corsOrigins.join(', ')})`);
});
```

`apps/backend/.env.example`:
```
PORT=4000
# Comma-separated list of allowed frontend origins
CORS_ORIGIN=http://localhost:3000
```

- [ ] **Step 4: Run all backend tests and typecheck**

Run: `npx vitest run`
Expected: PASS for every test file (shared, characters, auction, game, rooms, integration).

Run: `npm run typecheck -w @abb/backend`
Expected: exit code 0.

- [ ] **Step 5: Smoke-test the real server**

Run (in a second terminal or background): `npm run dev:backend`
Expected: prints `Backend listening on :4000 ...`.

Run: `curl http://localhost:4000/health`
Expected: `{"ok":true}`. Stop the dev server afterwards.

- [ ] **Step 6: Commit**

```bash
git add apps/backend
git commit -m "feat: add Socket.IO transport, app factory and integration tests"
```

---

### Task 7: Frontend scaffold and `useRoom` hook

**Files:**
- Create: `apps/frontend/package.json`, `tsconfig.json`, `next.config.mjs`, `.env.example`
- Create: `apps/frontend/src/app/layout.tsx`, `apps/frontend/src/app/globals.css`
- Create: `apps/frontend/src/lib/socket.ts`, `apps/frontend/src/lib/session.ts`
- Create: `apps/frontend/src/hooks/useRoom.ts`, `apps/frontend/src/hooks/useCountdown.ts`

**Interfaces:**
- Consumes: shared protocol types, `RoomView`, `ErrorPayload`, `UpdateSettingsPayload`.
- Produces:
  - `getSocket(): GameSocket` (singleton, `autoConnect: false`)
  - `loadSession(code) / saveSession(code, session) / clearSession(code)` with `StoredSession = { playerId: string; rejoinToken: string }`
  - `useRoom(code: string)` returning `{ room: RoomView | null; status: 'connecting' | 'needs-join' | 'ready' | 'not-found'; connected: boolean; error: ErrorPayload | null; clearError(): void; clockOffset: number; actions: { join(nickname), updateSettings(patch), start(), bid(amount), playAgain() } }`
  - `useCountdown(endsAt: number, clockOffset: number): number` (remaining ms, never negative)

(UI is verified by typecheck, build and a manual smoke test; the spec excludes frontend E2E tests.)

- [ ] **Step 1: Create the Next.js app files**

`apps/frontend/package.json`:
```json
{
  "name": "@abb/frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@abb/shared": "*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

`apps/frontend/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // @abb/shared ships TypeScript source
  transpilePackages: ['@abb/shared'],
};

export default nextConfig;
```

`apps/frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/frontend/.env.example`:
```
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Run: `npm install`
Expected: completes without errors.

- [ ] **Step 2: Layout and global styles**

`apps/frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anime Bid Battle',
  description: 'Bid on anime characters, build the strongest team.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
```

`apps/frontend/src/app/globals.css`:
```css
:root {
  --bg: #12131a;
  --panel: #1c1e2a;
  --panel-2: #262938;
  --text: #f1f2f8;
  --muted: #9a9db3;
  --accent: #ff6b9d;
  --accent-2: #6bc5ff;
  --good: #5be3a0;
  --bad: #ff6b6b;
  --warn: #ffd166;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  line-height: 1.5;
}

.container { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }

h1, h2, h3 { margin: 0 0 12px; }
.muted { color: var(--muted); }
.center { text-align: center; }

.card {
  background: var(--panel);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.grid { display: grid; gap: 16px; grid-template-columns: 2fr 1fr; }
@media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }

input {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid #3a3e55;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 1rem;
}
input:focus { outline: 2px solid var(--accent-2); }

button {
  background: var(--accent);
  color: #1a0b12;
  border: 0;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
button.secondary { background: var(--panel-2); color: var(--text); }
button:disabled { opacity: 0.4; cursor: not-allowed; }

.code { font-size: 2.5rem; letter-spacing: 0.25em; font-weight: 800; color: var(--accent-2); }

.banner { padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
.banner.error { background: #3a1f26; color: var(--bad); }
.banner.info { background: #1f3040; color: var(--accent-2); }

.player { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid #2c2f42; }
.player.leader { color: var(--good); font-weight: 700; }
.player.offline { opacity: 0.5; }

.lot { text-align: center; }
.lot .name { font-size: 2rem; font-weight: 800; }
.lot .power { font-size: 1.2rem; color: var(--warn); }
.timer { font-size: 3rem; font-weight: 800; }
.timer.closing { color: var(--bad); }
.price { font-size: 2rem; font-weight: 800; color: var(--good); }

.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.85rem; color: var(--muted); }

.rank { font-size: 1.4rem; font-weight: 800; width: 2.5rem; }
```

- [ ] **Step 3: Socket singleton and session storage**

`apps/frontend/src/lib/socket.ts`:
```ts
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@abb/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | undefined;

/** One socket for the whole tab so client-side navigation keeps the same seat. */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000', {
      autoConnect: false,
    });
  }
  return socket;
}
```

`apps/frontend/src/lib/session.ts`:
```ts
export interface StoredSession {
  playerId: string;
  rejoinToken: string;
}

const key = (roomCode: string) => `abb:session:${roomCode}`;

export function loadSession(roomCode: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key(roomCode));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(roomCode: string, session: StoredSession): void {
  try {
    localStorage.setItem(key(roomCode), JSON.stringify(session));
  } catch {
    // storage unavailable: the player simply cannot auto-rejoin after a refresh
  }
}

export function clearSession(roomCode: string): void {
  try {
    localStorage.removeItem(key(roomCode));
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Hooks**

`apps/frontend/src/hooks/useCountdown.ts`:
```ts
'use client';

import { useEffect, useState } from 'react';

/** Milliseconds left until `endsAt` (server time), given clockOffset = serverNow - Date.now(). */
export function useCountdown(endsAt: number, clockOffset: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, endsAt - (now + clockOffset));
}
```

`apps/frontend/src/hooks/useRoom.ts`:
```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ErrorPayload, RoomView, UpdateSettingsPayload } from '@abb/shared';
import { getSocket } from '../lib/socket';
import { clearSession, loadSession, saveSession } from '../lib/session';

export type RoomStatus = 'connecting' | 'needs-join' | 'ready' | 'not-found';

const noop = () => undefined;

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ErrorPayload | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    const rejoin = () => {
      setConnected(true);
      const session = loadSession(code);
      if (!session) {
        setStatus((current) => (current === 'ready' ? current : 'needs-join'));
        return;
      }
      socket.emit('room:rejoin', { roomCode: code, rejoinToken: session.rejoinToken }, (res) => {
        if (!res.ok) {
          clearSession(code);
          setStatus(res.error.code === 'ROOM_NOT_FOUND' ? 'not-found' : 'needs-join');
        }
      });
    };
    const onState = (state: RoomView) => {
      if (state.code !== code) return;
      setRoom(state);
      setClockOffset(state.serverNow - Date.now());
      setStatus('ready');
    };
    const onError = (err: ErrorPayload) => setError(err);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', rejoin);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('error', onError);
    if (socket.connected) rejoin();
    else socket.connect();

    return () => {
      socket.off('connect', rejoin);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('error', onError);
    };
  }, [code]);

  const join = useCallback(
    (nickname: string) => {
      getSocket().emit('room:join', { roomCode: code, nickname }, (res) => {
        if (res.ok) saveSession(code, { playerId: res.playerId, rejoinToken: res.rejoinToken });
      });
    },
    [code],
  );

  const actions = {
    join,
    updateSettings: (patch: UpdateSettingsPayload) => getSocket().emit('room:updateSettings', patch, noop),
    start: () => getSocket().emit('game:start', {}, noop),
    bid: (amount: number) => getSocket().emit('auction:bid', { amount }, noop),
    playAgain: () => getSocket().emit('game:playAgain', {}, noop),
  };

  return { room, status, connected, error, clearError: () => setError(null), clockOffset, actions };
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck -w @abb/frontend`
Expected: exit code 0. (If it reports a missing `next-env.d.ts`, run `npx next build -w @abb/frontend` once later or create an empty `apps/frontend/next-env.d.ts` containing `/// <reference types="next" />`; it is git-ignored.)

- [ ] **Step 6: Commit**

```bash
git add apps/frontend package.json package-lock.json
git commit -m "feat: scaffold Next.js frontend with socket and room hooks"
```

---

### Task 8: Frontend pages and components

**Files:**
- Create: `apps/frontend/src/app/page.tsx` (home)
- Create: `apps/frontend/src/app/room/[code]/page.tsx`
- Create: `apps/frontend/src/components/JoinRoomForm.tsx`, `Lobby.tsx`, `Auction.tsx`, `Battle.tsx`, `Results.tsx`, `ErrorBanner.tsx`

**Interfaces:**
- Consumes: `useRoom`, `useCountdown`, `getSocket`, `saveSession` (Task 7); shared `RoomView`, `AuctionView`, `SETTINGS_BOUNDS`, `JoinResult`.
- Produces: the playable UI. Component props:
  - `JoinRoomForm({ title, onSubmit(nickname) })`
  - `Lobby({ room, actions })`, `Auction({ room, auction, clockOffset, onBid(amount) })`, `Battle({ room })`, `Results({ room, onPlayAgain() })`, `ErrorBanner({ error, onDismiss })`

- [ ] **Step 1: Shared small components**

`apps/frontend/src/components/ErrorBanner.tsx`:
```tsx
import type { ErrorPayload } from '@abb/shared';

export function ErrorBanner({ error, onDismiss }: { error: ErrorPayload | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="banner error" role="alert">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{error.message}</span>
        <button className="secondary" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

`apps/frontend/src/components/JoinRoomForm.tsx`:
```tsx
'use client';

import { useState } from 'react';

export function JoinRoomForm({ title, onSubmit }: { title: string; onSubmit: (nickname: string) => void }) {
  const [nickname, setNickname] = useState('');
  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        if (nickname.trim()) onSubmit(nickname.trim());
      }}
    >
      <h2>{title}</h2>
      <div className="row">
        <input
          value={nickname}
          maxLength={20}
          placeholder="Your nickname"
          onChange={(event) => setNickname(event.target.value)}
          autoFocus
        />
        <button type="submit" disabled={!nickname.trim()}>
          Join
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Home page**

`apps/frontend/src/app/page.tsx`:
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
    <div>
      <h1 className="center">Anime Bid Battle</h1>
      <p className="muted center">Bid on anime characters. Build the strongest team.</p>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="card">
        <div className="field">
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Create a room</h2>
          <p className="muted">You become the host and choose the settings.</p>
          <button onClick={create} disabled={!name}>
            Create room
          </button>
        </div>
        <div className="card">
          <h2>Join a room</h2>
          <div className="row">
            <input
              value={roomCode}
              maxLength={5}
              placeholder="ROOM CODE"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={{ width: '9em' }}
            />
            <button onClick={join} disabled={!name || roomCode.trim().length !== 5}>
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Lobby**

`apps/frontend/src/components/Lobby.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { MIN_PLAYERS_TO_START, SETTINGS_BOUNDS, type RoomSettings, type RoomView, type UpdateSettingsPayload } from '@abb/shared';

interface Props {
  room: RoomView;
  actions: { updateSettings(patch: UpdateSettingsPayload): void; start(): void };
}

const FIELDS = [
  { key: 'maxPlayers', label: 'Max players' },
  { key: 'startingCoins', label: 'Starting coins' },
  { key: 'rounds', label: 'Rounds (characters)' },
  { key: 'roundSeconds', label: 'Seconds per round' },
] as const;

export function Lobby({ room, actions }: Props) {
  const isHost = room.youId === room.hostId;
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(room.settings));
  const [copied, setCopied] = useState(false);

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
  }

  return (
    <div className="grid">
      <div>
        <div className="card center">
          <div className="muted">Room code</div>
          <div className="code">{room.code}</div>
          <button className="secondary" onClick={copyLink}>
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>
        </div>

        <div className="card">
          <h2>Settings</h2>
          <div className="row">
            {FIELDS.map(({ key, label }) => (
              <div className="field" key={key}>
                <label htmlFor={key}>
                  {label} ({SETTINGS_BOUNDS[key].min}–{SETTINGS_BOUNDS[key].max})
                </label>
                <input
                  id={key}
                  type="number"
                  value={isHost ? draft[key] : String(room.settings[key])}
                  disabled={!isHost}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  style={{ width: '9em' }}
                />
              </div>
            ))}
          </div>
          {isHost && (
            <div className="row" style={{ marginTop: 12 }}>
              <button className="secondary" onClick={save}>
                Save settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="card">
          <h2>
            Players ({room.players.length}/{room.settings.maxPlayers})
          </h2>
          {room.players.map((player) => (
            <div key={player.id} className={`player ${player.connected ? '' : 'offline'}`}>
              <span>
                {player.nickname}
                {player.id === room.youId ? ' (you)' : ''}
                {player.isHost ? ' 👑' : ''}
              </span>
              <span className="muted">{player.connected ? 'online' : 'offline'}</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button onClick={actions.start} disabled={room.players.length < MIN_PLAYERS_TO_START} style={{ width: '100%' }}>
            {room.players.length < MIN_PLAYERS_TO_START ? `Need ${MIN_PLAYERS_TO_START}+ players` : 'Start game'}
          </button>
        ) : (
          <p className="muted center">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  );
}

function toDraft(settings: RoomSettings): Record<string, string> {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(settings[key])]));
}
```

- [ ] **Step 4: Auction**

`apps/frontend/src/components/Auction.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { AuctionView, RoomView } from '@abb/shared';
import { useCountdown } from '../hooks/useCountdown';

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

  return (
    <div className="grid">
      <div>
        <div className="card lot">
          <div className="muted">
            Round {auction.roundIndex + 1} / {auction.totalRounds}
          </div>
          <div className="name">{auction.character.name}</div>
          <div className="muted">{auction.character.anime}</div>
          <div className="power">Power {auction.character.power}</div>

          {open ? (
            <div className={`timer ${closing ? 'closing' : ''}`}>{(remainingMs / 1000).toFixed(1)}s</div>
          ) : (
            <div className="timer">{auction.status === 'SOLD' ? 'SOLD!' : 'No bids'}</div>
          )}

          <div className="price">{auction.price > 0 ? `${auction.price} coins` : 'No bids yet'}</div>
          <div className="muted">
            {auction.status === 'SOLD' && leader && `Sold to ${leader.nickname}`}
            {auction.status === 'UNSOLD' && 'Nobody bid — this character is unsold'}
            {open && leader && `Leader: ${leader.nickname}${isLeader ? ' (you)' : ''}`}
            {closing && ' — going once!'}
          </div>
        </div>

        <div className="card">
          <h3>Your bid — you have {coins} coins</h3>
          <div className="row">
            {quick.map((amount) => (
              <button key={amount} disabled={!canBid} onClick={() => onBid(amount)}>
                Bid {amount}
              </button>
            ))}
            <input
              type="number"
              min={minBid}
              value={custom}
              placeholder={`min ${minBid}`}
              onChange={(e) => setCustom(e.target.value)}
              style={{ width: '8em' }}
            />
            <button
              className="secondary"
              disabled={!canBid || !Number.isInteger(customAmount) || customAmount < minBid || customAmount > coins}
              onClick={() => {
                onBid(customAmount);
                setCustom('');
              }}
            >
              Bid
            </button>
          </div>
          {isLeader && open && <p className="muted">You are the highest bidder.</p>}
        </div>
      </div>

      <div>
        <div className="card">
          <h3>Players</h3>
          {room.players.map((player) => (
            <div
              key={player.id}
              className={`player ${player.id === auction.leaderId ? 'leader' : ''} ${player.connected ? '' : 'offline'}`}
            >
              <span>
                {player.nickname}
                {player.id === room.youId ? ' (you)' : ''}
              </span>
              <span>
                {player.coins}¢ · {player.team.length} 🎴
              </span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Your team</h3>
          {me && me.team.length > 0 ? (
            me.team.map((character) => (
              <div key={character.id} className="player">
                <span>{character.name}</span>
                <span className="muted">{character.power}</span>
              </div>
            ))
          ) : (
            <p className="muted">No characters yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Battle and Results**

`apps/frontend/src/components/Battle.tsx`:
```tsx
import type { RoomView } from '@abb/shared';

export function Battle({ room }: { room: RoomView }) {
  const results = room.results ?? [];
  return (
    <div className="center">
      <h1>⚔️ Battle!</h1>
      <p className="muted">Comparing team power…</p>
      {results.map((result) => {
        const player = room.players.find((p) => p.id === result.playerId);
        return (
          <div key={result.playerId} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{result.nickname}</strong>
              <span className="power">{result.totalPower} power</span>
            </div>
            <div className="muted">{player?.team.map((c) => c.name).join(', ') || 'No characters'}</div>
          </div>
        );
      })}
    </div>
  );
}
```

`apps/frontend/src/components/Results.tsx`:
```tsx
import type { RoomView } from '@abb/shared';

export function Results({ room, onPlayAgain }: { room: RoomView; onPlayAgain: () => void }) {
  const results = room.results ?? [];
  const winners = results.filter((r) => r.rank === 1);
  const isHost = room.youId === room.hostId;

  return (
    <div>
      <h1 className="center">🏆 {winners.map((w) => w.nickname).join(' & ')} {winners.length > 1 ? 'tie!' : 'wins!'}</h1>
      {results.map((result) => {
        const player = room.players.find((p) => p.id === result.playerId);
        return (
          <div key={result.playerId} className="card">
            <div className="row">
              <span className="rank">#{result.rank}</span>
              <strong style={{ flex: 1 }}>
                {result.nickname}
                {result.playerId === room.youId ? ' (you)' : ''}
              </strong>
              <span className="power">{result.totalPower} power</span>
            </div>
            <div className="muted">{player?.team.map((c) => `${c.name} (${c.power})`).join(', ') || 'No characters'}</div>
          </div>
        );
      })}
      <div className="center">
        {isHost ? (
          <button onClick={onPlayAgain}>Play again</button>
        ) : (
          <p className="muted">Waiting for the host to start another game…</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Room page**

`apps/frontend/src/app/room/[code]/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRoom } from '../../../hooks/useRoom';
import { Auction } from '../../../components/Auction';
import { Battle } from '../../../components/Battle';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JoinRoomForm } from '../../../components/JoinRoomForm';
import { Lobby } from '../../../components/Lobby';
import { Results } from '../../../components/Results';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { room, status, connected, error, clearError, clockOffset, actions } = useRoom(code);

  if (status === 'not-found') {
    return (
      <div className="card center">
        <h2>Room {code} not found</h2>
        <p className="muted">It may have ended or the code is wrong.</p>
        <Link href="/">Back to home</Link>
      </div>
    );
  }

  if (status === 'needs-join') {
    return (
      <div>
        <ErrorBanner error={error} onDismiss={clearError} />
        <JoinRoomForm title={`Join room ${code}`} onSubmit={actions.join} />
      </div>
    );
  }

  if (!room) return <p className="muted center">Connecting…</p>;

  return (
    <div>
      {!connected && <div className="banner info">Connection lost — reconnecting…</div>}
      <ErrorBanner error={error} onDismiss={clearError} />
      {room.phase === 'LOBBY' && <Lobby room={room} actions={actions} />}
      {room.phase === 'AUCTION' && room.auction && (
        <Auction room={room} auction={room.auction} clockOffset={clockOffset} onBid={actions.bid} />
      )}
      {room.phase === 'BATTLE' && <Battle room={room} />}
      {room.phase === 'RESULTS' && <Results room={room} onPlayAgain={actions.playAgain} />}
    </div>
  );
}
```

- [ ] **Step 7: Typecheck and build**

Run: `npm run typecheck -w @abb/frontend`
Expected: exit code 0.

Run: `npm run build -w @abb/frontend`
Expected: "Compiled successfully" and a route table listing `/` and `/room/[code]`.

- [ ] **Step 8: Manual smoke test with two browser windows**

Run the backend (`npm run dev:backend`) and frontend (`npm run dev:frontend`) in two terminals. Copy `apps/frontend/.env.example` to `apps/frontend/.env.local` first.

Check each, in one normal window and one private window:
1. Window A: enter a nickname, create a room → lobby shows a 5-character code and Start is disabled ("Need 2+ players").
2. Window B: enter another nickname and the code → both lists show two players; the host can edit settings (set rounds 2, seconds 10) and Save.
3. Host Start → both windows show the first character, a live countdown and price.
4. Bid from A, then from B → leader changes; a bid with 4 s left pushes the timer back to 5 s; a lower bid shows an error banner.
5. Refresh window B mid-auction → it returns to the same auction with its coins and team.
6. After the last round → Battle screen, then Results with correct ranking; host "Play again" returns both to the lobby.

Expected: all six behave as described. Stop both servers afterwards. If any check fails, fix it before committing.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend
git commit -m "feat: add frontend pages for lobby, auction, battle and results"
```

---

### Task 9: Deployment notes and README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: env var names `PORT`, `CORS_ORIGIN` (backend) and `NEXT_PUBLIC_SOCKET_URL` (frontend); npm scripts from Tasks 6–7.
- Produces: documentation only.

- [ ] **Step 1: Write the README**

Replace the contents of `README.md` with:
````markdown
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

## Deployment (two services)

The game server needs a long-lived Node process for WebSockets and in-memory rooms, so it cannot run on Vercel's serverless functions. Deploy:

- **Frontend → Vercel.** Import the repo, set the project *Root Directory* to `apps/frontend`, and set `NEXT_PUBLIC_SOCKET_URL` to the backend's public URL (e.g. `https://abb-backend.example.com`).
- **Backend → any host that runs a Node process** (Render, Railway, Fly.io, … — check their current free-tier terms).
  - Install: `npm install`
  - Start: `npm run start -w @abb/backend`
  - Env: `CORS_ORIGIN` = your Vercel URL (comma-separate multiple origins); `PORT` is normally provided by the host.
  - Health check: `GET /health`

Free hosts often sleep idle services (the first visit is slow) and rooms live in memory, so a restart ends active games. `RoomStore` is an interface so Redis can replace it later.

## Extending

- **New auction mode:** implement `AuctionMode` (`apps/backend/src/auction/types.ts`), register it in `createAuctionModes()`, and add its name to `AUCTION_MODE_NAMES` in `packages/shared`.
- **New power formula:** change `computePower()` in `apps/backend/src/characters/power.ts`.
- **New character source:** implement `CharacterSource` and pass its characters to `createApp()`.
````

- [ ] **Step 2: Final verification**

Run: `npm test`
Expected: all test files pass.

Run: `npm run typecheck`
Expected: every workspace exits 0.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, tests and deployment notes"
```

---

## Self-Review Notes

- **Spec coverage:** repo layout/boundaries (Tasks 1–2, 6–7), phases and room rules incl. host migration and room cleanup (Tasks 4–5), auction mode interface and open-ascending rules incl. concurrency and anti-sniping (Tasks 3, 5, 6), socket protocol with zod validation (Tasks 1, 6), frontend pages, `useRoom`, localStorage rejoin and countdown with clock offset (Tasks 7–8), testing strategy (unit in 2–5, integration in 6), deploy/CORS (Tasks 6, 9). Out-of-scope items are not implemented.
- **Type consistency:** `advanceRound` returns `Phase`; `RoomService` methods use the names the transport calls (`createRoom`, `joinRoom`, `rejoin`, `updateSettings`, `startGame`, `placeBid`, `playAgain`, `disconnect`, `viewFor`); `AuctionState.price` is `0` before the first bid, matching `getPublicView` and the frontend's `minBid` logic.
- **Deliberate spec interpretation:** the spec lists round sub-states `OPEN/CLOSING/SOLD`; the backend stores `OPEN | SOLD | UNSOLD` and the frontend derives "closing" from `endsAt`, so the backend never needs a timer just to flip a display flag.
