export interface StoredSession {
  playerId: string;
  rejoinToken: string;
}

const key = (roomCode: string) => `abb:session:${roomCode}`;

export function loadSession(roomCode: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key(roomCode));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(roomCode: string, session: StoredSession): void {
  try {
    localStorage.setItem(key(roomCode), JSON.stringify(session));
  } catch {
    // storage unavailable: the player simply cannot auto-rejoin after a refresh
  }
}

export function clearSession(roomCode: string): void {
  try {
    localStorage.removeItem(key(roomCode));
  } catch {
    // ignore
  }
}
