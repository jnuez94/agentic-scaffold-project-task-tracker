/**
 * Row shapes from docs/cli-contract.md v1.2.0, "Common Row Shapes".
 *
 * These are mirrored by hand. The contract is the authority; when its version
 * changes these must be rechecked. FE-STACK-1 records that obligation.
 */

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type ReleaseTarget = "todo" | "review" | "blocked";
export type ActorType = "ai" | "human" | "service";
export type AgentStatus = "active" | "inactive";
export type SessionStatus = "active" | "ended";
export type DependencyType =
  | "blocks"
  | "informs"
  | "review_required"
  | "evidence_required";
export type ReviewDecision =
  | "accepted"
  | "conditionally_accepted"
  | "changes_requested"
  | "rejected";
export type DecisionStatus = "proposed" | "accepted" | "superseded" | "rejected";
export type ArtifactStatus = "draft" | "review" | "accepted" | "superseded";
export type EscalationStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "closed_no_action";

export interface Agent {
  id: string;
  name: string;
  role: string;
  actor_type: ActorType;
  status: AgentStatus;
  responsibilities: string;
  goal: string;
  operating_style: string;
  decision_authority: string;
  review_authority: string;
  escalation_rules: string;
  unavailable_for: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  agent_id: string;
  harness: string;
  model: string;
  status: SessionStatus;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  tags: string;
  acceptance_criteria: string;
  next_steps: string;
  blocked_claims: string;
  notes: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskListRow extends Task {
  claimed_by: string | null;
  claim_session_id: string | null;
  claimed_at: string | null;
  assignees: string[];
  evidence_count: number;
}

export interface Evidence {
  id: number;
  task_id: string;
  uri: string;
  evidence_type: string;
  added_by: string;
  created_at: string;
}

export interface Dependency {
  task_id: string;
  depends_on_task_id: string;
  dependency_type: DependencyType;
  status: "active" | "resolved";
  rationale: string;
  created_at: string;
}

export interface Review {
  id: string;
  task_id: string | null;
  reviewer_id: string;
  artifact_uri: string;
  scope: string;
  decision: ReviewDecision;
  accepted_items: string;
  required_changes: string;
  remaining_risks: string;
  blocked_claims: string;
  follow_up_tasks: string;
  created_at: string;
}

export interface TaskDetail extends TaskListRow {
  evidence: Evidence[];
  dependencies: Dependency[];
  reviews: Review[];
}

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
