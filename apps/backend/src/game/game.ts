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
