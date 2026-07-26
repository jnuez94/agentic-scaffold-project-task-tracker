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

export type {
  Artifact,
  AuditEntry,
  AuditPage,
  Decision,
  Escalation,
  Health,
  Message,
  Meta,
  Summary,
} from "./records.ts";
