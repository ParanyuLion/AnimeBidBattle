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
