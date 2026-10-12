import type { RoomSettings, SettingsBounds } from './types';

export const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 6,
  startingCoins: 1000,
  rounds: 10,
  roundSeconds: 15,
  powerVariance: 0,
  seriesCombo: false,
  auctionMode: 'open-ascending',
};

export const SETTINGS_BOUNDS: SettingsBounds = {
  maxPlayers: { min: 2, max: 8 },
  startingCoins: { min: 100, max: 10000 },
  rounds: { min: 1, max: 30 },
  roundSeconds: { min: 10, max: 60 },
  powerVariance: { min: 0, max: 30 },
};

export const MIN_PLAYERS_TO_START = 2;
export const ROOM_CODE_LENGTH = 5;
export const NICKNAME_MAX = 20;

/** Series combo: every extra character from the same anime adds this much percent to that anime's power... */
export const COMBO_PERCENT_PER_EXTRA = 10;
/** ...up to this cap. */
export const COMBO_MAX_PERCENT = 50;

/** Bonus percent for `count` characters of one anime on a team (0 for a single character). */
export function comboPercent(count: number): number {
  if (count < 2) return 0;
  return Math.min(COMBO_MAX_PERCENT, (count - 1) * COMBO_PERCENT_PER_EXTRA);
}
