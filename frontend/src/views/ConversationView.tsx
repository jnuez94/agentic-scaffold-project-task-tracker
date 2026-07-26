/**
 * The chronological transcript presentation of loaded messages.
 *
 * Renders the same rows the Ledger table renders — no extra query, no thread,
 * no reply. Visual target:
 * .documents/assets/conversation-direction-operational-transcript.png
 */

import { useEffect, useRef } from "react";
import type { Message } from "../api/contract.ts";
import { EmptyState } from "../components/Feedback.tsx";
import { groupByDay, isOwnMessage } from "../lib/conversation.ts";
import { distanceFromBottom, getScrollParent } from "../lib/scrollParent.ts";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { initials, splitTags } from "../lib/labels.ts";

const NEAR_BOTTOM_PX = 120;

export function ConversationView({
  messages,
  actorId,
  nameFor,
  selectedId,
  onSelect,
  filtered,
}: {
  messages: Message[];
  actorId: string | null;
  nameFor: (id: string) => string;
  selectedId: string | null;
  onSelect: (message: Message, element: HTMLElement) => void;
  filtered: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const wasNearBottom = useRef(true);

  // The transcript has no scroller of its own; the surrounding content region
  // scrolls, so anchoring has to track that ancestor.
  useEffect(() => {
    const scroller = getScrollParent(root.current);
    if (!scroller) return;
    const onScroll = () => {
      wasNearBottom.current = distanceFromBottom(scroller) <= NEAR_BOTTOM_PX;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  // Criterion 11: a refresh only jumps to the newest message when the operator
  // was already reading the newest ones. Otherwise their place is left alone.
  useEffect(() => {
    const scroller = getScrollParent(root.current);
    if (!scroller) return;
    if (wasNearBottom.current) scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <EmptyState
        title={filtered ? "No loaded messages match this filter" : "No messages yet"}
        hint={
          filtered
            ? "Clear the filter to see everything loaded."
            : "Use Broadcast to team in the toolbar to send the first one."
        }
      />
    );
  }

  const groups = groupByDay(messages);

  return (
    <div className="conversation" ref={root}>
      {groups.map((group) => (
        <section key={group.key} className="day-group" aria-label={group.label}>
          <h3 className="day-heading">
            <span>{group.label}</span>
          </h3>

          <ul className="transcript">
            {group.messages.map((message) => {
              const own = isOwnMessage(message, actorId);
              const selected = message.id === selectedId;
              const tags = splitTags(message.tags);
              return (
                <li
                  key={message.id}
                  className={[
                    "entry",
                    own ? "own" : "",
                    selected ? "selected" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <button
                    type="button"
                    className="entry-button"
                    aria-pressed={selected}
                    onClick={(event) => onSelect(message, event.currentTarget)}
                  >
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
                        {message.task_id ? (
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
                        <span className="entry-ago small muted">
                          {relativeTime(message.created_at)}
                        </span>
                      </span>

                      <span className="entry-body">{message.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
