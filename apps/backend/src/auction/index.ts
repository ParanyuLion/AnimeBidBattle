import type { AuctionModeName } from '@abb/shared';
import { OpenAscendingAuction } from './openAscending';
import type { AuctionMode } from './types';

export * from './types';
export { OpenAscendingAuction, START_PRICE, DEFAULT_SNIPE_WINDOW_MS } from './openAscending';

export type AuctionModeRegistry = Record<AuctionModeName, AuctionMode>;

export function createAuctionModes(): AuctionModeRegistry {
  return { 'open-ascending': new OpenAscendingAuction() };
}
