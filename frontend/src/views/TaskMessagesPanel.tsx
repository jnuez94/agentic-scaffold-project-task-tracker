/**
 * The task inspector's Messages tab (UI-74).
 *
 * `message list --task` is 1.4.0's; before it the console had no per-task
 * message source and said so. The tab lists every message that names the
 * task, newest first, in the same row treatment as the Messages route. No
 * compose — sending a message about a task is the Broadcast dialog's job and
 * it already takes a task id — and no unread state, which belongs to an inbox
 * and not to a task.
 */

import { useMemo } from "react";
import type { Message } from "../api/contract.ts";
import { EmptyState, ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { isOwnMessage, loadedCountLabel } from "../lib/conversation.ts";
import { BROADCAST_HINT } from "../lib/copy.ts";
import { isTruncated } from "../lib/pagination.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { MessageEntry } from "./MessageEntry.tsx";

const REQUEST_LIMIT = 500;

export function TaskMessagesPanel({
  taskId,
  nameFor,
}: {
  taskId: string;
  nameFor: (id: string) => string;
}) {
  const { coordination, identity } = useApp();
  const messages = useResource(
    () => coordination.messages({ task: taskId, limit: REQUEST_LIMIT }),
    [taskId],
  );
  // The CLI lists oldest first; a tab is read from the latest word down.
  const rows = useMemo<Message[]>(() => [...(messages.data ?? [])].reverse(), [messages.data]);

  if (messages.error) return <ErrorBanner error={messages.error} onRetry={messages.refresh} />;
  if (!messages.loaded) return <SkeletonRows rows={3} columns={2} />;
  if (rows.length === 0) {
    return <EmptyState title="No messages name this task" hint={BROADCAST_HINT} />;
  }

  return (
    <>
      <p className="small muted">
        {loadedCountLabel(rows.length, false)}
        {isTruncated(rows.length, REQUEST_LIMIT)
          ? " The request limit was reached, so older messages about this task are not loaded."
          : ""}
      </p>
      <ul className="transcript">
        {rows.map((message) => (
          <li
            key={message.id}
            className={isOwnMessage(message, identity.actorId) ? "entry own" : "entry"}
          >
            <div className="entry-static">
              <MessageEntry message={message} nameFor={nameFor} showTask={false} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
