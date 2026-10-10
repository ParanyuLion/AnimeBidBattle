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
