/**
 * Application-wide collaborators: the API client, identity, and announcements.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import { Coordination } from "../api/coordination.ts";
import {
  browserIdentityStore,
  EMPTY_IDENTITY,
  type Identity,
  type IdentityStore,
} from "./identityStore.ts";

export interface AppValue {
  coordination: Coordination;
  identity: Identity;
  setActor: (actorId: string | null) => void;
  setSession: (sessionId: string | null) => void;
  /** Text pushed to the polite live region after a successful mutation. */
  announcement: string;
  announce: (message: string) => void;
}

const AppContext = createContext<AppValue | null>(null);

export interface AppProviderProps {
  children: ReactNode;
  store?: IdentityStore;
  client?: ApiClient;
}

export function AppProvider({ children, store, client }: AppProviderProps) {
  const identityStore = useMemo(() => store ?? browserIdentityStore(), [store]);
  const [identity, setIdentity] = useState<Identity>(() => identityStore.load());
  const [announcement, setAnnouncement] = useState("");

  // The client reads the session through a ref-like closure so a session change
  // never leaves a stale header on an in-flight request.
  const identityRef = useMemo(() => ({ current: identity }), []);
  identityRef.current = identity;

  const coordination = useMemo(() => {
    const api = client ?? new ApiClient(() => identityRef.current.sessionId);
    return new Coordination(api);
  }, [client, identityRef]);

  const persist = useCallback(
    (next: Identity) => {
      setIdentity(next);
      identityStore.save(next);
    },
    [identityStore],
  );

  const setActor = useCallback(
    (actorId: string | null) => {
      // Changing actor drops the session: a session belongs to exactly one
      // actor, and keeping it would guarantee session_actor_mismatch.
      persist({ actorId, sessionId: null });
    },
    [persist],
  );

  const setSession = useCallback(
    (sessionId: string | null) => {
      persist({ ...identityRef.current, sessionId });
    },
    [persist, identityRef],
  );

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const value = useMemo<AppValue>(
    () => ({ coordination, identity, setActor, setSession, announcement, announce }),
    [coordination, identity, setActor, setSession, announcement, announce],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside an AppProvider");
  return value;
}

export { EMPTY_IDENTITY };
