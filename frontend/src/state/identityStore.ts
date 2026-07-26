/**
 * Which actor and session the console acts as.
 *
 * Identity is application state rather than form state. Every mutation reads
 * from here, so a user cannot submit a form attributed to one actor while
 * their session belongs to another — `session_actor_mismatch` becomes
 * unreachable by construction instead of reported after the fact.
 */

export interface Identity {
  actorId: string | null;
  sessionId: string | null;
}

export const EMPTY_IDENTITY: Identity = { actorId: null, sessionId: null };

const STORAGE_KEY = "coordination-console.identity";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class IdentityStore {
  constructor(private readonly storage: StorageLike | null) {}

  load(): Identity {
    if (!this.storage) return EMPTY_IDENTITY;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY_IDENTITY;
      const parsed: unknown = JSON.parse(raw);
      return IdentityStore.normalize(parsed);
    } catch {
      // A corrupt or unreadable entry must not stop the console from starting.
      return EMPTY_IDENTITY;
    }
  }

  save(identity: Identity): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(IdentityStore.normalize(identity)));
    } catch {
      // Private-browsing quota failures are not worth surfacing.
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // ignored
    }
  }

  static normalize(value: unknown): Identity {
    if (!value || typeof value !== "object") return EMPTY_IDENTITY;
    const record = value as Record<string, unknown>;
    return {
      actorId: typeof record["actorId"] === "string" && record["actorId"] ? record["actorId"] : null,
      sessionId:
        typeof record["sessionId"] === "string" && record["sessionId"] ? record["sessionId"] : null,
    };
  }
}

export function browserIdentityStore(): IdentityStore {
  try {
    return new IdentityStore(globalThis.localStorage ?? null);
  } catch {
    return new IdentityStore(null);
  }
}
