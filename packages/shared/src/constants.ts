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
