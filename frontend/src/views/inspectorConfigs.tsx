/**
 * Per-entity inspector layout, declared as data (UI-29).
 *
 * One shell renders all six entities; the differences live here for the same
 * reason recordConfigs exists — six near-identical components would drift.
 *
 * Two rules shape every layout and are worth stating once rather than six
 * times. Constraint first: whatever field says what a record does *not*
 * authorise renders directly beneath the metrics, following UI-25 where
 * promoting the blocking reason above Description was the change that
 * mattered. And absence is meaningful for those fields only — an empty
 * `blocked_claims` renders "None recorded" because "we did not limit this" is
 * a statement, while an empty descriptive field is just noise and is dropped.
 *
 * Nothing is deliberately omitted: every field in each list response appears in
 * `metrics`, `fields`, or `footer`. Audit, Health and Export have no config
 * because they get no inspector — audit rows are already complete in the table,
 * Health is a findings list, and Export is a generated document.
 *
 * Spec: .documents/ux-entity-inspectors-spec.md section 5.
 */

import type { RouteName } from "../state/useHashRoute.ts";

export type Row = Record<string, unknown>;

export interface FieldSpec {
  /** Key in the list response. */
  key: string;
  label: string;
  /** How to render the value; defaults to wrapped text. */
  kind?: "text" | "mono" | "tags" | "time" | "taskLinks" | "agentLink" | "taskLink";
  /**
   * Constraint fields state an authority boundary. They render first and show
   * "None recorded" when empty instead of disappearing.
   */
  constraint?: boolean;
  /** Copy shown when a constraint field is empty. */
  emptyText?: string;
}

export interface InspectorConfig {
  /** Entity kind, shown above the id. */
  kind: string;
  /** Field holding a human title, if the entity has one. */
  titleKey?: string;
  metrics: { label: string; key: string; kind?: FieldSpec["kind"] }[];
  fields: FieldSpec[];
  /** Keys rendered in the diagnostic footer. */
  footer: string[];
}

const CONSTRAINT_EMPTY = "None recorded";

export const INSPECTOR_CONFIGS: Partial<Record<RouteName, InspectorConfig>> = {
  agents: {
    kind: "agent",
    titleKey: "name",
    metrics: [
      { label: "Type", key: "actor_type" },
      { label: "Status", key: "status" },
      { label: "Updated", key: "updated_at", kind: "time" },
    ],
    fields: [
      {
        key: "unavailable_for",
        label: "Unavailable for",
        constraint: true,
        emptyText: CONSTRAINT_EMPTY,
      },
      { key: "role", label: "Role" },
      { key: "goal", label: "Goal" },
      { key: "responsibilities", label: "Responsibilities" },
      { key: "decision_authority", label: "Decision authority" },
      { key: "review_authority", label: "Review authority" },
      { key: "escalation_rules", label: "Escalation rules" },
      { key: "operating_style", label: "Operating style" },
    ],
    footer: ["id", "created_at"],
  },

  decisions: {
    kind: "decision",
    titleKey: "title",
    metrics: [
      { label: "Status", key: "status" },
      { label: "Owner", key: "owner_id", kind: "agentLink" },
      { label: "Updated", key: "updated_at", kind: "time" },
    ],
    fields: [
      {
        key: "blocked_claims",
        label: "What this does not authorise",
        constraint: true,
        emptyText: CONSTRAINT_EMPTY,
      },
      // Ruling before preamble: they opened this to read what was decided.
      { key: "decision", label: "Decision" },
      { key: "context", label: "Context" },
      { key: "options_considered", label: "Options considered" },
      { key: "implications", label: "Implications" },
      { key: "evidence", label: "Evidence" },
      { key: "review_required", label: "Review required" },
    ],
    footer: ["id", "created_at"],
  },

  reviews: {
    kind: "review",
    titleKey: "scope",
    metrics: [
      { label: "Decision", key: "decision" },
      { label: "Reviewer", key: "reviewer_id", kind: "agentLink" },
      { label: "Task", key: "task_id", kind: "taskLink" },
      { label: "Created", key: "created_at", kind: "time" },
    ],
    fields: [
      {
        key: "blocked_claims",
        label: "What this review does not approve",
        constraint: true,
        emptyText: CONSTRAINT_EMPTY,
      },
      { key: "scope", label: "Scope" },
      { key: "accepted_items", label: "Accepted items" },
      // What makes a conditional acceptance conditional; previously invisible.
      { key: "required_changes", label: "Required changes" },
      { key: "remaining_risks", label: "Remaining risks" },
      { key: "follow_up_tasks", label: "Follow-up tasks", kind: "taskLinks" },
    ],
    footer: ["id", "artifact_uri"],
  },

  escalations: {
    kind: "escalation",
    metrics: [
      { label: "Status", key: "status" },
      { label: "Owner", key: "owner_id", kind: "agentLink" },
      { label: "Raised by", key: "raised_by", kind: "agentLink" },
      { label: "Needed by", key: "needed_by" },
    ],
    fields: [
      { key: "issue", label: "Issue" },
      { key: "requested_decision", label: "Requested decision" },
      // Rendered even when empty: "still open" is the point of the record.
      {
        key: "resolution",
        label: "Resolution",
        constraint: true,
        emptyText: "Not yet resolved",
      },
      { key: "related_tasks", label: "Related tasks", kind: "taskLinks" },
      { key: "follow_up_tasks", label: "Follow-up tasks", kind: "taskLinks" },
    ],
    footer: ["id", "created_at", "updated_at"],
  },

  artifacts: {
    kind: "artifact",
    titleKey: "type",
    metrics: [
      { label: "Status", key: "status" },
      { label: "Type", key: "type" },
      { label: "Owner", key: "owner_id", kind: "agentLink" },
      { label: "Updated", key: "updated_at", kind: "time" },
    ],
    fields: [
      {
        key: "usage_boundaries",
        label: "Usage boundaries",
        constraint: true,
        emptyText: CONSTRAINT_EMPTY,
      },
      // Text, never a link: a repository path is not a resolvable URL.
      { key: "uri", label: "URI", kind: "mono" },
      { key: "related_tasks", label: "Related tasks", kind: "taskLinks" },
      { key: "reviewers", label: "Reviewers", kind: "tags" },
    ],
    footer: ["id", "created_at"],
  },

  sessions: {
    kind: "session",
    metrics: [
      { label: "Status", key: "status" },
      { label: "Agent", key: "agent_id", kind: "agentLink" },
      { label: "Harness", key: "harness" },
      { label: "Model", key: "model" },
    ],
    fields: [
      { key: "started_at", label: "Started", kind: "time" },
      { key: "last_seen_at", label: "Last seen", kind: "time" },
      { key: "ended_at", label: "Ended", kind: "time" },
    ],
    footer: ["id"],
  },
};

export { isEmptyValue, visibleFields } from "../lib/inspectorFields.ts";
