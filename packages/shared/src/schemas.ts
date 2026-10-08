import { z } from 'zod';
import { NICKNAME_MAX, ROOM_CODE_LENGTH } from './constants';
import { AUCTION_MODE_NAMES } from './types';

export const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  anime: z.string().min(1),
  power: z.number().finite().nonnegative(),
});

export const nicknameSchema = z.string().trim().min(1).max(NICKNAME_MAX);

export const settingsSchema = z.object({
  maxPlayers: z.number().int(),
  startingCoins: z.number().int(),
  rounds: z.number().int(),
  roundSeconds: z.number().int(),
  auctionMode: z.enum(AUCTION_MODE_NAMES),
});

const roomCodeSchema = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH);

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  settings: settingsSchema.partial().optional(),
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  nickname: nicknameSchema,
});

export const rejoinSchema = z.object({
  roomCode: roomCodeSchema,
  rejoinToken: z.string().min(1),
});

export const updateSettingsSchema = settingsSchema.partial();
export const bidSchema = z.object({ amount: z.number().int().positive() });
export const emptySchema = z.object({});

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type RejoinPayload = z.infer<typeof rejoinSchema>;
export type UpdateSettingsPayload = z.infer<typeof updateSettingsSchema>;
export type BidPayload = z.infer<typeof bidSchema>;
