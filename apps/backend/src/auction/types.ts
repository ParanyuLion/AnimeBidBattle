import type {
  AuctionBidView,
  AuctionModeName,
  AuctionStatus,
  Character,
  ErrorCode,
} from '@abb/shared';

export interface AuctionState {
  character: Character;
  /** Highest accepted bid; 0 until the first bid. */
  price: number;
  leaderId: string | null;
  endsAt: number;
  status: AuctionStatus;
}

export interface BidInput {
  playerId: string;
  coins: number;
  amount: number;
}

export type BidResult = { ok: true; state: AuctionState } | { ok: false; code: ErrorCode };

export interface AuctionMode {
  readonly name: AuctionModeName;
  start(character: Character, roundSeconds: number, now: number): AuctionState;
  placeBid(state: AuctionState, bid: BidInput, now: number): BidResult;
  onTimerExpired(state: AuctionState): AuctionState;
  getPublicView(state: AuctionState, viewerId: string): AuctionBidView;
}
