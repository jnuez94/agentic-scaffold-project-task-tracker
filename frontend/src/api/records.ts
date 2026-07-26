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

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
  facets: { object_types: string[]; actions: string[]; actors: string[] };
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
  truncated_sections: string[];
}

export interface Summary {
  totals: Record<string, number>;
  task_status: Record<string, number>;
  task_priority: Record<string, number>;
  escalation_status: Record<string, number>;
  session_status: Record<string, number>;
  workload: {
    agent_id: string;
    name: string;
    role: string;
    status: string;
    assigned: number;
    in_progress: number;
    blocked: number;
    done: number;
  }[];
  recent_audit: AuditEntry[];
}
