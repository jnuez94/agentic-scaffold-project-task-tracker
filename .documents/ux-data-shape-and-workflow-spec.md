# Coordination Console — UX Data Shapes and Workflow Contract

| Field | Value |
| --- | --- |
| Status | Draft; visual direction awaiting user selection |
| Owner | `mikhail-ux` — UX Designer |
| Tracked by | `UX-1`; informs `UI-2` |
| Contract of record | `.agents/agentic-project-scaffold-lite/docs/cli-contract.md` v1.2.0 |
| Schema of record | `.agents/agentic-project-scaffold-lite/sqlite/schema.sql` v1 |
| Upstream reference | `jnuez94/agentic-project-scaffold-lite` |

## 1. UX outcome

The console is an operator surface for the coordination contract, not a generic
SQLite viewer. It must help a human or AI-assisted operator:

1. see work that needs attention;
2. understand ownership, claims, dependencies, evidence, and review readiness;
3. take only valid next actions with explicit actor/session attribution;
4. recover safely from stale revisions and other structured CLI errors;
5. browse every schema-v1 coordination entity and its relationships;
6. verify health and audit history without implying that the browser may write
   directly to SQLite.

The task workspace is the primary surface. Governance and system entities remain
fully browsable through secondary navigation and task-linked drill-downs.

## 2. Contract-wide response shapes

### 2.1 Success and failure

