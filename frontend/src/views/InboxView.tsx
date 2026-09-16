/**
 * The acting actor's inbox (UI-68): what is addressed to them or to the team
 * and not yet marked read, oldest first as the CLI orders it.
 *
 * One control, "Mark all as read", moves the cursor to the head the list call
 * returned. Viewing moves nothing — the package keeps one read position per
 * agent, and a console that advanced it on sight would turn an accountability
 * record into a guess. No per-message state, no notifications.
 */

import type { InboxMark } from "../api/contract.ts";
import type { InboxState } from "../state/useInbox.ts";
import { EmptyState, ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { FIRST_RUN_LINE, OWN_TEAM_RULE, unreadCountLabel } from "../lib/inbox.ts";
import { isOwnMessage } from "../lib/conversation.ts";
import { MessageEntry } from "./MessageEntry.tsx";

export function InboxView({
  inbox,
  nameFor,
  onMarked,
}: {
  inbox: InboxState;
  nameFor: (id: string) => string;
  /** Called with the mark the CLI returned, for the announcement. */
  onMarked: (mark: InboxMark) => void;
}) {
  const { resource, reading, marking, markError, markAllRead, actorId } = inbox;

  if (resource.error) return <ErrorBanner error={resource.error} onRetry={resource.refresh} />;
  if (!reading) return <SkeletonRows rows={4} columns={2} />;

  const mark = async () => {
    const result = await markAllRead();
    if (result) onMarked(result);
  };

  return (
    <div className="inbox">
      <div className="inbox-toolbar">
        <p className="small muted">{unreadCountLabel(reading.visible.length, reading.truncated)}</p>
        <button
          type="button"
          onClick={() => void mark()}
          disabled={marking || (reading.visible.length === 0 && reading.hiddenOwn === 0)}
        >
          {marking ? "Marking…" : "Mark all as read"}
        </button>
      </div>

      {reading.firstRun ? <p className="inbox-note small">{FIRST_RUN_LINE}</p> : null}
      {reading.hiddenOwn > 0 ? <p className="inbox-note small muted">{OWN_TEAM_RULE}</p> : null}
      {markError ? <ErrorBanner error={markError} /> : null}

      {reading.visible.length === 0 ? (
        <EmptyState
          title="Nothing unread"
          hint="Messages to you or to the team appear here until you mark them read."
        />
      ) : (
        <ul className="transcript">
          {reading.visible.map((message) => (
            <li
              key={message.id}
              className={isOwnMessage(message, actorId) ? "entry own" : "entry"}
            >
              <div className="entry-static">
                <MessageEntry message={message} nameFor={nameFor} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
