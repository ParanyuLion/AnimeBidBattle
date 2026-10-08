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