The HTTP layer preserves the CLI envelope:

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "code": "stable_snake_case_code",
    "message": "Human-readable explanation",
    "details": {},
    "exit_code": 4
  }
}
```

UX requirements:

- Branch on `error.code`; never infer behavior from message copy.
- Put field errors beside the relevant input when `details` identifies it.
- Treat conflict errors as recoverable state changes: retain the user's draft,
  reload the latest entity, explain what changed, and require a fresh explicit
  submission.
- Treat busy/availability failures as retryable without claiming the mutation
  succeeded.
- Never display success until the API returns `ok: true`.

### 2.2 Pagination and ordering

Every list uses `limit` and `offset`, defaults to 100 rows, and caps at 500.
The API returns arrays without an implicit total. The UI therefore uses
previous/next pagination based on page length unless a view supplies its own
total. It must not fabricate a total from the current page.

Deterministic contract ordering is the default. User sorting may be added only
when it is visibly identified as client-side sorting of the loaded page.

### 2.3 Actor and session attribution

Actor and session are separate concepts:

- the actor is the durable accountable identity;
- the session records one execution context and its harness/model;
- a task claim always needs an active session belonging to the claiming actor;
- leaving `in_progress` requires the actor and session that own the claim;
- other audited mutations may omit a session, but the UI should show whether
  the resulting audit entry will have session attribution.

The selected actor and active session must be visible wherever a mutation is
submitted. The UI must prevent an obviously mismatched actor/session pair while
still treating the CLI as final authority.

## 3. Entity inventory and presentation requirements

### 3.1 Agents

Shape:

```text
id, name, role, actor_type, status, responsibilities, goal,
operating_style, decision_authority, review_authority, escalation_rules,
unavailable_for, created_at, updated_at
```

Enumerations:

- `actor_type`: `ai | human | service`
- `status`: `active | inactive`

Required views and actions:

- Directory list with status, type, role, workload, and active-session cue.
- Profile detail preserves the long-form authority and operating-style fields.
- Create agent.
- Update name, role, actor type, or active state.
- Explain that an agent with an active session cannot be deactivated.

### 3.2 Agent sessions

Shape:

```text
id, agent_id, harness, model, status, started_at, last_seen_at, ended_at?
```

Enumeration: `active | ended`.

Required views and actions:

- Sessions list filterable by agent, status, and harness.
- Start, heartbeat, and end session.
- Ending is unavailable while the session owns active task claims.
- Recover stale session is a high-consequence action: require actor, reason,
  stale threshold, and a preview explaining that claimed tasks will be blocked,
  revisions incremented, claims removed, and the session ended.

### 3.3 Tasks

Base shape:

```text
id, title, description, status, priority, tags, acceptance_criteria,
next_steps, blocked_claims, notes, revision, created_by, created_at, updated_at
```

List aggregates:

```text
claimed_by?, claim_session_id?, claimed_at?, assignees[], evidence_count
```

Detail additions:

```text
evidence[], dependencies[], reviews[]
```

Required views and actions:

- Work queue with ID, title, status, priority, assignees, claim owner, evidence
  count, updated time, and the next valid action.
- Task detail with every stored field. Long-form acceptance criteria, blocked
  claims, notes, and next steps must not be hidden behind generic metadata.
- Create, content update, assignment update, claim, status transition, and
  explicit release.
- All assignment, update, claim, and transition mutations submit the currently
  displayed `revision`.
- Revision conflict recovery reloads the current task and lets the operator
  reconcile their unsaved input.

Priority is integer `1..5`, where `1` is highest. Status is exactly:
`todo | in_progress | review | blocked | done`.

### 3.4 Evidence

Shape:

```text
id (integer), task_id, uri, evidence_type, added_by, created_at
```

Required views and actions:

- Evidence is shown in task context and in a filterable task evidence view.
- Add evidence with task, URI, actor, and optional type.
- URI is rendered as text unless its scheme/path is safe and intentionally
  supported; never auto-execute or embed arbitrary content.
- A task in `review` with zero evidence cannot move to `done`; show the missing
  requirement next to the disabled action.

### 3.5 Dependencies

Shape:

```text
task_id, depends_on_task_id, dependency_type, status, rationale, created_at
```

Enumerations:

- type: `blocks | informs | review_required | evidence_required`
- status: `active | resolved`

Required views and actions:

- Show incoming/outgoing relationship in task context with type, status, target,
  and rationale.
- Add and resolve dependencies.
- Prevent self-dependency selection in the UI.
- Do not interpret every active dependency as a blocker; the type determines
  meaning.

### 3.6 Reviews

Shape:

```text
id, task_id?, reviewer_id, artifact_uri, scope, decision, accepted_items,
required_changes, remaining_risks, blocked_claims, follow_up_tasks, created_at
```

Decision:
`accepted | conditionally_accepted | changes_requested | rejected`.

Required views and actions:

- Review inbox and task-linked review history.
- Add review with artifact, scope, decision, and explicit consequence fields.
- Never collapse `conditionally_accepted` into accepted or rejected.
- Show blocked claims and remaining risks next to the decision.

### 3.7 Decisions

Shape:

```text
id, title, owner_id, status, context, decision, options_considered,
implications, evidence, blocked_claims, review_required, created_at, updated_at
```

Status: `proposed | accepted | superseded | rejected`.

Required views and actions:

- Decision register with owner, status, title, and updated time.
- Full detail preserves rationale, options, implications, evidence, authority
  boundaries, and review requirement.
- Add decision. The contract does not expose a general decision-update command,
  so the UI must not imply arbitrary editing.

### 3.8 Messages

Shape:

```text
id, sender_id, recipient, task_id?, body, tags, created_at
```

Required views and actions:

- Inbox/all-messages view and task-linked messages.
- Send message with sender, recipient, optional task, body, and tags.
- Recipient is text, not necessarily an agent ID; literal `team` is meaningful.
- Preserve chronological metadata and do not present messages as ephemeral chat.

### 3.9 Artifacts

Shape:

```text
id, uri, owner_id, type, status, usage_boundaries, created_at, updated_at,
related_tasks[], reviewers[]
```

Status: `draft | review | accepted | superseded`.

Required views and actions:

- Artifact register with owner, status, related tasks, reviewers, and usage
  boundaries.
- Add artifact and change artifact status.
- Keep task/reviewer relationships as arrays.
- Artifact acceptance does not imply task completion or release authorization.

### 3.10 Escalations

Shape:

```text
id, raised_by, owner, status, related_tasks, needed_by?, issue,
requested_decision, resolution, follow_up_tasks, created_at, updated_at
```

Status:
`open | in_review | resolved | closed_no_action`.

Required views and actions:

- Attention view prioritizes open/in-review escalations by needed-by date when
  it is parseable, while preserving the stored text.
- Add escalation and resolve as `resolved` or `closed_no_action`.
- Resolution requires explicit resolution text.
- `related_tasks` and `follow_up_tasks` are stored text in schema v1, not arrays;
  do not silently normalize them into relational links.

### 3.11 Audit log

Shape:

```text
id, actor, session_id?, action, object_type, object_id, detail, created_at
```

Required view:

- Newest-first audit timeline/table.
- Filters for actor, session, object type, object ID, action, and search.
- Show null session attribution honestly.
- Audit is read-only and is never editable from the console.

### 3.12 Health

Shape:

```text
healthy,
unowned_tasks[],
stale_tasks[],
stale_sessions[],
unclaimed_in_progress_tasks[],
invalid_active_claims[],
active_blockers[],
done_without_evidence[],
open_escalations[],
truncated_sections[]
```

`invalid_active_claims` rows contain:

```text
task_id, agent_id, session_id, claimed_at, task_status, session_status,
session_agent_id, agent_status
```

Required view:

- Health summary is either healthy or grouped by the exact finding sections.
- Show `truncated_sections`; never imply the displayed rows are complete when a
  section is truncated.
- Each finding links to the relevant task, session, agent, or escalation when a
  corresponding entity exists.

### 3.13 Metadata, diagnostics, summary, and export

The shell also needs:

- metadata: project identity, database identity, CLI/schema versions,
  enumerations, and transition map;
- doctor result: environment health;
- summary: table counts, task status/priority counts, escalation/session counts,
  agent workload, and recent audit;
- Markdown export: preview/download of the CLI-rendered report.

The full filesystem database path is diagnostic information and should not be
the default project label. Show a shortened path with an explicit reveal/copy
action.

## 4. Canonical task action model

| Current state | Valid operator actions | Preconditions |
| --- | --- | --- |
| `todo` | Claim; mark blocked | Claim needs matching active session |
| `in_progress` | Release to todo; submit for review; mark blocked | Actor and session must own claim |
| `review` | Claim for changes; mark blocked; mark done | Done needs at least one evidence row |
| `blocked` | Return to todo; claim | Claim needs matching active session |
| `done` | No status action | Terminal success |

Entering `in_progress` always uses claim, never a generic status update.
Transitioning to the current status is invalid. A successful claim or status
change increments the revision. The UI must derive available actions from the
server-provided transition map plus claim/evidence/session prerequisites.

## 5. Information architecture

The final direction may change layout, but it must preserve this semantic IA:

```text
Work
  Attention / Today
  Tasks
    Queue or board
    Task detail
      Overview
      Evidence
      Dependencies
      Reviews
      Messages
      Activity
  Reviews
  Messages

