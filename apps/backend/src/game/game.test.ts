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

  it('re-elects a reconnecting player as host when the offline host has no connected successors', () => {
    const { room } = lobby();
    // p1 is host, p2 is player, both connected
    expect(room.hostId).toBe('p1');
    // p1 disconnects -> host moves to p2
    markConnection(room, 'p1', false);
    expect(room.hostId).toBe('p2');
    // p2 disconnects -> nobody connected, host stays p2
    markConnection(room, 'p2', false);
    expect(room.hostId).toBe('p2');
    // p1 reconnects -> host moves to p1 (the reconnecting player)
    markConnection(room, 'p1', true);
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
