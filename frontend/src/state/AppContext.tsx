/**
 * Application-wide collaborators: the API client, identity, and announcements.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import { Coordination } from "../api/coordination.ts";
import {
  browserIdentityStore,
  EMPTY_IDENTITY,
  type Identity,
  type IdentityStore,
} from "./identityStore.ts";
import { useBootstrap, type BootstrapPhase } from "./useBootstrap.ts";
import { useOperatorSession, type OperatorSession } from "./useOperatorSession.ts";

export interface AppValue {
  coordination: Coordination;
  identity: Identity;
  setActor: (actorId: string | null) => void;
  setSession: (sessionId: string | null) => void;
  /** Text pushed to the polite live region after a successful mutation. */
  announcement: string;
  announce: (message: string) => void;
  bootstrap: BootstrapPhase;
  retryBootstrap: () => void;
  /**
   * The validated session every identity surface must read.
   *
   * `identity.sessionId` is only what was persisted; it may name a session
   * that ended or belongs to another actor. `session.activeSessionId` is the
   * one that actually exists and matches the selected actor.
   */
  session: OperatorSession;
  /**
   * Whether mutation controls may be enabled at all.
   *
   * False for the whole of startup, so the queue never shows an enabled action
   * before an accountable actor is resolved. After startup settles it depends
   * only on having an actor, which keeps a manual actor choice usable when the
   * automatic bootstrap hit a conflict.
   */
  mutationsEnabled: boolean;
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

  // The client reads the session through a ref so a session change never leaves
  // a stale header on an in-flight request.
  //
  // A real useRef, not useMemo with empty deps. That was a hand-rolled ref, and
  // useMemo is documented as a hint React may discard: relying on it to keep an
  // object identity stable is unsound, and it was also the codebase's one
  // unexplained exhaustive-deps violation. useRef is the tool for a stable
  // mutable box and needs no suppression.
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const api = useMemo(
    () => client ?? new ApiClient(() => identityRef.current.sessionId),
    [client, identityRef],
  );
  const coordination = useMemo(() => new Coordination(api), [api]);
  // Startup acts as local-operator before that actor has a session, so it must
  // not send one persisted from a previous actor.
  const bootstrapCoordination = useMemo(
    () => new Coordination(api.withoutSession()),
    [api],
  );

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

  // Bootstrap selects the local operator as the *default*; an actor the user
  // already chose is left alone.
  const adoptDefault = useCallback(
    (actorId: string, sessionId: string) => {
      if (identityRef.current.actorId) return;
      persist({ actorId, sessionId });
    },
    [persist, identityRef],
  );

  const clearStaleSession = useCallback(() => {
    persist({ ...identityRef.current, sessionId: null });
  }, [persist, identityRef]);

  const session = useOperatorSession(
    coordination,
    identity.actorId,
    identity.sessionId,
    clearStaleSession,
  );

  const { phase, retry } = useBootstrap(bootstrapCoordination, adoptDefault);
  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const value = useMemo<AppValue>(
    () => ({
      coordination,
      identity,
      setActor,
      setSession,
      announcement,
      announce,
      bootstrap: phase,
      retryBootstrap: retry,
      session,
      mutationsEnabled: phase.kind !== "loading" && Boolean(identity.actorId),
    }),
    [coordination, identity, setActor, setSession, announcement, announce, phase, retry, session],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside an AppProvider");
  return value;
}

export { EMPTY_IDENTITY };
