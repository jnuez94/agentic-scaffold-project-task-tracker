/**
 * Governance and system row shapes from docs/cli-contract.md v1.2.0.
 *
 * Split from contract.ts purely for file size; both mirror the same
 * contract version and must be rechecked together when it changes.
 */

import type {
  ArtifactStatus,
  DecisionStatus,
  EscalationStatus,
  Session,
  Task,
} from "./contract.ts";

export interface Decision {
  id: string;
  title: string;
  owner_id: string;
  status: DecisionStatus;
  context: string;
  decision: string;
  options_considered: string;
  implications: string;
  evidence: string;
  blocked_claims: string;
  review_required: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient: string;
  task_id: string | null;
  body: string;
  tags: string;
  created_at: string;
}

/** A Message row as `inbox list` returns it: with the audit id of its send. */
export interface InboxMessage extends Message {
  audit_id: number;
}

/**
 * An agent's inbox (1.4.0): messages to it or to `team` above its cursor — a
 * read position the agent asserts about itself. Listing never moves it.
 */
export interface Inbox {
  agent: string;
  cursor: number;
  head: number;
  messages: InboxMessage[];
}

export interface InboxMark {
  agent: string;
  previous_cursor: number;
  cursor: number;
  head: number;
}

export interface Artifact {
  id: string;
  uri: string;
  owner_id: string;
  type: string;
  status: ArtifactStatus;
  usage_boundaries: string;
  created_at: string;
  updated_at: string;
  related_tasks: string[];
  reviewers: string[];
}

export interface Escalation {
  id: string;
  raised_by: string;
  owner: string;
  status: EscalationStatus;
  related_tasks: string;
  needed_by: string | null;
  issue: string;
  requested_decision: string;
  resolution: string;
  follow_up_tasks: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  actor: string;
  session_id: string | null;
  action: string;
  object_type: string;
  object_id: string;
  detail: string;
  created_at: string;
}

export interface Meta {
  root: string;
  config: string;
  database: string;
  executable: string;
  project_root: string;
  cli_version: string;
  schema_version: number;
  statuses: Record<string, string[]>;
  transitions: Record<string, string[]>;
}

export interface Health {
  healthy: boolean;
  unowned_tasks: Task[];
  stale_tasks: Task[];
  stale_sessions: Session[];
  unclaimed_in_progress_tasks: Task[];
  invalid_active_claims: Record<string, string>[];
  active_blockers: Task[];
  done_without_evidence: Task[];
  open_escalations: Escalation[];
  /** Informational since 1.4.0: normal workflow worth surfacing; never affects `healthy`. */
  tasks_awaiting_review: Task[];
  /** Every computed section, grouped by kind; the top-level keys remain for existing readers. */
  anomalies: Record<string, unknown[]>;
  informational: Record<string, unknown[]>;
  truncated_sections: string[];
}

/**
 * `summary` (1.4.0). Every count comes from one read transaction, so the
 * numbers agree with each other; `--section` computes only the named parts,
 * which is why everything but the cursor and the section list is optional.
 */
export interface Summary {
  /** The highest audit id at the snapshot: the change-detection cursor. */
  audit_cursor: number;
  sections: string[];
  totals?: Record<string, number>;
  task_status?: Record<string, number>;
  task_priority?: Record<string, number>;
  workload?: {
    agent_id: string;
    agent_status: string;
    assigned_open_tasks: number;
    claimed_tasks: number;
    active_sessions: number;
  }[];
  workload_truncated?: boolean;
  time_in_state?: Record<string, { count: number; oldest_seconds: number; average_seconds: number }>;
}
