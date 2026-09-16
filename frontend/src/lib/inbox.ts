/**
 * Reading an inbox envelope the way the console shows it (UI-68).
 *
 * The package includes, in an agent's inbox, the messages that agent itself
 * sent to `team`. Those are the sender's, not the inbox's, so the console
 * hides them and says so once — a stated rule, not a filter the operator has
 * to find. Everything else is shown oldest first, as the CLI orders it.
 */

import type { Inbox, InboxMessage } from "../api/contract.ts";

export const FIRST_RUN_LINE =
  "Your inbox starts at the beginning of the record; mark all as read to start from now.";

export const OWN_TEAM_RULE =
  "Messages you sent to the team are not shown here: they are yours, not your inbox's.";

export interface InboxReading {
  /** Unread messages the actor did not send to team, oldest first. */
  visible: InboxMessage[];
  /** How many own team messages the rule removed. */
  hiddenOwn: number;
  /** Cursor 0 with a head: the agent predates 1.4.0 and has never marked read. */
  firstRun: boolean;
  /** The list hit the request limit; older unread may exist. */
  truncated: boolean;
}

export function readInbox(inbox: Inbox, actorId: string, requestLimit: number): InboxReading {
  const visible = inbox.messages.filter(
    (message) => !(message.sender_id === actorId && message.recipient === "team"),
  );
  return {
    visible,
    hiddenOwn: inbox.messages.length - visible.length,
    firstRun: inbox.cursor === 0 && inbox.head > 0,
    truncated: inbox.messages.length >= requestLimit,
  };
}

/** "3 unread loaded", "500+ unread loaded": the loaded-window contract, in the inbox's noun. */
export function unreadCountLabel(count: number, truncated: boolean): string {
  return `${count}${truncated ? "+" : ""} unread loaded`;
}

/** The nav chip: nothing when nothing is unread, a capped count otherwise. */
export function unreadChip(reading: InboxReading | null): string | null {
  if (!reading || reading.visible.length === 0) return null;
  return `${reading.visible.length}${reading.truncated ? "+" : ""}`;
}
