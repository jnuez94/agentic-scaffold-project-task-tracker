import { describe, expect, it } from "vitest";
import type { Inbox, InboxMessage } from "../api/contract.ts";
import { readInbox, unreadChip, unreadCountLabel } from "./inbox.ts";

const message = (id: string, sender_id: string, recipient: string): InboxMessage => ({
  id,
  sender_id,
  recipient,
  task_id: null,
  body: id,
  tags: "",
  created_at: "2026-09-16T00:00:00+00:00",
  audit_id: 1,
});

const inbox = (messages: InboxMessage[], cursor = 10, head = 20): Inbox => ({
  agent: "alice",
  cursor,
  head,
  messages,
});

describe("readInbox", () => {
  it("hides the actor's own team messages and counts them", () => {
    const reading = readInbox(
      inbox([message("m-1", "bob", "team"), message("m-2", "alice", "team"), message("m-3", "bob", "alice")]),
      "alice",
      500,
    );
    expect(reading.visible.map((m) => m.id)).toEqual(["m-1", "m-3"]);
    expect(reading.hiddenOwn).toBe(1);
  });

  it("keeps the actor's direct messages to itself visible", () => {
    // A note to oneself is addressed to the inbox; only team broadcasts are excluded.
    const reading = readInbox(inbox([message("m-1", "alice", "alice")]), "alice", 500);
    expect(reading.visible).toHaveLength(1);
  });

  it("recognises a first run: cursor 0 with a head", () => {
    expect(readInbox(inbox([], 0, 20), "alice", 500).firstRun).toBe(true);
    expect(readInbox(inbox([], 0, 0), "alice", 500).firstRun).toBe(false);
    expect(readInbox(inbox([], 5, 20), "alice", 500).firstRun).toBe(false);
  });

  it("marks truncation off the whole response, before the rule hides anything", () => {
    const many = Array.from({ length: 3 }, (_, i) => message(`m-${i}`, "bob", "team"));
    expect(readInbox(inbox(many), "alice", 3).truncated).toBe(true);
    expect(readInbox(inbox(many), "alice", 4).truncated).toBe(false);
  });
});

describe("labels", () => {
  it("count the loaded window in the inbox's noun", () => {
    expect(unreadCountLabel(3, false)).toBe("3 unread loaded");
    expect(unreadCountLabel(500, true)).toBe("500+ unread loaded");
  });

  it("show no chip for nothing unread and a capped one otherwise", () => {
    expect(unreadChip(null)).toBeNull();
    expect(unreadChip(readInbox(inbox([]), "alice", 500))).toBeNull();
    expect(unreadChip(readInbox(inbox([message("m", "bob", "team")]), "alice", 500))).toBe("1");
    const many = Array.from({ length: 2 }, (_, i) => message(`m-${i}`, "bob", "team"));
    expect(unreadChip(readInbox(inbox(many), "alice", 2))).toBe("2+");
  });
});
