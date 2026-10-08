export const ERROR_CODES = [
  'BAD_REQUEST',
  'INTERNAL',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NOT_HOST',
  'NOT_IN_ROOM',
  'WRONG_PHASE',
  'NICKNAME_TAKEN',
  'INVALID_SETTINGS',
  'INVALID_TOKEN',
  'NOT_ENOUGH_PLAYERS',
  'BID_TOO_LOW',
  'INSUFFICIENT_COINS',
  'ALREADY_LEADING',
  'AUCTION_CLOSED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export class GameError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GameError';
  }
}
