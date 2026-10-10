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
