/**
 * Column and loader configuration for the non-task entity views.
 *
 * One shared table implementation keeps every entity consistent; the per-entity
 * differences live here as data rather than as seven near-identical components.
 */

import type { Column } from "../components/DataTable.tsx";
import { IdCell, Mono, Tags } from "../components/Fields.tsx";
import { EnumPill } from "../components/Pill.tsx";
import type { Coordination } from "../api/coordination.ts";
import { preview, relativeTime } from "../lib/format.ts";
import type { RouteName } from "../state/useHashRoute.ts";

export interface RecordConfig {
  title: string;
  description: string;
  emptyTitle: string;
  emptyHint: string;
  filterFields: string[];
  filterPlaceholder: string;
  statusOptions?: { param: string; label: string; values: string[] };
  load: (coordination: Coordination, query: Record<string, string>) => Promise<unknown[]>;
  columns: Column<never>[];
}

const time = (value: string) => <span className="small">{relativeTime(value)}</span>;

// Cast helper: DataTable is generic, the registry is heterogeneous.
function columns<T>(list: Column<T>[]): Column<never>[] {
  return list as unknown as Column<never>[];
}

export const RECORD_CONFIGS: Partial<Record<RouteName, RecordConfig>> = {
  agents: {
    title: "Agents",
    description: "Durable accountable identities. Actor type describes what an identity is, not which harness ran it.",
    emptyTitle: "No agents registered",
    emptyHint: "Register one with `coordination agent add`.",
    filterFields: ["id", "name", "role", "goal"],
    filterPlaceholder: "Filter loaded agents…",
    load: (c, q) => c.agents({ all: "1", ...q }),
    columns: columns<Record<string, string>>([
      { key: "id", header: "Agent", priority: 1, render: (r) => <IdCell id={r["id"]!} title={r["name"]} /> },
      { key: "role", header: "Role", priority: 2, render: (r) => r["role"] },
      { key: "type", header: "Type", priority: 4, render: (r) => <EnumPill value={r["actor_type"]!} /> },
      { key: "status", header: "Status", priority: 3, render: (r) => <EnumPill value={r["status"]!} /> },
      { key: "goal", header: "Goal", priority: 6, render: (r) => <span className="small">{preview(r["goal"] ?? "", 90)}</span> },
      { key: "updated", header: "Updated", priority: 8, render: (r) => time(r["updated_at"]!) },
    ]),
  },

  sessions: {
    title: "Sessions",
    description: "One execution of a harness by an actor. A task claim always belongs to exactly one active session.",
    emptyTitle: "No sessions recorded",
    emptyHint: "Start one with `coordination session start`.",
    filterFields: ["id", "agent_id", "harness", "model"],
    filterPlaceholder: "Filter loaded sessions…",
    statusOptions: { param: "status", label: "Status", values: ["active", "ended"] },
    load: (c, q) => c.sessions(q),
    columns: columns<Record<string, string>>([
      { key: "id", header: "Session", priority: 1, render: (r) => <Mono>{r["id"]}</Mono> },
      { key: "agent", header: "Agent", priority: 2, render: (r) => <Mono>{r["agent_id"]}</Mono> },
      { key: "harness", header: "Harness", priority: 4, render: (r) => r["harness"] },
      { key: "model", header: "Model", priority: 6, render: (r) => <span className="small muted">{r["model"] || "—"}</span> },
      { key: "status", header: "Status", priority: 3, render: (r) => <EnumPill value={r["status"]!} /> },
      { key: "seen", header: "Last seen", priority: 5, render: (r) => time(r["last_seen_at"]!) },
    ]),
  },

  reviews: {
    title: "Reviews",
    description: "Scoped assessments. Blocked claims state what an acceptance does not authorize.",
    emptyTitle: "No reviews recorded",
    emptyHint: "Add one with `coordination review add`.",
    filterFields: ["id", "reviewer_id", "scope", "artifact_uri", "task_id"],
    filterPlaceholder: "Filter loaded reviews…",
    load: (c, q) => c.reviews(q),
    columns: columns<Record<string, string>>([
      { key: "id", header: "Review", priority: 1, render: (r) => <IdCell id={r["id"]!} title={r["scope"]} /> },
      { key: "decision", header: "Decision", priority: 2, render: (r) => <EnumPill value={r["decision"]!} /> },
      { key: "reviewer", header: "Reviewer", priority: 3, render: (r) => <Mono>{r["reviewer_id"]}</Mono> },
      { key: "task", header: "Task", priority: 4, render: (r) => <Mono>{r["task_id"] ?? "—"}</Mono> },
      { key: "artifact", header: "Artifact", priority: 6, render: (r) => <span className="small mono">{preview(r["artifact_uri"] ?? "", 48)}</span> },
      { key: "created", header: "Created", priority: 7, render: (r) => time(r["created_at"]!) },
    ]),
  },

  decisions: {
    title: "Decisions",
    description: "Consequential choices recorded instead of left in chat history.",
    emptyTitle: "No decisions recorded",
    emptyHint: "Add one with `coordination decision add`.",
    filterFields: ["id", "title", "owner_id", "context", "decision"],
    filterPlaceholder: "Filter loaded decisions…",
    load: (c, q) => c.decisions(q),
    columns: columns<Record<string, string>>([
      { key: "id", header: "Decision", priority: 1, render: (r) => <IdCell id={r["id"]!} title={r["title"]} /> },
      { key: "status", header: "Status", priority: 2, render: (r) => <EnumPill value={r["status"]!} /> },
      { key: "owner", header: "Owner", priority: 3, render: (r) => <Mono>{r["owner_id"]}</Mono> },
      { key: "decision", header: "Decision", priority: 5, render: (r) => <span className="small">{preview(r["decision"] ?? "", 110)}</span> },
      { key: "updated", header: "Updated", priority: 7, render: (r) => time(r["updated_at"]!) },
    ]),
  },

  messages: {
    title: "Messages",
    description: "Directed coordination traffic. A recipient filter also returns messages addressed to `team`.",
    emptyTitle: "No messages",
    emptyHint: "Send one with `coordination message send`.",
    filterFields: ["id", "sender_id", "recipient", "body", "tags", "task_id"],
    filterPlaceholder: "Filter loaded messages…",
    load: (c, q) => c.messages(q),
    columns: columns<Record<string, string>>([
      { key: "id", header: "Message", priority: 4, render: (r) => <Mono>{r["id"]}</Mono> },
      { key: "from", header: "From → To", priority: 1, render: (r) => (<span className="small"><Mono>{r["sender_id"]}</Mono> → <Mono>{r["recipient"]}</Mono></span>) },
      { key: "body", header: "Body", priority: 2, render: (r) => <span className="small">{preview(r["body"] ?? "", 140)}</span> },
      { key: "task", header: "Task", priority: 5, render: (r) => <Mono>{r["task_id"] ?? "—"}</Mono> },
      { key: "tags", header: "Tags", priority: 6, render: (r) => <Tags value={r["tags"] ?? ""} /> },
      { key: "created", header: "Sent", priority: 3, render: (r) => time(r["created_at"]!) },
    ]),
  },

  artifacts: {
    title: "Artifacts",
    description: "Produced things with an owner and explicit usage boundaries.",
    emptyTitle: "No artifacts recorded",
    emptyHint: "Add one with `coordination artifact add`.",
    filterFields: ["id", "uri", "owner_id", "type"],
    filterPlaceholder: "Filter loaded artifacts…",
    statusOptions: { param: "status", label: "Status", values: ["draft", "review", "accepted", "superseded"] },
    load: (c, q) => c.artifacts(q),
    columns: columns<Record<string, string | string[]>>([
      { key: "id", header: "Artifact", priority: 1, render: (r) => <IdCell id={String(r["id"])} title={String(r["type"])} /> },
      { key: "status", header: "Status", priority: 2, render: (r) => <EnumPill value={String(r["status"])} /> },
      { key: "uri", header: "URI", priority: 3, render: (r) => <span className="small mono">{String(r["uri"])}</span> },
      { key: "owner", header: "Owner", priority: 4, render: (r) => <Mono>{String(r["owner_id"])}</Mono> },
      { key: "tasks", header: "Tasks", priority: 6, render: (r) => <Mono>{(r["related_tasks"] as string[]).join(", ") || "—"}</Mono> },
    ]),
  },

  escalations: {
    title: "Escalations",
    description: "Decisions requested from an owner with the authority to make them.",
    emptyTitle: "No escalations",
    emptyHint: "A healthy project usually has none open.",
    filterFields: ["id", "raised_by", "owner", "issue", "requested_decision"],
    filterPlaceholder: "Filter loaded escalations…",
    statusOptions: { param: "status", label: "Status", values: ["open", "in_review", "resolved", "closed_no_action"] },
    load: (c, q) => c.escalations(q),
    columns: columns<Record<string, string>>([
      { key: "id", header: "Escalation", priority: 1, render: (r) => <IdCell id={r["id"]!} title={preview(r["issue"] ?? "", 70)} /> },
      { key: "status", header: "Status", priority: 2, render: (r) => <EnumPill value={r["status"]!} /> },
      { key: "owner", header: "Owner", priority: 3, render: (r) => r["owner"] },
      { key: "raised", header: "Raised by", priority: 5, render: (r) => <Mono>{r["raised_by"]}</Mono> },
      { key: "asked", header: "Requested decision", priority: 4, render: (r) => <span className="small">{preview(r["requested_decision"] ?? "", 100)}</span> },
      { key: "created", header: "Raised", priority: 7, render: (r) => time(r["created_at"]!) },
    ]),
  },
};
