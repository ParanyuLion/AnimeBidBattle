import type { BattleResult, Character, MusicSync, Phase, RoomSettings } from '@abb/shared';
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
  /** Shared background-music clock; set once when the room is created. */
  music: MusicSync;
  players: Player[];
  phase: Phase;
  deck: Character[];
  roundIndex: number;
  auction: AuctionState | null;
  results: BattleResult[] | null;
}
