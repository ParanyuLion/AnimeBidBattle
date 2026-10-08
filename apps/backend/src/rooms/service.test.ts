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
    hostGraceMs: 5000,
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

describe('RoomService host grace', () => {
  it('keeps host when the host rejoins within the grace period', () => {
    const { room, alice } = startedGame();
    service.disconnect(room.code, alice.id);
    expect(room.players.find((p) => p.id === alice.id)?.connected).toBe(false);
    expect(room.hostId).toBe(alice.id);
    vi.advanceTimersByTime(3000);
    service.rejoin(room.code, alice.rejoinToken);
    vi.advanceTimersByTime(20_000);
    expect(room.hostId).toBe(alice.id);
  });

  it('moves host to a connected player once the grace elapses', () => {
    const { room, alice, bob } = startedGame();
    service.disconnect(room.code, alice.id);
    vi.advanceTimersByTime(4999);
    expect(room.hostId).toBe(alice.id);
    vi.advanceTimersByTime(2);
    expect(room.hostId).toBe(bob.id);
  });

  it('keeps host when everyone disconnects and the host returns', () => {
    const { room, alice, bob } = startedGame();
    service.disconnect(room.code, alice.id);
    service.disconnect(room.code, bob.id);
    vi.advanceTimersByTime(10_000);
    expect(room.hostId).toBe(alice.id);
    service.rejoin(room.code, alice.rejoinToken);
    expect(room.hostId).toBe(alice.id);
    expect(room.players.find((p) => p.id === alice.id)?.connected).toBe(true);
  });

  it('does not re-elect early when another player drops during the grace', () => {
    const { room, player: alice } = service.createRoom('Alice', settings);
    const { player: bob } = service.joinRoom(room.code, 'Bob');
    const { player: cara } = service.joinRoom(room.code, 'Cara');
    service.disconnect(room.code, alice.id);
    service.disconnect(room.code, cara.id);
    expect(room.hostId).toBe(alice.id);
    vi.advanceTimersByTime(5001);
    expect(room.hostId).toBe(bob.id);
  });
});

describe('RoomService timer safety', () => {
  it('still reaches RESULTS when the change listener throws during timer emissions', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      let throwing = false;
      service.dispose();
      service = new RoomService({
        characters,
        store: new InMemoryRoomStore(),
        auctionModes: createAuctionModes(),
        bounds: SETTINGS_BOUNDS,
        soldPauseMs: 1000,
        battlePauseMs: 1000,
        emptyRoomTtlMs: 60_000,
        hostGraceMs: 5000,
        now: () => Date.now(),
        random: () => 0,
        onRoomChanged: () => {
          if (throwing) throw new Error('listener boom');
        },
      });
      const { room } = startedGame();
      throwing = true;
      vi.advanceTimersByTime(10_000 + 1000 + 10_000 + 1000 + 1000);
      expect(room.phase).toBe('RESULTS');
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
