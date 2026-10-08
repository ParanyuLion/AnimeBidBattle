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
  electHostIfNeeded,
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
  /** How long a disconnected host keeps host rights before they move to another online player. */
  hostGraceMs: number;
  now: () => number;
  random: () => number;
  onRoomChanged: (room: Room) => void;
}

export class RoomService {
  /** One game timer per room: round end, then the pause after SOLD, then the battle pause. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly ttlTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly hostTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    if (room.players.find((p) => p.id === room.hostId)?.connected) this.clearHostTimer(room.code);
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
    const player = room.players.find((p) => p.id === playerId);
    if (player && (player.id === room.hostId || this.hostTimers.has(room.code))) {
      // Host refresh grace: keep host rights for a while instead of re-electing immediately.
      player.connected = false;
      if (!this.hostTimers.has(room.code)) this.startHostTimer(room.code);
    } else {
      markConnection(room, playerId, false);
    }
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
    for (const timer of this.hostTimers.values()) clearTimeout(timer);
    this.timers.clear();
    this.hostTimers.clear();
    this.ttlTimers.clear();
  }

  private emit(room: Room): void {
    this.config.onRoomChanged(room);
  }

  /** Runs a timer callback without letting an exception escape and kill the process. */
  private safe(fn: () => void): () => void {
    return () => {
      try {
        fn();
      } catch (err) {
        console.error('RoomService timer callback failed', err);
      }
    };
  }

  private startHostTimer(code: string): void {
    this.clearHostTimer(code);
    this.hostTimers.set(
      code,
      setTimeout(
        this.safe(() => {
          this.hostTimers.delete(code);
          const room = this.config.store.get(code);
          if (room && electHostIfNeeded(room)) this.emit(room);
        }),
        this.config.hostGraceMs,
      ),
    );
  }

  private clearHostTimer(code: string): void {
    const timer = this.hostTimers.get(code);
    if (timer) clearTimeout(timer);
    this.hostTimers.delete(code);
  }

  private setTimer(code: string, ms: number, fn: () => void): void {
    this.clearTimer(code);
    this.timers.set(code, setTimeout(this.safe(fn), Math.max(0, ms)));
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
      setTimeout(this.safe(() => this.deleteRoom(code)), this.config.emptyRoomTtlMs),
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
    this.clearHostTimer(code);
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
    this.setTimer(code, this.config.soldPauseMs, () => this.onAdvance(code));
    this.emit(room);
  }

  private onAdvance(code: string): void {
    const room = this.config.store.get(code);
    if (!room || room.phase !== 'AUCTION') return;
    const phase = advanceRound(room, this.config.auctionModes, this.config.now());
    if (phase === 'AUCTION') {
      this.scheduleRoundEnd(room);
    } else {
      this.setTimer(code, this.config.battlePauseMs, () => this.onShowResults(code));
    }
    this.emit(room);
  }

  private onShowResults(code: string): void {
    const room = this.config.store.get(code);
    if (!room || room.phase !== 'BATTLE') return;
    showResults(room);
    this.emit(room);
  }
}
