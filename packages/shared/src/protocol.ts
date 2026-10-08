import type { ErrorPayload } from './errors';
import type {
  BidPayload,
  CreateRoomPayload,
  JoinRoomPayload,
  RejoinPayload,
  UpdateSettingsPayload,
} from './schemas';
import type { JoinResult, RoomView } from './types';

export type Ack<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorPayload };

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (res: Ack<JoinResult>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Ack<JoinResult>) => void) => void;
  'room:rejoin': (payload: RejoinPayload, ack: (res: Ack<JoinResult>) => void) => void;
  'room:updateSettings': (payload: UpdateSettingsPayload, ack: (res: Ack) => void) => void;
  'game:start': (payload: object, ack: (res: Ack) => void) => void;
  'auction:bid': (payload: BidPayload, ack: (res: Ack) => void) => void;
  'game:playAgain': (payload: object, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  error: (error: ErrorPayload) => void;
}
