/**
 * One message as the console renders it everywhere: time, sender's initials,
 * who it was to, the task and tags if any, and the complete body — newlines
 * kept, long tokens wrapped, never truncated.
 *
 * Presentation only. The transcript wraps it in a button that opens the
 * inspector; the task inspector's Messages tab lays it out statically. Both
 * render the same row because both render this.
 */

import type { Message } from "../api/contract.ts";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { initials, splitTags } from "../lib/labels.ts";

export function MessageEntry({
  message,
  nameFor,
  showTask = true,
}: {
  message: Message;
  nameFor: (id: string) => string;
  /** Off where every row is about the same task, so the meta is not noise. */
  showTask?: boolean;
}) {
  const tags = splitTags(message.tags);
  return (
    <>
      <span className="entry-time mono" title={absoluteTime(message.created_at)}>
        {new Date(message.created_at).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>

      <span className="entry-avatar" aria-hidden="true">
        {initials(nameFor(message.sender_id))}
      </span>

      <span className="entry-main">
        <span className="entry-head">
          <span className="entry-parties">
            <strong>{nameFor(message.sender_id)}</strong>
            <span aria-hidden="true"> → </span>
            <span className="visually-hidden"> to </span>
            <span className={message.recipient === "team" ? "to-team" : "to-one"}>
              {message.recipient}
            </span>
          </span>
          {showTask && message.task_id ? (
            <span className="entry-meta small">
              Task: <span className="mono">{message.task_id}</span>
            </span>
          ) : null}
          {tags.length > 0 ? (
            <span className="entry-meta small">
              Tags:{" "}
              {tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
          <span className="entry-ago small muted">{relativeTime(message.created_at)}</span>
        </span>

        <span className="entry-body">{message.body}</span>
      </span>
    </>
  );
}
