/**
 * The acting actor's inbox as state (UI-68).
 *
 * Loaded for the actor in the header and reloaded when they change or when
 * the console itself sends something. The cursor moves only through
 * `markAllRead`, which sends the head the list call returned — never a value
 * computed here, never on view, never per message, because the package keeps
 * one position per agent and the console must not invent finer ones.
 */

import { useCallback, useMemo, useState } from "react";
import type { Coordination } from "../api/coordination.ts";
import type { Inbox, InboxMark } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";
import { readInbox, type InboxReading } from "../lib/inbox.ts";
import { useResource, type Resource } from "./useResource.ts";

export const INBOX_REQUEST_LIMIT = 500;

export interface InboxState {
  /** False without an actor: an inbox has an owner. */
  enabled: boolean;
  actorId: string | null;
  resource: Resource<Inbox>;
  reading: InboxReading | null;
  marking: boolean;
  markError: ApiError | undefined;
  markAllRead: () => Promise<InboxMark | null>;
}

export function useInbox(
  coordination: Coordination,
  actorId: string | null,
  reloadKey = 0,
): InboxState {
  const enabled = Boolean(actorId);
  const resource = useResource(
    () => coordination.inbox({ agent: actorId ?? "", limit: INBOX_REQUEST_LIMIT }),
    [actorId, reloadKey],
    { enabled },
  );

  // Guarded on the envelope naming the current actor, so a change of actor
  // never shows the previous actor's unread as this one's while the reload
  // is in flight.
  const reading = useMemo(
    () =>
      actorId && resource.data && resource.data.agent === actorId
        ? readInbox(resource.data, actorId, INBOX_REQUEST_LIMIT)
        : null,
    [actorId, resource.data],
  );

  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<ApiError | undefined>(undefined);

  const markAllRead = useCallback(async () => {
    const head = resource.data?.head;
    if (!actorId || head === undefined) return null;
    setMarking(true);
    try {
      const mark = await coordination.markInboxRead({ agent: actorId, cursor: head });
      setMarkError(undefined);
      resource.refresh();
      return mark;
    } catch (caught: unknown) {
      setMarkError(
        caught instanceof ApiError
          ? caught
          : new ApiError("network_error", describeThrown(caught), 0),
      );
      return null;
    } finally {
      setMarking(false);
    }
  }, [actorId, coordination, resource]);

  return { enabled, actorId, resource, reading, marking, markError, markAllRead };
}
