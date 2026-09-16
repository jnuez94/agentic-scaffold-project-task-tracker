/**
 * The chronological transcript presentation of loaded messages.
 *
 * Renders the same rows the Ledger table renders — no extra query, no thread,
 * no reply. Schema v1 has no thread, reply, read or delivery concept, so this
 * is a presentation of flat Message records and nothing here may imply
 * otherwise. See docs/ux-data-shape-and-workflow-spec.md.
 */

import { useEffect, useRef } from "react";
import type { Message } from "../api/contract.ts";
import { EmptyState } from "../components/Feedback.tsx";
import { BROADCAST_HINT, CLEAR_FILTER_HINT, NO_MESSAGES_MATCH } from "../lib/copy.ts";
import { groupByDay, isOwnMessage } from "../lib/conversation.ts";
import { distanceFromBottom, getScrollParent } from "../lib/scrollParent.ts";
import { MessageEntry } from "./MessageEntry.tsx";

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
        title={filtered ? NO_MESSAGES_MATCH : "No messages yet"}
        hint={filtered ? CLEAR_FILTER_HINT : BROADCAST_HINT}
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
                    <MessageEntry message={message} nameFor={nameFor} />
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
