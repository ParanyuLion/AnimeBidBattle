import { GameError, type ErrorPayload } from '@abb/shared';

export function toErrorPayload(err: unknown): ErrorPayload {
  if (err instanceof GameError) return { code: err.code, message: err.message };
  console.error('Unexpected error in socket handler:', err);
  return { code: 'INTERNAL', message: 'Internal server error' };
}