People
  Agents
  Sessions

Governance
  Decisions
  Artifacts
  Escalations

System
  Health
  Audit log
  Export
  Project / CLI diagnostics
```

The primary navigation may group or progressively disclose these destinations,
but every entity remains reachable without knowing a CLI command.

## 6. Visual-direction requirements

All three current visual directions are concept mocks, not data fixtures. Their
visible sample records are illustrative and must not override live API data.
In particular, assignees, claim owners, revisions, counts, and timestamps must
always come from the API.

Whichever direction is selected must:

- render IDs and revisions distinctly from human-readable titles;
- communicate status with text and shape/icon, not color alone;
- preserve readable 14–16px body typography;
- provide 44px minimum primary action targets and visible keyboard focus;
- use no CDN or third-party runtime assets;
- avoid exposing unsupported mutations;
- keep actor/session attribution adjacent to consequential actions;
- retain user input during recoverable conflicts;
- support empty, loading, partial-page, truncated, error, and success states;
- remain usable at narrower desktop widths by changing from simultaneous
  list/detail to a sequential list-then-detail layout.

## 7. Implementation acceptance checks

1. Every entity and field in section 3 has a reachable representation.
2. Every browser mutation maps to one documented CLI command.
3. No direct SQLite write path is exposed.
4. Task actions match section 4 for every status.
5. `revision` is supplied on all revision-guarded mutations.
6. Claim and release actions require the correct active session.
7. `done` is unavailable without evidence.
8. Stable `error.code` values produce deterministic recovery behavior.
9. List views correctly handle arrays, nullable fields, pagination without a
   total, and deterministic ordering.
10. Health truncation, audit null sessions, and schema-v1 text fields are not
    misrepresented.
11. Visual and interaction behavior passes keyboard, contrast, focus, zoom,
    and responsive layout review.
12. Live UI fixtures are derived from API shapes; mockup text is never treated
    as authoritative project state.

## 8. Authority boundaries

This document defines the UX representation and interaction requirements for
the current schema and CLI. It does not authorize:

- changing schema, CLI semantics, status transitions, or error codes;
- direct database writes;
- backup, restore, or destructive filesystem operations in the browser;
- production deployment or release;
- treating a visual concept as usability validation.

